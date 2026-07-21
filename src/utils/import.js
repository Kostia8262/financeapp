import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { addTransaction, getCategories } from '../database/db';
import { todayISO } from './format';

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function detectType(val) {
  if (!val) return null;
  const v = val.toLowerCase().trim();
  if (v === 'доход' || v === 'income' || v === '+') return 'income';
  if (v === 'расход' || v === 'expense' || v === '-') return 'expense';
  return null;
}

function detectDate(val) {
  if (!val) return todayISO();
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // Try DD.MM.YYYY
  const m = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Try DD/MM/YYYY
  const m2 = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return todayISO();
}

export async function pickAndParseCSV() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const file = result.assets[0];
  let content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });

  // Strip BOM
  content = content.replace(/^﻿/, '');

  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('Файл пустой или содержит только заголовок');

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  // Map column indices
  const dateIdx = headers.findIndex(h => h.includes('дат') || h === 'date');
  const typeIdx = headers.findIndex(h => h.includes('тип') || h === 'type');
  const amountIdx = headers.findIndex(h => h.includes('сумм') || h === 'amount');
  const categoryIdx = headers.findIndex(h => h.includes('катег') || h === 'category');
  const noteIdx = headers.findIndex(h => h.includes('замет') || h === 'note' || h.includes('описан'));

  if (amountIdx === -1) throw new Error('Не найдена колонка "Сумма" или "amount"');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const amountRaw = cols[amountIdx] || '';
    const amount = parseFloat(amountRaw.replace(/[^\d.,\-]/g, '').replace(',', '.'));
    if (!amount || isNaN(amount)) continue;

    rows.push({
      date: dateIdx >= 0 ? detectDate(cols[dateIdx]) : todayISO(),
      type: typeIdx >= 0 ? (detectType(cols[typeIdx]) || 'expense') : (amount > 0 ? 'income' : 'expense'),
      amount: Math.abs(amount),
      categoryName: categoryIdx >= 0 ? cols[categoryIdx] : '',
      note: noteIdx >= 0 ? cols[noteIdx] : '',
    });
  }

  return rows;
}

export async function importRows(rows, currency = 'UAH') {
  const allCats = await getCategories();
  const catMap = {};
  for (const c of allCats) catMap[c.name.toLowerCase()] = c.id;

  let imported = 0;
  for (const row of rows) {
    const catId = catMap[row.categoryName?.toLowerCase()] || null;
    await addTransaction({
      amount: row.amount,
      type: row.type,
      categoryId: catId,
      note: row.note,
      date: row.date,
      currency,
    });
    imported++;
  }
  return imported;
}
