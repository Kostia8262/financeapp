import * as SQLite from 'expo-sqlite';

let db;

export async function getDatabase() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('finance.db');
    await initDatabase(db);
  }
  return db;
}

async function initDatabase(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#607D8B',
      icon TEXT NOT NULL DEFAULT 'ellipse'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category_id INTEGER,
      note TEXT DEFAULT '',
      date TEXT NOT NULL,
      currency TEXT DEFAULT 'UAH',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migration: add currency column to existing databases
  try {
    await db.execAsync("ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'UAH'");
  } catch {}

  const count = await db.getFirstAsync('SELECT COUNT(*) as cnt FROM categories');
  if (count.cnt === 0) {
    await seedDefaultCategories(db);
  }
}

// --- Settings ---

export async function getSetting(key) {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value || null;
}

export async function setSetting(key, value) {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
}

async function seedDefaultCategories(db) {
  const defaults = [
    ['Зарплата', 'income', '#4CAF50', 'briefcase'],
    ['Фриланс', 'income', '#8BC34A', 'laptop'],
    ['Инвестиции', 'income', '#009688', 'trending-up'],
    ['Подарок', 'income', '#E91E63', 'gift'],
    ['Еда', 'expense', '#FF5722', 'fast-food'],
    ['Транспорт', 'expense', '#FF9800', 'car'],
    ['Жилье', 'expense', '#9C27B0', 'home'],
    ['Здоровье', 'expense', '#F44336', 'medkit'],
    ['Развлечения', 'expense', '#2196F3', 'game-controller'],
    ['Одежда', 'expense', '#00BCD4', 'shirt'],
    ['Образование', 'expense', '#3F51B5', 'school'],
    ['Связь', 'expense', '#607D8B', 'phone-portrait'],
    ['Кафе', 'expense', '#795548', 'cafe'],
    ['Спорт', 'expense', '#CDDC39', 'barbell'],
    ['Другое', 'expense', '#9E9E9E', 'ellipse'],
  ];

  for (const [name, type, color, icon] of defaults) {
    await db.runAsync(
      'INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)',
      [name, type, color, icon]
    );
  }
}

// --- Transactions ---

export async function addTransaction({ amount, type, categoryId, note, date, currency = 'UAH' }) {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO transactions (amount, type, category_id, note, date, currency) VALUES (?, ?, ?, ?, ?, ?)',
    [amount, type, categoryId, note || '', date, currency]
  );
  return result.lastInsertRowId;
}

export async function getTransactions({ limit = 50, offset = 0, type, categoryId, dateFrom, dateTo, currency } = {}) {
  const db = await getDatabase();
  let query = `
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (type)       { query += ' AND t.type = ?';         params.push(type); }
  if (categoryId) { query += ' AND t.category_id = ?';  params.push(categoryId); }
  if (dateFrom)   { query += ' AND t.date >= ?';        params.push(dateFrom); }
  if (dateTo)     { query += ' AND t.date <= ?';        params.push(dateTo); }
  if (currency)   { query += ' AND t.currency = ?';     params.push(currency); }

  query += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await db.getAllAsync(query, params);
}

export async function deleteTransaction(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function updateTransaction(id, { amount, type, categoryId, note, date, currency }) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE transactions SET amount=?, type=?, category_id=?, note=?, date=?, currency=? WHERE id=?',
    [amount, type, categoryId, note || '', date, currency || 'UAH', id]
  );
}

// --- Balance ---

export async function getBalance(currency) {
  const db = await getDatabase();
  const where = currency ? 'WHERE currency = ?' : '';
  const params = currency ? [currency] : [];
  const row = await db.getFirstAsync(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as total_expense
    FROM transactions ${where}
  `, params);
  return {
    income: row.total_income,
    expense: row.total_expense,
    balance: row.total_income - row.total_expense,
  };
}

