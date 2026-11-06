import type { Locale, Translate } from './translator.ts';

/** Format a partial date (YYYY, YYYY-MM or YYYY-MM-DD) for a locale, e.g. "juin 2025". */
export function formatPartialDate(value: string, locale: Locale): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year) return value;
  if (!month) return String(year);
  const date = new Date(Date.UTC(year, month - 1, day ?? 1));
  const options: Intl.DateTimeFormatOptions = day
    ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { month: 'short', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/** Format a period; a missing end means "ongoing" and uses the `common.present` message. */
export function formatPeriod(start: string | undefined, end: string | undefined, locale: Locale, t: Translate): string {
  if (!start && !end) return '';
  const from = start ? formatPartialDate(start, locale) : '';
  const to = end ? formatPartialDate(end, locale) : t('common.present');
  return from ? `${from} – ${to}` : to;
}
