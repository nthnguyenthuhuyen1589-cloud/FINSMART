export type UserRoleType = 'Sinh viên' | 'Người mới đi làm' | 'Tự do / Khác';

export interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  isEssential: boolean;
}

export interface FinancialProfile {
  sessionId: string;
  fullName: string;
  roleType: UserRoleType;
  recordDate: string; // YYYY-MM-DD
  monthlyIncome: number;
  expenses: ExpenseItem[];
  financialGoal: string;
  targetAmount: number;
  targetMonths: number;
  currentProblem: string;
  updatedAt: string;
}

export interface ProfileSnapshot {
  id: string;
  sessionId: string;
  recordDate: string; // YYYY-MM-DD
  fullName: string;
  roleType: UserRoleType;
  monthlyIncome: number;
  expenses: ExpenseItem[];
  financialGoal: string;
  targetAmount: number;
  targetMonths: number;
  currentProblem: string;
  updatedAt: string;
}

export interface PlanAllocation {
  category: string;
  group: 'Thiết yếu' | 'Cá nhân & Linh hoạt' | 'Tiết kiệm & Dự phòng';
  amount: number;
  percentage: number;
  rationale: string;
}

export interface PlanActionStep {
  timeframe: string;
  title: string;
  detail: string;
}

export interface FinancialPlan {
  id: string;
  sessionId: string;
  conversationId: string;
  title: string;
  summary: string;
  monthlyIncome: number;
  totalExpenses: number;
  recommendedMonthlySavings: number;
  emergencyFundTarget: number;
  allocations: PlanAllocation[];
  actionSteps: PlanActionStep[];
  risksAndNotes: string[];
  adjustmentGuidance: string;
  planDate?: string; // YYYY-MM-DD
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  needsMoreInfo?: boolean;
  planId?: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessagePreview?: string;
}

export type TransactionType = 'expense' | 'income' | 'savings';

export interface TransactionItem {
  id: string;
  sessionId: string;
  txDate: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  amount: number;
  note: string;
  createdAt: string;
}

export interface WorkspaceData {
  profile: FinancialProfile;
  snapshots: ProfileSnapshot[];
  transactions: TransactionItem[];
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  plans: FinancialPlan[];
}