export async function getRangeBalance(dateFrom, dateTo, currency) {
  const db = await getDatabase();
  const conditions = [];
  const params = [];
  if (dateFrom) { conditions.push('date >= ?'); params.push(dateFrom); }
  if (dateTo)   { conditions.push('date <= ?'); params.push(dateTo); }
  if (currency) { conditions.push('currency = ?'); params.push(currency); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const row = await db.getFirstAsync(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
    FROM transactions ${where}
  `, params);
  return { income: row.income, expense: row.expense, balance: row.income - row.expense };
}

export async function getMonthlyBalance(year, month, currency) {
  const db = await getDatabase();
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to   = `${year}-${String(month).padStart(2, '0')}-31`;
  const extra = currency ? ' AND currency = ?' : '';
  const params = currency ? [from, to, currency] : [from, to];
  const row = await db.getFirstAsync(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
    FROM transactions WHERE date BETWEEN ? AND ?${extra}
  `, params);
  return { income: row.income, expense: row.expense, balance: row.income - row.expense };
}

export async function getCategoryStats({ type, dateFrom, dateTo, currency } = {}) {
  const db = await getDatabase();
  let query = `
    SELECT c.id, c.name, c.color, c.icon, c.type,
           COALESCE(SUM(t.amount), 0) as total,
           COUNT(t.id) as count
    FROM categories c
    LEFT JOIN transactions t ON c.id = t.category_id
  `;
  const params = [];
  const conditions = [];

  if (type)     { conditions.push('c.type = ?'); params.push(type); }
  if (dateFrom) { conditions.push('(t.date IS NULL OR t.date >= ?)'); params.push(dateFrom); }
  if (dateTo)   { conditions.push('(t.date IS NULL OR t.date <= ?)'); params.push(dateTo); }
  if (currency) { conditions.push('(t.currency IS NULL OR t.currency = ?)'); params.push(currency); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' GROUP BY c.id ORDER BY total DESC';

  return await db.getAllAsync(query, params);
}

export async function getMonthlyChartData(year, currency) {
  const db = await getDatabase();
  const extra = currency ? ' AND currency = ?' : '';
  const params = currency ? [String(year), currency] : [String(year)];
  const rows = await db.getAllAsync(`
    SELECT
      strftime('%m', date) as month,
      type,
      SUM(amount) as total
    FROM transactions
    WHERE strftime('%Y', date) = ?${extra}
    GROUP BY month, type
    ORDER BY month
  `, params);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return months.map(m => {
    const mStr = String(m).padStart(2, '0');
    const inc = rows.find(r => r.month === mStr && r.type === 'income');
    const exp = rows.find(r => r.month === mStr && r.type === 'expense');
    return { month: m, income: inc?.total || 0, expense: exp?.total || 0 };
  });
}

// --- Categories ---

export async function updateCategory(id, { name, color, icon }) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?',
    [name, color, icon, id]
  );
}

export async function getCategories(type) {
  const db = await getDatabase();
  if (type) {
    return await db.getAllAsync('SELECT * FROM categories WHERE type = ? ORDER BY name', [type]);
  }
  return await db.getAllAsync('SELECT * FROM categories ORDER BY type, name');
}

export async function addCategory({ name, type, color, icon }) {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)',
    [name, type, color || '#607D8B', icon || 'ellipse']
  );
  return result.lastInsertRowId;
}

