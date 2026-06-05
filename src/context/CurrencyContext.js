import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSetting, setSetting } from '../database/db';
import { CURRENCIES, getCurrencyByCode } from '../utils/currencies';
import { formatMoney, formatMoneyCompact } from '../utils/format';

const CurrencyContext = createContext({
  currency: CURRENCIES[0],
  setCurrency: () => {},
});

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(CURRENCIES[0]);

  useEffect(() => {
    getSetting('activeCurrency').then(code => {
      if (code) setCurrencyState(getCurrencyByCode(code));
    });
  }, []);

  const setCurrency = async (curr) => {
    setCurrencyState(curr);
    await setSetting('activeCurrency', curr.code);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const { currency, setCurrency } = useContext(CurrencyContext);
  return {
    currency,
    setCurrency,
    code: currency.code,
    symbol: currency.symbol,
    fmt:  (amount) => formatMoney(amount, currency.symbol),
    fmtC: (amount) => formatMoneyCompact(amount, currency.symbol),
  };
}
