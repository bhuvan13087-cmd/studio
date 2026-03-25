
import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

/**
 * Initializes the Firebase Admin SDK for server-side operations.
 * This implementation assumes that environment variables are correctly configured
 * via Firebase App Hosting or standard Firebase environment settings.
 */
export function getAdminDb() {
  if (!getApps().length) {
    admin.initializeApp();
  }
  return admin.firestore();
}
