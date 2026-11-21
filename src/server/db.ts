import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import type {
  ChatMessage,
  Conversation,
  ExpenseItem,
  FinancialPlan,
  FinancialProfile,
  ProfileSnapshot,
  TransactionItem,
  TransactionType,
  UserRoleType,
} from '../types.ts';

const dbPath = path.resolve(process.cwd(), 'finsmart.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    session_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL DEFAULT '',
    role_type TEXT NOT NULL DEFAULT 'Sinh viên',
    record_date TEXT NOT NULL DEFAULT '',
    monthly_income INTEGER NOT NULL DEFAULT 0,
    expenses_json TEXT NOT NULL DEFAULT '[]',
    financial_goal TEXT NOT NULL DEFAULT '',
    target_amount INTEGER NOT NULL DEFAULT 0,
    target_months INTEGER NOT NULL DEFAULT 6,
    current_problem TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile_snapshots (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    record_date TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    role_type TEXT NOT NULL DEFAULT 'Sinh viên',
    monthly_income INTEGER NOT NULL DEFAULT 0,
    expenses_json TEXT NOT NULL DEFAULT '[]',
    financial_goal TEXT NOT NULL DEFAULT '',
    target_amount INTEGER NOT NULL DEFAULT 0,
    target_months INTEGER NOT NULL DEFAULT 6,
    current_problem TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    UNIQUE(session_id, record_date)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    needs_more_info INTEGER NOT NULL DEFAULT 0,
    plan_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS financial_plans (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    monthly_income INTEGER NOT NULL DEFAULT 0,
    total_expenses INTEGER NOT NULL DEFAULT 0,
    recommended_monthly_savings INTEGER NOT NULL DEFAULT 0,
    emergency_fund_target INTEGER NOT NULL DEFAULT 0,
    allocations_json TEXT NOT NULL DEFAULT '[]',
    action_steps_json TEXT NOT NULL DEFAULT '[]',
    risks_json TEXT NOT NULL DEFAULT '[]',
    adjustment_guidance TEXT NOT NULL DEFAULT '',
    plan_date TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tx_date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_session_date ON profile_snapshots(session_id, record_date DESC);
  CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_plans_session ON financial_plans(session_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_transactions_session_date ON transactions(session_id, tx_date DESC, created_at DESC);
`);

function ensureColumn(tableName: string, columnName: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

ensureColumn('profiles', 'record_date', "TEXT NOT NULL DEFAULT ''");
ensureColumn('financial_plans', 'plan_date', "TEXT NOT NULL DEFAULT ''");

function nowIso(): string {
  return new Date().toISOString();
}

function todayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sanitizeRecordDate(value?: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return todayDateStr();
}

export function createDefaultExpenses(): ExpenseItem[] {
  return [
    { id: 'exp-food', category: 'Ăn uống & Sinh hoạt', amount: 0, isEssential: true },
    { id: 'exp-housing', category: 'Nhà ở / Phòng trọ / Điện nước', amount: 0, isEssential: true },
    { id: 'exp-transport', category: 'Di chuyển / Xăng xe', amount: 0, isEssential: true },
    { id: 'exp-study', category: 'Học tập / Công việc', amount: 0, isEssential: true },
    { id: 'exp-personal', category: 'Giải trí / Mua sắm cá nhân', amount: 0, isEssential: false },
  ];
}

export function getOrCreateProfile(sessionId: string): FinancialProfile {
  const row = db
    .prepare('SELECT * FROM profiles WHERE session_id = ?')
    .get(sessionId) as Record<string, unknown> | undefined;

  if (!row) {
    const now = nowIso();
    const recordDate = todayDateStr();
    const defaultExpenses = createDefaultExpenses();
    db.prepare(
      `INSERT INTO profiles (
        session_id, full_name, role_type, record_date, monthly_income, expenses_json,
        financial_goal, target_amount, target_months, current_problem, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      sessionId,
      '',
      'Sinh viên',
      recordDate,
      0,
      JSON.stringify(defaultExpenses),
      '',
      0,
      0,
      '',
      now
    );

    return {
      sessionId,
      fullName: '',
      roleType: 'Sinh viên',
      recordDate,
      monthlyIncome: 0,
      expenses: defaultExpenses,
      financialGoal: '',
      targetAmount: 0,
      targetMonths: 0,
      currentProblem: '',
      updatedAt: now,
    };
  }

  let parsedExpenses: ExpenseItem[] = [];
  try {
    parsedExpenses = JSON.parse(String(row.expenses_json || '[]')) as ExpenseItem[];
  } catch {
    parsedExpenses = createDefaultExpenses();
  }

  const recordDate = sanitizeRecordDate(String(row.record_date || ''));

  return {
    sessionId: String(row.session_id),
    fullName: String(row.full_name ?? ''),
    roleType: (String(row.role_type || 'Sinh viên') as UserRoleType),
    recordDate,
    monthlyIncome: Number(row.monthly_income ?? 0),
    expenses: parsedExpenses,
    financialGoal: String(row.financial_goal ?? ''),
    targetAmount: Number(row.target_amount ?? 0),
    targetMonths: Number(row.target_months ?? 6),
    currentProblem: String(row.current_problem ?? ''),
    updatedAt: String(row.updated_at),
  };
}

export function upsertProfileSnapshot(profile: FinancialProfile): ProfileSnapshot {
  const id = crypto.randomUUID();
  const recordDate = sanitizeRecordDate(profile.recordDate);
  const expensesJson = JSON.stringify(profile.expenses || []);

  db.prepare(
    `INSERT INTO profile_snapshots (
      id, session_id, record_date, full_name, role_type, monthly_income, expenses_json,
      financial_goal, target_amount, target_months, current_problem, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, record_date) DO UPDATE SET
      full_name = excluded.full_name,
      role_type = excluded.role_type,
      monthly_income = excluded.monthly_income,
      expenses_json = excluded.expenses_json,
      financial_goal = excluded.financial_goal,
      target_amount = excluded.target_amount,
      target_months = excluded.target_months,
      current_problem = excluded.current_problem,
      updated_at = excluded.updated_at`
  ).run(
    id,
    profile.sessionId,
    recordDate,
    profile.fullName,
    profile.roleType,
    profile.monthlyIncome,
    expensesJson,
    profile.financialGoal,
    profile.targetAmount,
    profile.targetMonths,
    profile.currentProblem,
    profile.updatedAt
  );

  const saved = db
    .prepare('SELECT * FROM profile_snapshots WHERE session_id = ? AND record_date = ?')
    .get(profile.sessionId, recordDate) as Record<string, unknown>;

  return {
    id: String(saved.id),
    sessionId: String(saved.session_id),
    recordDate: String(saved.record_date),
    fullName: String(saved.full_name ?? ''),
    roleType: String(saved.role_type || 'Sinh viên') as UserRoleType,
    monthlyIncome: Number(saved.monthly_income ?? 0),
    expenses: JSON.parse(String(saved.expenses_json || '[]')) as ExpenseItem[],
    financialGoal: String(saved.financial_goal ?? ''),
    targetAmount: Number(saved.target_amount ?? 0),
    targetMonths: Number(saved.target_months ?? 6),
    currentProblem: String(saved.current_problem ?? ''),
    updatedAt: String(saved.updated_at),
  };
}

export function listProfileSnapshots(sessionId: string): ProfileSnapshot[] {
  const rows = db
    .prepare('SELECT * FROM profile_snapshots WHERE session_id = ? ORDER BY record_date DESC, updated_at DESC')
    .all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    sessionId: String(r.session_id),
    recordDate: String(r.record_date),
    fullName: String(r.full_name ?? ''),
    roleType: String(r.role_type || 'Sinh viên') as UserRoleType,
    monthlyIncome: Number(r.monthly_income ?? 0),
    expenses: JSON.parse(String(r.expenses_json || '[]')) as ExpenseItem[],
    financialGoal: String(r.financial_goal ?? ''),
    targetAmount: Number(r.target_amount ?? 0),
    targetMonths: Number(r.target_months ?? 6),
    currentProblem: String(r.current_problem ?? ''),
    updatedAt: String(r.updated_at),
  }));
}

