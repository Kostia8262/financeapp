export const CURRENCIES = [
  { code: 'UAH', symbol: '₴', name: 'Гривня',              flag: '🇺🇦' },
  { code: 'USD', symbol: '$', name: 'Доллар США',           flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Евро',                 flag: '🇪🇺' },
  { code: 'RUB', symbol: '₽', name: 'Российский рубль',     flag: '🇷🇺' },
  { code: 'GBP', symbol: '£', name: 'Фунт стерлингов',      flag: '🇬🇧' },
  { code: 'PLN', symbol: 'zł', name: 'Польский злотый',     flag: '🇵🇱' },
  { code: 'CHF', symbol: 'Fr', name: 'Швейцарский франк',   flag: '🇨🇭' },
  { code: 'CAD', symbol: 'C$', name: 'Канадский доллар',    flag: '🇨🇦' },
  { code: 'JPY', symbol: '¥', name: 'Японская иена',        flag: '🇯🇵' },
  { code: 'CNY', symbol: '¥', name: 'Китайский юань',       flag: '🇨🇳' },
];

export function getCurrencyByCode(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}
