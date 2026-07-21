// Full format with sign — use for balance values
export function formatMoney(amount, currency = '₴') {
  const n = Number(amount);
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const formatted = abs.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${currency}${formatted}`;
}

// Compact format for small containers — also preserves sign
export function formatMoneyCompact(amount, currency = '₴') {
  const n = Number(amount);
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${currency}${(abs / 1_000_000).toFixed(1)}М`;
  if (abs >= 10_000)    return `${sign}${currency}${(abs / 1_000).toFixed(1)}К`;
  return `${sign}${currency}${abs.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr, locale = 'ru-RU') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatShortDate(dateStr, locale = 'ru-RU') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const MONTH_NAMES = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
];

export const MONTH_NAMES_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
