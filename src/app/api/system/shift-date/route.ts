
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { format, addDays, parseISO, isValid } from 'date-fns';

/**
 * @fileOverview Manual System Date Shift API.
 * 
 * Purpose: One-time manual fix to move the managed system date to the next day.
 * Safety: Does not modify payments, members, or pending counts.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getAdminDb();
  
  try {
    const configRef = db.collection('systemMetadata').doc('status');
    const configDoc = await configRef.get();
    
    // Fallback to actual today if metadata is missing
    let currentManagedDate = format(new Date(), 'yyyy-MM-dd');
    
    if (configDoc.exists) {
      const data = configDoc.data();
      if (data?.managedDate && isValid(parseISO(data.managedDate))) {
        currentManagedDate = data.managedDate;
      }
    }

    const nextDate = format(addDays(parseISO(currentManagedDate), 1), 'yyyy-MM-dd');

    // Safe Update: Only update the system tracking markers.
    // We set lastResetDate to the OLD date to ensure the cron doesn't re-run for that day.
    await configRef.set({
      managedDate: nextDate,
      lastManualShiftAt: new Date().toISOString(),
      lastResetDate: currentManagedDate 
    }, { merge: true });

    // Log the manual shift in audit logs
    await db.collection('auditLogs').add({
      timestamp: new Date().toISOString(),
      adminEmail: 'SYSTEM-MANUAL',
      actionDescription: `Manual Date Shift: System transitioned from ${currentManagedDate} to ${nextDate}.`
    });

    return NextResponse.json({ 
      success: true, 
      message: `System date shifted from ${currentManagedDate} to ${nextDate}`,
      newDate: nextDate
    });

  } catch (error: any) {
    console.error('DATE SHIFT ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
