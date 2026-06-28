/**
 * chit-engine.ts
 *
 * Single source of truth for all chit fund business logic.
 * Pure TypeScript: no UI, no Firebase, no React dependencies.
 *
 * Eliminates the following duplicate logic that previously existed
 * independently in dashboard, members, payments, reports, and rounds pages:
 *   D-1  getPaymentAmount          — 5 copies
 *   D-2  getPaymentDateStr         — 5 copies (3 different fallback chains)
 *   D-3  getCreatedAtDateStr       — 3 copies
 *   D-4  computeMemberStats        — 3 full copies (critical divergences)
 *   D-5  findActiveCycle           — 6+ copies (case-mismatch bug fixed)
 *   D-6  computeTotalPaidInActiveCycle — 3 copies
 *   D-7  isPaymentSuccess          — 5 copies (!p.status divergence)
 *   D-8  handlePopupBlur           — 3 copies
 *   D-9  Monthly due-date check    — embedded in D-4 copies
 */

import {
  format,
  parseISO,
  isValid,
  startOfDay,
  isBefore,
  max,
  eachDayOfInterval,
  addDays,
  differenceInDays,
  isSameMonth,
} from 'date-fns';

// ---------------------------------------------------------------------------
// D-1 · Payment Amount
// ---------------------------------------------------------------------------

/**
 * Extracts the canonical numeric amount from a payment document.
 * Falls back through amountPaid → amount → 0.
 */
export function getPaymentAmount(p: any): number {
  return Number(p.amountPaid || p.amount || 0);
}

// ---------------------------------------------------------------------------
// D-2 · Payment Date String  (target / effective date of the payment)
// ---------------------------------------------------------------------------

/**
 * Resolves the canonical "effective date" string (yyyy-MM-dd) for a payment.
 * Priority: targetDate → paymentDate → createdAt → date → paidDate.
 *
 * This is the most complete fallback chain across all pages and fixes the
 * divergence where some pages only checked targetDate/paymentDate.
 */
export function getPaymentDateStr(p: any): string | null {
  if (p.targetDate && typeof p.targetDate === 'string') return p.targetDate;
  const raw = p.paymentDate || p.createdAt || p.date || p.paidDate;
  if (!raw) return null;
  try {
    const d = raw.toDate ? raw.toDate() : new Date(raw);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
  } catch {
    // ignore invalid dates
  }
  return null;
}

// ---------------------------------------------------------------------------
// D-3 · Created-At / Intake Date String  (physical recording date)
// ---------------------------------------------------------------------------

/**
 * Resolves the date when the payment was physically recorded.
 * Different from getPaymentDateStr, which returns the effective/target date.
 * Used for "today's collection" queries.
 * Priority: createdAt → paymentDate → getPaymentDateStr fallback.
 */
export function getCreatedAtDateStr(p: any): string | null {
  const cAt = p.createdAt;
  if (cAt) {
    try {
      const d = cAt.toDate ? cAt.toDate() : new Date(cAt);
      if (isValid(d)) return format(d, 'yyyy-MM-dd');
    } catch {
      // ignore
    }
  }
  const pDt = p.paymentDate;
  if (pDt) {
    try {
      const d = pDt.toDate ? pDt.toDate() : new Date(pDt);
      if (isValid(d)) return format(d, 'yyyy-MM-dd');
    } catch {
      // ignore
    }
  }
  return getPaymentDateStr(p);
}

// ---------------------------------------------------------------------------
// D-7 · Payment Success Status Check
// ---------------------------------------------------------------------------

/**
 * Returns true if a payment document represents a successful payment.
 *
 * @param strict  When true (default), only 'success' and 'paid' statuses pass.
 *                When false, payments with no status field also pass — this
 *                matches legacy non-strict behavior used in dashboard/reports.
 */
export function isPaymentSuccess(p: any, strict = true): boolean {
  if (p.status === 'success' || p.status === 'paid') return true;
  if (!strict && !p.status) return true;
  return false;
}

// ---------------------------------------------------------------------------
// D-5 · Active Cycle Lookup
// ---------------------------------------------------------------------------

/**
 * Finds the active cycle document for a given chit group name.
 * Uses case-insensitive, trimmed string matching for robustness — fixing the
 * bug where dashboard/members/payments/reports used exact string equality
 * while rounds used trimmed+lowercased matching.
 */
export function findActiveCycle(chitGroup: string, allCycles: any[]): any | undefined {
  const normalised = String(chitGroup || '').trim().toLowerCase();
  return allCycles.find(
    (c) => String(c.name || '').trim().toLowerCase() === normalised && c.status === 'active',
  );
}

// ---------------------------------------------------------------------------
// D-4 · Member Stats Calculation  (pending days / pending amount / status)
// ---------------------------------------------------------------------------

export type MemberStatus = 'paid' | 'pending' | 'waiting';

export interface MemberStats {
  calculatedPendingDays: number;
  calculatedPendingAmount: number;
  memberStatus: MemberStatus;
}

/**
 * Computes the full payment status, pending days, and pending amount for a
 * member. This is the single source of truth for all member status logic.
 *
 * Canonical logic is taken from rounds/page.tsx (most complete version).
 * Fixes:
 *   - dashboard: null crash on open-ended cycles (missing endDate guard)
 *   - members:   simplified date resolution that skipped some payment fields
 *   - all pages: inconsistent active-cycle name matching
 *
 * @param member       Firestore member document
 * @param allPayments  All payment documents
 * @param allCycles    All cycle documents
 * @param chitSchemes  All chitRounds documents
 * @param strict       false → payments with no status field count as paid
 *                     (pass false for dashboard/reports backward-compat)
 */
