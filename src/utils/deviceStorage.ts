import type {
  ChatMessage,
  Conversation,
  FinancialPlan,
  FinancialProfile,
  ProfileSnapshot,
  TransactionItem,
} from '../types.ts';

export interface DeviceWorkspaceCache {
  sessionId: string;
  profile: FinancialProfile;
  snapshots: ProfileSnapshot[];
  transactions: TransactionItem[];
  conversations: Conversation[];
  activeConversationId: string | null;
  messagesByConversation: Record<string, ChatMessage[]>;
  plans: FinancialPlan[];
  updatedAt: string;
}

function getStorageKey(sessionId: string): string {
  return `finsmart_device_cache_v1_${sessionId}`;
}

export function loadDeviceWorkspace(sessionId: string): DeviceWorkspaceCache | null {
  try {
    const raw = window.localStorage.getItem(getStorageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceWorkspaceCache>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      sessionId,
      profile: parsed.profile as FinancialProfile,
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      activeConversationId:
        typeof parsed.activeConversationId === 'string' ? parsed.activeConversationId : null,
      messagesByConversation:
        parsed.messagesByConversation && typeof parsed.messagesByConversation === 'object'
          ? parsed.messagesByConversation
          : {},
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDeviceWorkspace(cache: DeviceWorkspaceCache): void {
  try {
    window.localStorage.setItem(
      getStorageKey(cache.sessionId),
      JSON.stringify({
        ...cache,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore quota errors gracefully
  }
}

export function clearDeviceChatHistory(sessionId: string): void {
  const existing = loadDeviceWorkspace(sessionId);
  if (!existing) return;
  saveDeviceWorkspace({
    ...existing,
    conversations: [],
    activeConversationId: null,
    messagesByConversation: {},
  });
}

export function clearDeviceProfileCache(
  sessionId: string,
  freshProfile: FinancialProfile
): void {
  const existing = loadDeviceWorkspace(sessionId);
  if (!existing) return;
  saveDeviceWorkspace({
    ...existing,
    profile: freshProfile,
    snapshots: [],
  });
}

export function clearDeviceTransactionsCache(
  sessionId: string,
  type?: 'income' | 'expense' | 'savings'
): void {
  const existing = loadDeviceWorkspace(sessionId);
  if (!existing) return;
  saveDeviceWorkspace({
    ...existing,
    transactions: type
      ? existing.transactions.filter((t) => t.type !== type)
      : [],
  });
}

export function clearEntireDeviceWorkspace(sessionId: string): void {
  try {
    window.localStorage.removeItem(getStorageKey(sessionId));
  } catch {
    // Ignore storage errors gracefully
  }
}

export function hasSavedProfileData(profile?: FinancialProfile | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.fullName?.trim() ||
      profile.monthlyIncome > 0 ||
      profile.expenses.some((e) => e.amount > 0) ||
      profile.financialGoal?.trim() ||
      profile.targetAmount > 0 ||
      profile.currentProblem?.trim()
  );
}