export function deleteProfileSnapshot(snapshotId: string, sessionId: string): boolean {
  const result = db
    .prepare('DELETE FROM profile_snapshots WHERE id = ? AND session_id = ?')
    .run(snapshotId, sessionId);
  return result.changes > 0;
}

export function upsertProfile(profile: Partial<FinancialProfile> & { sessionId: string }): FinancialProfile {
  const existing = getOrCreateProfile(profile.sessionId);
  const updatedAt = nowIso();
  const recordDate =
    profile.recordDate !== undefined ? sanitizeRecordDate(profile.recordDate) : existing.recordDate;

  const merged: FinancialProfile = {
    sessionId: profile.sessionId,
    fullName: profile.fullName !== undefined ? profile.fullName.trim() : existing.fullName,
    roleType: profile.roleType ?? existing.roleType,
    recordDate,
    monthlyIncome:
      profile.monthlyIncome !== undefined ? Math.max(0, Math.round(Number(profile.monthlyIncome) || 0)) : existing.monthlyIncome,
    expenses: Array.isArray(profile.expenses)
      ? profile.expenses.map((item) => ({
          id: String(item.id || crypto.randomUUID()),
          category: String(item.category || 'Khoản chi khác').trim(),
          amount: Math.max(0, Math.round(Number(item.amount) || 0)),
          isEssential: Boolean(item.isEssential),
        }))
      : existing.expenses,
    financialGoal: profile.financialGoal !== undefined ? profile.financialGoal.trim() : existing.financialGoal,
    targetAmount:
      profile.targetAmount !== undefined ? Math.max(0, Math.round(Number(profile.targetAmount) || 0)) : existing.targetAmount,
    targetMonths:
      profile.targetMonths !== undefined
        ? Math.max(0, Math.min(240, Math.round(Number(profile.targetMonths) || 0)))
        : existing.targetMonths,
    currentProblem: profile.currentProblem !== undefined ? profile.currentProblem.trim() : existing.currentProblem,
    updatedAt,
  };

  db.prepare(
    `UPDATE profiles
     SET full_name = ?, role_type = ?, record_date = ?, monthly_income = ?, expenses_json = ?,
         financial_goal = ?, target_amount = ?, target_months = ?, current_problem = ?, updated_at = ?
     WHERE session_id = ?`
  ).run(
    merged.fullName,
    merged.roleType,
    merged.recordDate,
    merged.monthlyIncome,
    JSON.stringify(merged.expenses),
    merged.financialGoal,
    merged.targetAmount,
    merged.targetMonths,
    merged.currentProblem,
    merged.updatedAt,
    merged.sessionId
  );

  const hasData =
    merged.monthlyIncome > 0 ||
    merged.expenses.some((e) => e.amount > 0) ||
    Boolean(merged.financialGoal) ||
    Boolean(merged.currentProblem);

  if (hasData) {
    upsertProfileSnapshot(merged);
  }

  return merged;
}

