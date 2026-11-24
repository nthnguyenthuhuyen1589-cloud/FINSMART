export type UserRoleType = 'Sinh viên' | 'Người mới đi làm' | 'Tự do / Khác';

export type AdvisoryMode =
  | 'general'
  | 'cut_expenses'
  | 'emergency_fund'
  | 'savings_goal'
  | 'loan_check'
  | 'debt_recovery';

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
  source?: ConsultationSource;
  provider?: ConsultationProvider;
  createdAt: string;
}

export type ConsultationSource = 'ai' | 'rules';

export type ConsultationProvider = 'Gemini' | 'RulesEngine';

export interface ProviderStatusInfo {
  source: ConsultationSource;
  provider: ConsultationProvider;
  aiEnabled: boolean;
  fallbackUsed: boolean;
  notice: string | null;
}

export interface AiProvidersAvailability {
  geminiConfigured: boolean;
  anyAiConfigured: boolean;
  primaryProvider: 'Gemini' | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  needsMoreInfo?: boolean;
  planId?: string | null;
  source?: ConsultationSource;
  provider?: ConsultationProvider;
  fallbackNotice?: string | null;
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
