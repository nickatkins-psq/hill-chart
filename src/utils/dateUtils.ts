/**
 * Date utility functions for parsing and formatting dates
 */

/**
 * Format date as YYYY-MM-DD for filenames
 */
export function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format date as snapshot ID: YYYY-MM-DD-HHMMSSZ (UTC)
 */
export function formatDateAsSnapshotId(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}Z`;
}

/**
 * Parse snapshot ID to Date (UTC)
 * Expected format: YYYY-MM-DD-HHMMSSZ (e.g., 2026-01-16-175406Z)
 */
export function parseSnapshotIdToDate(snapshotId: string): Date | null {
  const match = snapshotId.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const seconds = parseInt(match[6], 10);
  const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse date from snapshot ID with fallback to generated field
 */
export function parseSnapshotDate(
  snapshotId: string,
  generated?: string
): Date | null {
  // Always prioritize the snapshot ID date, as it contains the timestamp
  const parsedSnapshotDate = parseSnapshotIdToDate(snapshotId);
  if (parsedSnapshotDate && !isNaN(parsedSnapshotDate.getTime())) {
    return parsedSnapshotDate;
  }
  
  // Fallback to generated field if snapshot ID doesn't contain date
  if (generated) {
    const fallbackDate = new Date(generated);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }
  }
  
  return null;
}

/**
 * Normalize date for comparison (YYYY-MM-DD)
 */
export function normalizeDate(date: Date): string {
  return formatDateForFilename(date);
}

/**
 * Safely parse a date value (handles Firestore Timestamps, strings, numbers)
 */
export function safeParseDate(value: any): Date | null {
  if (!value) return null;
  try {
    if (value.toDate && typeof value.toDate === 'function') {
      return value.toDate();
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
}

/**
 * Format date with time in local timezone
 */
export function formatDateWithTime(date: Date): string {
  // Use local timezone methods to display in user's local time
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const hours12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const minutesStr = minutes.toString().padStart(2, '0');
  
  // Get timezone abbreviation using Intl API
  const timeZoneParts = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).formatToParts(date);
  const timeZoneAbbr = timeZoneParts.find(part => part.type === 'timeZoneName')?.value || '';
  
  return `${monthNames[month]} ${day}, ${year} at ${hours12}:${minutesStr} ${ampm} ${timeZoneAbbr}`;
}