export async function deleteCategory(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

// --- Clear Data ---

export async function clearAllTransactions() {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM transactions;');
}

// --- Analytics helpers ---

export async function getExtendedStats({ type, dateFrom, dateTo, currency }) {
  const db = await getDatabase();
  const cur = currency ? ` AND currency = '${currency}'` : '';
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const weekDay = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - weekDay);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const [period, today, week, dayCount] = await Promise.all([
    db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type=? AND date BETWEEN ? AND ?${cur}`,
      [type, dateFrom, dateTo]
    ),
    db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type=? AND date=?${cur}`,
      [type, todayStr]
    ),
    db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type=? AND date>=?${cur}`,
      [type, weekStartStr]
    ),
    db.getFirstAsync(
      `SELECT COUNT(DISTINCT date) as cnt FROM transactions WHERE type=? AND date BETWEEN ? AND ?${cur}`,
      [type, dateFrom, dateTo]
    ),
  ]);
  const days = Math.max(dayCount.cnt, 1);
  return {
    periodTotal: period.total,
    todayTotal:  today.total,
    weekTotal:   week.total,
    dayAvg:      period.total / days,
  };
}

export async function getDailyData({ type, dateFrom, dateTo, currency }) {
  const db = await getDatabase();
  const extra = currency ? ' AND currency = ?' : '';
  const params = currency ? [type, dateFrom, dateTo, currency] : [type, dateFrom, dateTo];
  return await db.getAllAsync(
    `SELECT date, COALESCE(SUM(amount),0) as total
     FROM transactions
     WHERE type=? AND date BETWEEN ? AND ?${extra}
     GROUP BY date ORDER BY date`,
    params
  );
}

export async function getDailyDataBoth({ dateFrom, dateTo, currency }) {
  const db = await getDatabase();
  const extra = currency ? ' AND currency = ?' : '';
  const params = currency ? [dateFrom, dateTo, currency] : [dateFrom, dateTo];
  return await db.getAllAsync(
    `SELECT date,
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as expense
     FROM transactions
     WHERE date BETWEEN ? AND ?${extra}
     GROUP BY date ORDER BY date`,
    params
  );
}

// --- Balance insights ---

export async function getMonthlyTrend(months = 6, currency) {
  const db = await getDatabase();
  const extra = currency ? ` AND currency = '${currency}'` : '';
  const rows = await db.getAllAsync(
    `SELECT strftime('%Y-%m', date) as month,
       SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) as income,
       SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
     FROM transactions WHERE 1=1${extra}
     GROUP BY month ORDER BY month DESC LIMIT ?`,
    [months]
  );
  return rows.reverse();
}

export async function getInsights(currency) {
  const db = await getDatabase();
  const c = currency ? ` AND currency = '${currency}'` : '';
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const curFrom = `${y}-${m}-01`;
  const curTo   = `${y}-${m}-31`;

  const prevDate = new Date(y, now.getMonth() - 1, 1);
  const py = prevDate.getFullYear();
  const pm = String(prevDate.getMonth() + 1).padStart(2, '0');
  const prevFrom = `${py}-${pm}-01`;
  const prevTo   = `${py}-${pm}-31`;

  const todayStr = now.toISOString().slice(0, 10);
  const daysInMonth = new Date(y, now.getMonth() + 1, 0).getDate();
  const daysPassed  = now.getDate();

  const [cur, prev, allTime, topCat, dailyExp] = await Promise.all([
    db.getFirstAsync(
      `SELECT SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
       FROM transactions WHERE date BETWEEN ? AND ?${c}`,
      [curFrom, curTo]
    ),
    db.getFirstAsync(
      `SELECT SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
       FROM transactions WHERE date BETWEEN ? AND ?${c}`,
      [prevFrom, prevTo]
    ),
    db.getFirstAsync(
      `SELECT SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
       FROM transactions WHERE 1=1${c}`
    ),
    db.getFirstAsync(
      `SELECT c.name, c.color, SUM(t.amount) as total
       FROM transactions t JOIN categories c ON t.category_id = c.id
       WHERE t.type='expense' AND t.date BETWEEN ? AND ?${c}
       GROUP BY c.id ORDER BY total DESC LIMIT 1`,
      [curFrom, curTo]
    ),
    db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions
       WHERE type='expense' AND date BETWEEN ? AND ?${c}`,
      [curFrom, todayStr]
    ),
  ]);

  const curIncome  = cur?.income  || 0;
  const curExpense = cur?.expense || 0;
  const prevIncome  = prev?.income  || 0;
  const prevExpense = prev?.expense || 0;
  const balance = (allTime?.income || 0) - (allTime?.expense || 0);
  const dailyAvg  = daysPassed > 0 ? dailyExp.total / daysPassed : 0;
  const projected = dailyAvg * daysInMonth;
  const runway    = dailyAvg > 0 ? Math.floor(balance / dailyAvg) : null;
  const savings   = curIncome > 0 ? Math.round(((curIncome - curExpense) / curIncome) * 100) : 0;
  const expGrowth = prevExpense > 0
    ? Math.round(((curExpense - prevExpense) / prevExpense) * 100)
    : null;

  return {
    balance,
    curIncome, curExpense,
    prevIncome, prevExpense,
    dailyAvg, projected, runway, savings,
    expGrowth,
    topCat: topCat || null,
    daysInMonth, daysPassed,
  };
}

// --- Backup / Restore ---

export async function getAllDataForBackup() {
  const db = await getDatabase();
  const [transactions, categories] = await Promise.all([
    db.getAllAsync('SELECT * FROM transactions ORDER BY date DESC'),
    db.getAllAsync('SELECT * FROM categories ORDER BY type, name'),
  ]);
  return { transactions, categories, exportedAt: new Date().toISOString(), version: 1 };
}

export async function importBackupData(data) {
  const db = await getDatabase();
  if (!data || !data.transactions || !data.categories) throw new Error('Неверный формат файла резервной копии');
  await db.execAsync('BEGIN TRANSACTION');
  try {
    await db.execAsync('DELETE FROM transactions; DELETE FROM categories;');
    for (const c of data.categories) {
      await db.runAsync(
        'INSERT OR REPLACE INTO categories (id, name, type, color, icon) VALUES (?, ?, ?, ?, ?)',
        [c.id, c.name, c.type, c.color, c.icon]
      );
    }
    for (const t of data.transactions) {
      await db.runAsync(
        'INSERT OR REPLACE INTO transactions (id, amount, type, category_id, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [t.id, t.amount, t.type, t.category_id, t.note || '', t.date, t.created_at || new Date().toISOString()]
      );
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

// --- CSV Export ---

export async function getAllTransactionsForExport() {
  const db = await getDatabase();
  return await db.getAllAsync(`
    SELECT t.date, t.type, t.amount, c.name as category, t.note
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY t.date DESC
  `);
}
