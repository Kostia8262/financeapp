import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSetting, setSetting } from '../database/db';
import { T, LANGUAGES } from '../utils/translations';

const LanguageContext = createContext({ lang: 'ru', t: (k) => T.ru[k] || k, setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('ru');

  useEffect(() => {
    getSetting('appLanguage').then(code => {
      if (code && T[code]) setLangState(code);
    });
  }, []);

  const setLang = async (code) => {
    if (!T[code]) return;
    setLangState(code);
    await setSetting('appLanguage', code);
  };

  const t = (key) => T[lang]?.[key] ?? T.ru[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
