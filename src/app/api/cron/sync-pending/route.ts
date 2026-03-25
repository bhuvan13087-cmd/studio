
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

/**
 * @fileOverview Background synchronization API for member arrears.
 * 
 * Target: Daily at 10:00 PM IST (Asia/Kolkata)
 * Purpose: Automatically increment pendingDays for active daily members 
 * who have not fulfilled their daily installment requirement.
 */

export async function GET(request: Request) {
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
      
      // We only auto-increment for DAILY members
      if (data.paymentType?.toLowerCase() !== 'daily') return;

      const lastIncrementStr = data.lastIncrementDate || data.joinDate?.split('T')[0] || todayStr;
      const lastPaymentStr = data.lastPaymentDate || '1970-01-01';
      
      const daysSinceLastSync = differenceInDays(parseISO(todayStr), parseISO(lastIncrementStr));
      
      // Safety: Do not run twice in the same calendar day
      if (daysSinceLastSync <= 0) return;

      // INCREMENT LOGIC (STRICT)
      // Condition: lastPaymentDate != TODAY
      if (lastPaymentStr < todayStr) {
        // Increment pendingDays based on the gap (supports multi-day catch-up)
        const incrementAmount = daysSinceLastSync;
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
        // If they already paid today, just mark the increment marker as up-to-date
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