export function computeMemberStats(
  member: any,
  allPayments: any[],
  allCycles: any[],
  chitSchemes: any[],
  strict = true,
): MemberStats {
  const now = startOfDay(new Date());
  const todayStr = format(now, 'yyyy-MM-dd');

  const activeCycle = findActiveCycle(member.chitGroup, allCycles);

  if (!activeCycle) {
    return { calculatedPendingDays: 0, calculatedPendingAmount: 0, memberStatus: 'paid' };
  }

  const mPayments = allPayments.filter(
    (p) => p.memberId === member.id && isPaymentSuccess(p, strict),
  );

  const scheme = chitSchemes.find(
    (r) =>
      String(r.name || '').trim().toLowerCase() ===
      String(member.chitGroup || '').trim().toLowerCase(),
  );
  const resolvedType: string = member.paymentType || scheme?.collectionType || 'Daily';
  const dailyRate: number = member.monthlyAmount || 800;

  let pendingDaysCount = 0;
  let memberStatus: MemberStatus = 'pending';

  if (resolvedType === 'Daily') {
    if (member.joinDate && member.status !== 'inactive') {
      try {
        const rawJoinDate = parseISO(member.joinDate);
        const cycleStart = parseISO(activeCycle.startDate);
        // null-safe endDate: open-ended cycles use today as the boundary
        const cycleEnd = activeCycle.endDate ? parseISO(activeCycle.endDate) : now;
        const effectiveStart = startOfDay(max([rawJoinDate, cycleStart]));
        const effectiveEnd = isBefore(now, cycleEnd) ? now : cycleEnd;
        if (isBefore(effectiveStart, addDays(effectiveEnd, 1))) {
          const interval = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
          interval.forEach((day) => {
            const dStr = format(day, 'yyyy-MM-dd');
            const dayPaymentSum = mPayments
              .filter((p) => getPaymentDateStr(p) === dStr)
              .reduce((acc, p) => acc + getPaymentAmount(p), 0);
            if (dayPaymentSum < dailyRate) pendingDaysCount++;
          });
        }
      } catch {
        // ignore date parse errors for malformed joinDate
      }
    }
    // Today's status: did the member meet the daily rate today?
    memberStatus =
      mPayments
        .filter((p) => getPaymentDateStr(p) === todayStr)
        .reduce((acc, p) => acc + getPaymentAmount(p), 0) >= dailyRate
        ? 'paid'
        : 'pending';
  } else {
    // Monthly scheme
    const hasPaidThisCycle = mPayments.some((p) => {
      const pDate = getPaymentDateStr(p);
      return (
        pDate != null &&
        pDate >= activeCycle.startDate &&
        (activeCycle.endDate ? pDate <= activeCycle.endDate : true)
      );
    });

    if (hasPaidThisCycle) {
      memberStatus = 'paid';
      pendingDaysCount = 0;
    } else {
      const cycleStart = parseISO(activeCycle.startDate);
      const numericDueDate: number = scheme?.dueDate || 5;
      // D-9: monthly due-date check — single canonical implementation
      const isPastDue = !isSameMonth(now, cycleStart) || now.getDate() > numericDueDate;

      if (!isPastDue) {
        memberStatus = 'waiting';
      } else {
        memberStatus = 'pending';
        const rawJoinDate = parseISO(member.joinDate);
        const dueDateLimit = startOfDay(addDays(cycleStart, numericDueDate - 1));
        const countFrom = addDays(dueDateLimit, 1);
        const effectiveStart = startOfDay(max([rawJoinDate, cycleStart, countFrom]));
        // null-safe endDate for monthly too
        const effectiveEnd =
          activeCycle.endDate && isBefore(parseISO(activeCycle.endDate), now)
            ? parseISO(activeCycle.endDate)
            : now;
        if (isBefore(effectiveStart, addDays(effectiveEnd, 1))) {
          pendingDaysCount = differenceInDays(effectiveEnd, effectiveStart) + 1;
        }
      }
    }
  }

  return {
    calculatedPendingDays: pendingDaysCount,
    calculatedPendingAmount: pendingDaysCount * dailyRate,
    memberStatus,
  };
}

// ---------------------------------------------------------------------------
// D-6 · Total Amount Paid by a Member in Their Active Cycle
// ---------------------------------------------------------------------------

/**
 * Returns the total amount a member has paid within their group's active cycle.
 *
 * @param strict  false → payments with no status field are included
 *                (pass false for dashboard/payments backward-compat)
 */
export function computeTotalPaidInActiveCycle(
  memberId: string,
  chitGroup: string,
  allPayments: any[],
  allCycles: any[],
  strict = true,
): number {
  const activeCycle = findActiveCycle(chitGroup, allCycles);
  if (!activeCycle) return 0;
  return allPayments
    .filter((p) => {
      if (p.memberId !== memberId) return false;
      if (!isPaymentSuccess(p, strict)) return false;
      const pDate = getPaymentDateStr(p);
      return (
        pDate != null &&
        pDate >= activeCycle.startDate &&
        (activeCycle.endDate ? pDate <= activeCycle.endDate : true)
      );
    })
    .reduce((acc, p) => acc + getPaymentAmount(p), 0);
}

// ---------------------------------------------------------------------------
// D-8 · UI Utility: handlePopupBlur
// ---------------------------------------------------------------------------

/**
 * Blurs the focused input/textarea/select on dialog interaction events.
 * Prevents the keyboard from staying open on mobile devices.
 * Shared across rounds, members, and payments pages.
 */
export function handlePopupBlur(e: any): void {
  const ae = document.activeElement;
  if (
    ae instanceof HTMLInputElement ||
    ae instanceof HTMLTextAreaElement ||
    ae instanceof HTMLSelectElement
  ) {
    ae.blur();
    e.preventDefault();
  }
}
