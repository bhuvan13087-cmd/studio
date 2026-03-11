
'use client';

import { Firestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

/**
 * Creates a new audit log entry in Firestore.
 * @param db The Firestore instance.
 * @param user The current authenticated admin user.
 * @param actionDescription A clear description of the action taken.
 */
export async function createAuditLog(
  db: Firestore,
  user: User | null,
  actionDescription: string
) {
  if (!user) return;

  try {
    await addDoc(collection(db, 'auditLogs'), {
      timestamp: serverTimestamp(),
      adminEmail: user.email,
      adminId: user.uid,
      actionDescription: actionDescription,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
