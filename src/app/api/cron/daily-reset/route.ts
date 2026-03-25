
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { format, addDays, parseISO, isBefore } from 'date-fns';

/**
 * @fileOverview Daily Reset System API.
 * 
 * Target: Daily at 11:00 PM IST (Asia/Kolkata)
 * Purpose: Transition the system to the next calendar day, reset session flags,
 * and archive today's pending status into 'yesterdayPending'.
 */

export async function GET(request: Request) {
  const db = getAdminDb();
  
  // Calculate today's date in IST
  const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const todayStr = format(todayIST, 'yyyy-MM-dd');
  const nextDayStr = format(addDays(todayIST, 1), 'yyyy-MM-dd');
  
  try {
    const configRef = db.collection('systemMetadata').doc('status');
    const configDoc = await configRef.get();
    
    const configData = configDoc.exists ? configDoc.data() : {};
    const lastResetDate = configData?.lastResetDate || '';

    // Guard: Prevent duplicate reset on the same day
    if (lastResetDate === todayStr) {
      return NextResponse.json({ 
        message: 'Daily reset already performed for today.', 
        currentManagedDate: configData?.managedDate 
      });
    }

    const membersSnapshot = await db.collection('members')
      .where('status', '==', 'active')
      .get();

    const batch = db.batch();
    let resetCount = 0;

    membersSnapshot.forEach(doc => {
      const data = doc.data();
      const lastPaymentDate = data.lastPaymentDate || '1970-01-01';
      
      // Archiving logic: 
      // If they didn't pay today (by 11PM), they are recorded as pending for 'yesterday' tomorrow.
      const wasPendingToday = lastPaymentDate < todayStr;

      batch.update(doc.ref, {
        yesterdayPending: wasPendingToday ? 1 : 0,
        // Reset any hypothetical daily session flags or tracking states here
      });
      resetCount++;
    });

    // Update global system state
    // Move 'managedDate' to the next calendar day
    batch.set(configRef, {
      lastResetDate: todayStr,
      managedDate: nextDayStr,
      lastResetTimestamp: new Date().toISOString()
    }, { merge: true });

    // Commit changes
    if (resetCount > 0 || !configDoc.exists) {
      await batch.commit();
    }

    // Optional: Log the reset in audit logs
    await db.collection('auditLogs').add({
      timestamp: new Date().toISOString(),
      adminEmail: 'SYSTEM',
      actionDescription: `11 PM Daily Reset: Transitioned to ${nextDayStr}. Processed ${resetCount} members.`
    });

    return NextResponse.json({ 
      success: true, 
      processedMembers: resetCount,
      newSystemDate: nextDayStr
    });

  } catch (error: any) {
    console.error('DAILY RESET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
