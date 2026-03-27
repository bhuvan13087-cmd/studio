
import { NextResponse } from 'next/server';

/**
 * @fileOverview Daily Reset System API.
 * 
 * DISABLED: System now uses dynamic date-based calculation.
 * Returns 200 for compatibility with existing scheduler configs.
 */

export async function GET(request: Request) {
  return NextResponse.json({ 
    success: true, 
    message: 'Daily-reset is now handled dynamically. Cron is disabled.'
  });
}
