/**
 * Cache utilities for server-side data with auto-invalidation at 9 AM IST
 */

export function getSecondsUntil9AMIST(): number {
  const now = new Date();
  
  // Convert current time to IST
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset);
  
  // Get next 9 AM IST
  const next9AM = new Date(istTime);
  next9AM.setUTCHours(3, 30, 0, 0); // 9 AM IST = 3:30 AM UTC
  
  // If we've passed 9 AM today, set to 9 AM tomorrow
  if (istTime.getUTCHours() > 3 || (istTime.getUTCHours() === 3 && istTime.getUTCMinutes() >= 30)) {
    next9AM.setUTCDate(next9AM.getUTCDate() + 1);
  }
  
  // Calculate seconds until next 9 AM IST
  const secondsUntil9AM = Math.floor((next9AM.getTime() - now.getTime()) / 1000);
  
  // Return the smaller of: 1 hour or time until 9 AM IST
  const oneHour = 3600;
  return Math.min(oneHour, secondsUntil9AM);
}
