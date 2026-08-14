/**
 * Egypt / Africa/Cairo datetime helpers.
 * Display format: "14/08/2026 at 02:34 PM"
 */

export const EGYPT_TIME_ZONE = 'Africa/Cairo';

/** Current instant (UTC-based Date). Format with formatEgyptDateTime for Cairo wall clock. */
export function nowEgyptDate() {
  return new Date();
}

/**
 * Format a Date / ISO string in Africa/Cairo as "DD/MM/YYYY at hh:mm AM/PM".
 */
export function formatEgyptDateTime(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EGYPT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const period = get('dayPeriod');

  return `${day}/${month}/${year} at ${hour}:${minute} ${period}`;
}
