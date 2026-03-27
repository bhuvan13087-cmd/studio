
import { NextResponse } from 'next/server';

/**
 * @fileOverview Background synchronization API for member arrears.
 * 
 * DISABLED: System now uses dynamic date-based calculation.
 * Returns 200 for compatibility with existing scheduler configs.
 */

export async function GET(request: Request) {
  return NextResponse.json({ 
    success: true, 
    message: 'Sync-pending is now handled dynamically by the frontend. Cron is disabled.'
  });
}
