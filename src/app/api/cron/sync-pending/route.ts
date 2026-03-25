
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

/**
 * @fileOverview Background synchronization API for member arrears.
 * 
 * Target: Daily at 10:00 PM IST (Asia/Kolkata)
 * Purpose: Automatically increment pendingDays for active daily members 
 * who have not paid by the daily threshold.
 * 
 * Logic:
 * 1. Fetch all active members.
 * 2. For each member, identify the gap between today and the last increment date.
 * 3. If a gap exists, check if the member is still in debt (lastPaymentDate < today).
 * 4. Apply multi-day catch-up if the system missed previous runs.
 */

export async function GET(request: Request) {
  // Security: In a production environment, you should verify a secret token
  // passed in the header (e.g., x-cron-auth) to prevent unauthorized triggers.
  
  const authHeader = request.headers.get('x-cron-auth');
  const cronSecret = process.env.CRON_SECRET;
  
  // Optional security check
  if (cronSecret && authHeader !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const db = getAdminDb();
  
  // Calculate today's date in IST
  const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const todayStr = format(todayIST, 'yyyy-MM-dd');
  
  try {
    const membersSnapshot = await db.collection('members')
      .where('status', '==', 'active')
      .get();

    if (membersSnapshot.empty) {
      return NextResponse.json({ message: 'No active members to process' });
    }

    const batch = db.batch();
    let updatedCount = 0;

    membersSnapshot.forEach(doc => {
      const data = doc.data();
      const memberId = doc.id;
      
      // We only auto-increment for DAILY members (resolved via paymentType or scheme default)
      // Since API route doesn't have easy access to ChitRound collection per member without extra query,
      // we rely on the member's stored paymentType.
      if (data.paymentType?.toLowerCase() !== 'daily') return;

      const lastIncrementStr = data.lastIncrementDate || data.joinDate?.split('T')[0] || todayStr;
      const lastPaymentStr = data.lastPaymentDate || data.joinDate?.split('T')[0] || '1970-01-01';
      
      if (!isValid(parseISO(lastIncrementStr))) return;

      const daysSinceLastSync = differenceInDays(parseISO(todayStr), parseISO(lastIncrementStr));
      
      // If we already ran today, skip
      if (daysSinceLastSync <= 0) return;

      // Logic: If last payment was BEFORE today, they are potentially in debt for the missed interval.
      // daysMissed calculation handles catch-up.
      if (lastPaymentStr < todayStr) {
        const incrementAmount = daysSinceLastSync; // Catch-up logic
        const currentPendingDays = data.pendingDays || 0;
        const schemeAmount = data.monthlyAmount || 800;
        
        const newPendingDays = currentPendingDays + incrementAmount;
        const newPendingAmount = newPendingDays * schemeAmount;

        batch.update(doc.ref, {
          pendingDays: newPendingDays,
          pendingAmount: newPendingAmount,
          lastIncrementDate: todayStr
        });
        updatedCount++;
      } else {
        // Even if they paid, we must mark today as synced to avoid redundant checks
        batch.update(doc.ref, {
          lastIncrementDate: todayStr
        });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      processed: updatedCount,
      dateProcessed: todayStr
    });

  } catch (error: any) {
    console.error('CRON Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