export function listConversations(sessionId: string): Conversation[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.session_id, c.title, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
              (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM conversations c
       WHERE c.session_id = ?
       ORDER BY c.updated_at DESC`
    )
    .all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    sessionId: String(r.session_id),
    title: String(r.title),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    messageCount: Number(r.message_count ?? 0),
    lastMessagePreview: r.last_message ? String(r.last_message).replace(/[#*_`]/g, '').slice(0, 180) : '',
  }));
}

export function getConversation(conversationId: string): Conversation | null {
  const row = db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(conversationId) as Record<string, unknown> | undefined;

  if (!row) return null;
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createConversation(sessionId: string, title = 'Phiên tư vấn mới'): Conversation {
  const id = crypto.randomUUID();
  const now = nowIso();
  db.prepare(
    'INSERT INTO conversations (id, session_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, sessionId, title, now, now);

  return {
    id,
    sessionId,
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    lastMessagePreview: '',
  };
}

export function updateConversationTitle(conversationId: string, title: string): void {
  db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(
    title.slice(0, 120),
    nowIso(),
    conversationId
  );
}

export function deleteConversation(conversationId: string, sessionId: string): boolean {
  const result = db
    .prepare('DELETE FROM conversations WHERE id = ? AND session_id = ?')
    .run(conversationId, sessionId);
  return result.changes > 0;
}

export function listMessages(conversationId: string): ChatMessage[] {
  const rows = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conversationId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    conversationId: String(r.conversation_id),
    role: r.role === 'user' ? 'user' : 'assistant',
    content: String(r.content),
    needsMoreInfo: Boolean(r.needs_more_info),
    planId: r.plan_id ? String(r.plan_id) : null,
    createdAt: String(r.created_at),
  }));
}

export function addMessage(params: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  needsMoreInfo?: boolean;
  planId?: string | null;
}): ChatMessage {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, needs_more_info, plan_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.conversationId,
    params.role,
    params.content,
    params.needsMoreInfo ? 1 : 0,
    params.planId ?? null,
    createdAt
  );

  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(createdAt, params.conversationId);

  return {
    id,
    conversationId: params.conversationId,
    role: params.role,
    content: params.content,
    needsMoreInfo: Boolean(params.needsMoreInfo),
    planId: params.planId ?? null,
    createdAt,
  };
}

