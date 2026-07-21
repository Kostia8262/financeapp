import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllTransactionsForExport } from '../database/db';

export async function exportToCSV(t) {
  const rows = await getAllTransactionsForExport();

  const header = `${t('csv_col_date')},${t('csv_col_type')},${t('csv_col_amount')},${t('csv_col_category')},${t('csv_col_note')}\n`;
  const body = rows.map(r => {
    const type = r.type === 'income' ? t('type_income') : t('type_expense');
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
      dialogTitle: t('export_csv'),
      UTI: 'public.comma-separated-values-text',
    });
  }

  return filePath;
}
