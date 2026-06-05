import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllTransactionsForExport } from '../database/db';

export async function exportToCSV() {
  const rows = await getAllTransactionsForExport();

  const header = 'Дата,Тип,Сумма,Категория,Заметка\n';
  const body = rows.map(r => {
    const type = r.type === 'income' ? 'Доход' : 'Расход';
    const note = (r.note || '').replace(/"/g, '""');
    const category = (r.category || '').replace(/"/g, '""');
    return `${r.date},${type},${r.amount},"${category}","${note}"`;
  }).join('\n');

  const csv = '﻿' + header + body; // BOM for Excel UTF-8
  const fileName = `finance_${new Date().toISOString().slice(0, 10)}.csv`;
  const filePath = FileSystem.documentDirectory + fileName;

  await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: 'Экспорт финансов',
      UTI: 'public.comma-separated-values-text',
    });
  }

  return filePath;
}