export function saveFinancialPlan(
  plan: Omit<FinancialPlan, 'id' | 'createdAt'>
): FinancialPlan {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const planDate = sanitizeRecordDate(plan.planDate);

  db.prepare(
    `INSERT INTO financial_plans (
      id, session_id, conversation_id, title, summary, monthly_income, total_expenses,
      recommended_monthly_savings, emergency_fund_target, allocations_json, action_steps_json,
      risks_json, adjustment_guidance, plan_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    plan.sessionId,
    plan.conversationId,
    plan.title,
    plan.summary,
    Math.round(plan.monthlyIncome || 0),
    Math.round(plan.totalExpenses || 0),
    Math.round(plan.recommendedMonthlySavings || 0),
    Math.round(plan.emergencyFundTarget || 0),
    JSON.stringify(plan.allocations || []),
    JSON.stringify(plan.actionSteps || []),
    JSON.stringify(plan.risksAndNotes || []),
    plan.adjustmentGuidance || '',
    planDate,
    createdAt
  );

  return {
    id,
    ...plan,
    planDate,
    createdAt,
  };
}

export function listFinancialPlans(sessionId: string): FinancialPlan[] {
  const rows = db
    .prepare('SELECT * FROM financial_plans WHERE session_id = ? ORDER BY created_at DESC')
    .all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((r) => {
    const createdAt = String(r.created_at);
    const rawPlanDate = String(r.plan_date ?? '').trim();
    return {
      id: String(r.id),
      sessionId: String(r.session_id),
      conversationId: String(r.conversation_id),
      title: String(r.title),
      summary: String(r.summary),
      monthlyIncome: Number(r.monthly_income ?? 0),
      totalExpenses: Number(r.total_expenses ?? 0),
      recommendedMonthlySavings: Number(r.recommended_monthly_savings ?? 0),
      emergencyFundTarget: Number(r.emergency_fund_target ?? 0),
      allocations: JSON.parse(String(r.allocations_json || '[]')),
      actionSteps: JSON.parse(String(r.action_steps_json || '[]')),
      risksAndNotes: JSON.parse(String(r.risks_json || '[]')),
      adjustmentGuidance: String(r.adjustment_guidance ?? ''),
      planDate: rawPlanDate || createdAt.slice(0, 10),
      createdAt,
    };
  });
}

export function deleteFinancialPlan(planId: string, sessionId: string): boolean {
  const result = db
    .prepare('DELETE FROM financial_plans WHERE id = ? AND session_id = ?')
    .run(planId, sessionId);
  return result.changes > 0;
}

export function listTransactions(sessionId: string): TransactionItem[] {
  const rows = db
    .prepare(
      'SELECT * FROM transactions WHERE session_id = ? ORDER BY tx_date DESC, created_at DESC'
    )
    .all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((r) => {
    const rawType = String(r.type || 'expense');
    const type: TransactionType =
      rawType === 'income' ? 'income' : rawType === 'savings' ? 'savings' : 'expense';
    return {
      id: String(r.id),
      sessionId: String(r.session_id),
      txDate: String(r.tx_date),
      type,
      category: String(r.category || 'Khác'),
      amount: Number(r.amount ?? 0),
      note: String(r.note ?? ''),
      createdAt: String(r.created_at),
    };
  });
}

export function createTransaction(input: {
  sessionId: string;
  txDate?: string;
  type: TransactionType;
  category: string;
  amount: number;
  note?: string;
}): TransactionItem {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const txDate = sanitizeRecordDate(input.txDate);
  const type: TransactionType =
    input.type === 'income' ? 'income' : input.type === 'savings' ? 'savings' : 'expense';
  const category = String(input.category || 'Khoản khác').trim().slice(0, 80) || 'Khoản khác';
  const amount = Math.max(0, Math.round(Number(input.amount) || 0));
  const note = String(input.note || '').trim().slice(0, 200);

  db.prepare(
    `INSERT INTO transactions (id, session_id, tx_date, type, category, amount, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.sessionId, txDate, type, category, amount, note, createdAt);

  return {
    id,
    sessionId: input.sessionId,
    txDate,
    type,
    category,
    amount,
    note,
    createdAt,
  };
}

export function createTransactionsBatch(
  sessionId: string,
  items: Array<{
    txDate?: string;
    type: TransactionType;
    category: string;
    amount: number;
    note?: string;
  }>
): TransactionItem[] {
  const created: TransactionItem[] = [];
  const insertStmt = db.prepare(
    `INSERT INTO transactions (id, session_id, tx_date, type, category, amount, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const runBatch = db.transaction(() => {
    for (const item of items) {
      const amount = Math.max(0, Math.round(Number(item.amount) || 0));
      if (amount <= 0) continue;
      const id = crypto.randomUUID();
      const createdAt = nowIso();
      const txDate = sanitizeRecordDate(item.txDate);
      const type: TransactionType =
        item.type === 'income' ? 'income' : item.type === 'savings' ? 'savings' : 'expense';
      const category = String(item.category || 'Khoản khác').trim().slice(0, 80) || 'Khoản khác';
      const note = String(item.note || '').trim().slice(0, 200);

      insertStmt.run(id, sessionId, txDate, type, category, amount, note, createdAt);
      created.push({
        id,
        sessionId,
        txDate,
        type,
        category,
        amount,
        note,
        createdAt,
      });
    }
  });

  runBatch();
  return created;
}

export function deleteTransaction(txId: string, sessionId: string): boolean {
  const result = db
    .prepare('DELETE FROM transactions WHERE id = ? AND session_id = ?')
    .run(txId, sessionId);
  return result.changes > 0;
}

export function checkDbHealth(): boolean {
  const row = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
  return row?.ok === 1;
}
