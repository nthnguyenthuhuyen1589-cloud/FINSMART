import {
  BarChart3,
  BookOpen,
  History,
  LayoutGrid,
  MessageSquarePlus,
  MessageSquareText,
  Target,
  TrendingUp,
} from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatWorkspace } from './components/ChatWorkspace.tsx';
import { DisclaimerBanner } from './components/DisclaimerBanner.tsx';
import { FinancialGuideView } from './components/FinancialGuideView.tsx';
import { FinancialPlansView } from './components/FinancialPlansView.tsx';
import { FinancialProfilePanel } from './components/FinancialProfilePanel.tsx';
import { FinancialTrackerView } from './components/FinancialTrackerView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { OverviewDashboardView } from './components/OverviewDashboardView.tsx';
import { SavingsGoalsView } from './components/SavingsGoalsView.tsx';
import type {
  AdvisoryMode,
  ChatMessage,
  Conversation,
  FinancialPlan,
  FinancialProfile,
  ProfileSnapshot,
  TransactionItem,
  TransactionType,
  WorkspaceData,
} from './types.ts';
import {
  clearDeviceChatHistory,
  clearDeviceProfileCache,
  clearDeviceTransactionsCache,
  clearEntireDeviceWorkspace,
  hasSavedProfileData,
  loadDeviceWorkspace,
  saveDeviceWorkspace,
} from './utils/deviceStorage.ts';
import { getOrCreateSessionId, todayIsoDate } from './utils/format.ts';

type ActiveTab = 'overview' | 'consult' | 'tracker' | 'goals' | 'plans' | 'guide' | 'history';
type MobilePane = 'chat' | 'profile';

function createEmptyProfile(sessionId: string): FinancialProfile {
  return {
    sessionId,
    fullName: '',
    roleType: 'Sinh viên',
    recordDate: todayIsoDate(),
    monthlyIncome: 0,
    expenses: [],
    financialGoal: '',
    targetAmount: 0,
    targetMonths: 0,
    currentProblem: '',
    updatedAt: new Date().toISOString(),
  };
}

export default function App() {
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [activeTab, setActiveTab] = useState<ActiveTab>('consult');
  const [mobilePane, setMobilePane] = useState<MobilePane>('chat');
  const [advisoryMode, setAdvisoryMode] = useState<AdvisoryMode>('general');

  const [profile, setProfile] = useState<FinancialProfile>(() => createEmptyProfile(sessionId));
  const [snapshots, setSnapshots] = useState<ProfileSnapshot[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [isResettingProfile, setIsResettingProfile] = useState(false);
  const [isResettingTransactions, setIsResettingTransactions] = useState(false);
  const [isResettingSystem, setIsResettingSystem] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadWorkspace = useCallback(
    async (convId?: string | null) => {
      const localCache = loadDeviceWorkspace(sessionId);
      try {
        setErrorMessage(null);
        const query = new URLSearchParams({ sessionId });
        if (convId) query.set('conversationId', convId);

        const res = await fetch(`/api/workspace?${query.toString()}`);
        if (!res.ok) {
          throw new Error('Không thể tải dữ liệu lúc này.');
        }
        const data = (await res.json()) as WorkspaceData;

        const hasServerData =
          data.conversations.length > 0 ||
          hasSavedProfileData(data.profile) ||
          (data.transactions?.length ?? 0) > 0 ||
          (data.snapshots?.length ?? 0) > 0 ||
          data.plans.length > 0;

        const hasLocalData = Boolean(
          localCache &&
            (localCache.conversations.length > 0 ||
              hasSavedProfileData(localCache.profile) ||
              localCache.transactions.length > 0 ||
              localCache.snapshots.length > 0 ||
              localCache.plans.length > 0)
        );

        if (!hasServerData && localCache && hasLocalData) {
          const restoredActiveId =
            convId && localCache.conversations.some((c) => c.id === convId)
              ? convId
              : localCache.activeConversationId ?? localCache.conversations[0]?.id ?? null;

          setProfile(localCache.profile ?? createEmptyProfile(sessionId));
          setSnapshots(localCache.snapshots);
          setTransactions(localCache.transactions);
          setConversations(localCache.conversations);
          setActiveConversationId(restoredActiveId);
          setMessagesByConversation(localCache.messagesByConversation);
          setMessages(
            restoredActiveId ? (localCache.messagesByConversation[restoredActiveId] ?? []) : []
          );
          setPlans(localCache.plans);
          if (localCache.plans.length > 0) {
            setSelectedPlanId((prev) => prev ?? localCache.plans[0].id);
          }

          if (hasSavedProfileData(localCache.profile)) {
            void fetch('/api/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...localCache.profile, sessionId }),
            }).catch(() => undefined);
          }
          if (localCache.transactions.length > 0) {
            void fetch('/api/transactions/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, items: localCache.transactions }),
            }).catch(() => undefined);
          }
        } else {
          setProfile(data.profile);
          setSnapshots(data.snapshots ?? []);
          setTransactions(data.transactions ?? []);
          setConversations(data.conversations);
          setActiveConversationId(data.activeConversationId);
          setMessages(data.messages);
          setMessagesByConversation((prev) => {
            const base = { ...(localCache?.messagesByConversation ?? {}), ...prev };
            if (data.activeConversationId) {
              base[data.activeConversationId] = data.messages;
            }
            return base;
          });
          setPlans(data.plans);
          if (data.plans.length > 0) {
            setSelectedPlanId((prev) => prev ?? data.plans[0].id);
          }
        }
      } catch (err) {
        if (localCache) {
          const fallbackActiveId =
            localCache.activeConversationId ?? localCache.conversations[0]?.id ?? null;
          setProfile(localCache.profile ?? createEmptyProfile(sessionId));
          setSnapshots(localCache.snapshots);
          setTransactions(localCache.transactions);
          setConversations(localCache.conversations);
          setActiveConversationId(fallbackActiveId);
          setMessagesByConversation(localCache.messagesByConversation);
          setMessages(
            fallbackActiveId ? (localCache.messagesByConversation[fallbackActiveId] ?? []) : []
          );
          setPlans(localCache.plans);
          if (localCache.plans.length > 0) {
            setSelectedPlanId((prev) => prev ?? localCache.plans[0].id);
          }
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Lỗi kết nối dữ liệu.');
        }
      } finally {
        hasLoadedRef.current = true;
        setIsLoadingWorkspace(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveDeviceWorkspace({
      sessionId,
      profile,
      snapshots,
      transactions,
      conversations,
      activeConversationId,
      messagesByConversation,
      plans,
      updatedAt: new Date().toISOString(),
    });
  }, [
    sessionId,
    profile,
    snapshots,
    transactions,
    conversations,
    activeConversationId,
    messagesByConversation,
    plans,
  ]);

  const handleSaveProfile = async (profileToSave: FinancialProfile) => {
    setErrorMessage(null);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profileToSave, sessionId }),
    });
    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || 'Không thể lưu hồ sơ tài chính.');
    }
    const data = (await res.json()) as {
      profile: FinancialProfile;
      snapshots?: ProfileSnapshot[];
    };
    setProfile(data.profile);
    if (data.snapshots) {
      setSnapshots(data.snapshots);
    }
  };

  const handleSelectSnapshot = (snapshot: ProfileSnapshot) => {
    setProfile({
      sessionId: snapshot.sessionId,
      fullName: snapshot.fullName,
      roleType: snapshot.roleType,
      recordDate: snapshot.recordDate,
      monthlyIncome: snapshot.monthlyIncome,
      expenses: snapshot.expenses,
      financialGoal: snapshot.financialGoal,
      targetAmount: snapshot.targetAmount,
      targetMonths: snapshot.targetMonths,
      currentProblem: snapshot.currentProblem,
      updatedAt: snapshot.updatedAt,
    });
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    const query = new URLSearchParams({ sessionId });
    const res = await fetch(`/api/snapshots/${snapshotId}?${query.toString()}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = (await res.json()) as { snapshots?: ProfileSnapshot[] };
      if (data.snapshots) {
        setSnapshots(data.snapshots);
      } else {
        setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      }
    }
  };

  const handleCreateTransaction = async (input: {
    txDate: string;
    type: TransactionType;
    category: string;
    amount: number;
    note: string;
  }) => {
    setErrorMessage(null);
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, sessionId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      transactions?: TransactionItem[];
    };
    if (!res.ok) {
      throw new Error(data.error || 'Không thể lưu giao dịch.');
    }
    if (data.transactions) {
      setTransactions(data.transactions);
    }
  };

  const handleCreateTransactionsBatch = async (
    items: Array<{
      txDate: string;
      type: TransactionType;
      category: string;
      amount: number;
      note: string;
    }>
  ) => {
    setErrorMessage(null);
    const res = await fetch('/api/transactions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, sessionId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      transactions?: TransactionItem[];
    };
    if (!res.ok) {
      throw new Error(data.error || 'Không thể lưu danh sách giao dịch.');
    }
    if (data.transactions) {
      setTransactions(data.transactions);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    const query = new URLSearchParams({ sessionId });
    const res = await fetch(`/api/transactions/${txId}?${query.toString()}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = (await res.json()) as { transactions?: TransactionItem[] };
      if (data.transactions) {
        setTransactions(data.transactions);
      } else {
        setTransactions((prev) => prev.filter((t) => t.id !== txId));
      }
    }
  };

  const handleAnalyzeProfile = async (
    profileToAnalyze: FinancialProfile,
    isReanalysis: boolean
  ) => {
    setIsSending(true);
    setErrorMessage(null);
    setMobilePane('chat');

    try {
      const res = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          profile: profileToAnalyze,
          conversationId: activeConversationId,
          isReanalysis,
          advisoryMode,
          clientTransactions: transactions,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        profile: FinancialProfile;
        snapshots?: ProfileSnapshot[];
        conversation: Conversation;
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
        plan: FinancialPlan | null;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Chưa thể phân tích hồ sơ lúc này, bạn vui lòng thử lại nhé.');
      }

      setProfile(data.profile);
      if (data.snapshots) {
        setSnapshots(data.snapshots);
      }
      setActiveConversationId(data.conversation.id);
      const nextConvMessages =
        activeConversationId === data.conversation.id
          ? [...messages, data.userMessage, data.assistantMessage]
          : [data.userMessage, data.assistantMessage];
      setMessages(nextConvMessages);
      setMessagesByConversation((prev) => ({
        ...prev,
        [data.conversation.id]: nextConvMessages,
      }));
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === data.conversation.id);
        return exists
          ? prev.map((c) => (c.id === data.conversation.id ? data.conversation : c))
          : [data.conversation, ...prev];
      });

      if (data.plan) {
        setPlans((prev) => [data.plan!, ...prev]);
        setSelectedPlanId(data.plan.id);
      }

      await loadWorkspace(data.conversation.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Chưa thể phân tích hồ sơ lúc này.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (text: string, overrideMode?: AdvisoryMode) => {
    const modeToUse = overrideMode ?? advisoryMode;
    setIsSending(true);
    setErrorMessage(null);

    const historySnapshot = messages
      .filter((m) => !m.id.startsWith('temp-'))
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      conversationId: activeConversationId || 'pending',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text,
          conversationId: activeConversationId,
          advisoryMode: modeToUse,
          clientHistory: historySnapshot,
          clientProfile: profile,
          clientTransactions: transactions,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        conversation: Conversation;
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
        plan: FinancialPlan | null;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Không thể gửi tin nhắn tới chuyên gia tư vấn.');
      }

      const persistedMessages = [
        ...messages.filter((m) => !m.id.startsWith('temp-')),
        data.userMessage,
        data.assistantMessage,
      ];
      setActiveConversationId(data.conversation.id);
      setMessages(persistedMessages);
      setMessagesByConversation((prev) => ({
        ...prev,
        [data.conversation.id]: persistedMessages,
      }));
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === data.conversation.id);
        return exists
          ? prev.map((c) => (c.id === data.conversation.id ? data.conversation : c))
          : [data.conversation, ...prev];
      });

      if (data.plan) {
        setPlans((prev) => [data.plan!, ...prev]);
        setSelectedPlanId(data.plan.id);
      }

      const wsQuery = new URLSearchParams({ sessionId, conversationId: data.conversation.id });
      const wsRes = await fetch(`/api/workspace?${wsQuery.toString()}`);
      if (wsRes.ok) {
        const wsData = (await wsRes.json()) as WorkspaceData;
        setConversations(wsData.conversations);
        setPlans(wsData.plans);
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể kết nối tới chuyên gia tư vấn lúc này, bạn vui lòng thử lại nhé.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleNewConversation = async () => {
    setErrorMessage(null);
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, title: 'Phiên tư vấn mới' }),
    });
    if (res.ok) {
      const data = (await res.json()) as { conversation: Conversation };
      setActiveConversationId(data.conversation.id);
      setMessages([]);
      setMessagesByConversation((prev) => ({
        ...prev,
        [data.conversation.id]: [],
      }));
      setConversations((prev) => [data.conversation, ...prev]);
      setActiveTab('consult');
      setMobilePane('chat');
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    setErrorMessage(null);
    const query = new URLSearchParams({ sessionId });
    const res = await fetch(`/api/conversations/${conversationId}/messages?${query.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as {
        conversation: Conversation;
        messages: ChatMessage[];
      };
      setActiveConversationId(data.conversation.id);
      setMessages(data.messages);
      setMessagesByConversation((prev) => ({
        ...prev,
        [data.conversation.id]: data.messages,
      }));
      setActiveTab('consult');
      setMobilePane('chat');
      return;
    }

    const cachedMessages = messagesByConversation[conversationId] ?? [];
    setActiveConversationId(conversationId);
    setMessages(cachedMessages);
    setActiveTab('consult');
    setMobilePane('chat');
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const query = new URLSearchParams({ sessionId });
    await fetch(`/api/conversations/${conversationId}?${query.toString()}`, {
      method: 'DELETE',
    }).catch(() => undefined);

    const nextList = conversations.filter((c) => c.id !== conversationId);
    setConversations(nextList);
    setMessagesByConversation((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
    if (activeConversationId === conversationId) {
      const nextActive = nextList[0]?.id ?? null;
      setActiveConversationId(nextActive);
      if (nextActive) {
        await handleSelectConversation(nextActive);
      } else {
        setMessages([]);
      }
    }
  };

  const handleClearAllHistory = async () => {
    setIsClearingHistory(true);
    setErrorMessage(null);
    try {
      const query = new URLSearchParams({ sessionId });
      await fetch(`/api/chat-history?${query.toString()}`, {
        method: 'DELETE',
      }).catch(() => undefined);

      clearDeviceChatHistory(sessionId);
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      setMessagesByConversation({});
    } finally {
      setIsClearingHistory(false);
    }
  };

  const handleResetProfile = async () => {
    setIsResettingProfile(true);
    setErrorMessage(null);
    try {
      const query = new URLSearchParams({ sessionId });
      const res = await fetch(`/api/profile?${query.toString()}`, {
        method: 'DELETE',
      }).catch(() => null);

      let freshProfile = createEmptyProfile(sessionId);
      if (res && res.ok) {
        const data = (await res.json()) as { profile?: FinancialProfile };
        if (data.profile) {
          freshProfile = data.profile;
        }
      }

      clearDeviceProfileCache(sessionId, freshProfile);
      setProfile(freshProfile);
      setSnapshots([]);
    } finally {
      setIsResettingProfile(false);
    }
  };

  const handleResetTransactions = async (type?: TransactionType) => {
    setIsResettingTransactions(true);
    setErrorMessage(null);
    try {
      const query = new URLSearchParams({ sessionId });
      if (type) query.set('type', type);
      const res = await fetch(`/api/transactions?${query.toString()}`, {
        method: 'DELETE',
      }).catch(() => null);

      if (res && res.ok) {
        const data = (await res.json()) as { transactions?: TransactionItem[] };
        if (Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        } else {
          setTransactions((prev) => (type ? prev.filter((t) => t.type !== type) : []));
        }
      } else {
        setTransactions((prev) => (type ? prev.filter((t) => t.type !== type) : []));
      }

      clearDeviceTransactionsCache(sessionId, type);
    } finally {
      setIsResettingTransactions(false);
    }
  };

  const handleResetAllSystem = async () => {
    setIsResettingSystem(true);
    setErrorMessage(null);
    try {
      const query = new URLSearchParams({ sessionId });
      const res = await fetch(`/api/workspace?${query.toString()}`, {
        method: 'DELETE',
      }).catch(() => null);

      let freshProfile = createEmptyProfile(sessionId);
      if (res && res.ok) {
        const data = (await res.json()) as { profile?: FinancialProfile };
        if (data.profile) {
          freshProfile = data.profile;
        }
      }

      clearEntireDeviceWorkspace(sessionId);
      setProfile(freshProfile);
      setSnapshots([]);
      setTransactions([]);
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      setMessagesByConversation({});
      setPlans([]);
      setSelectedPlanId(null);
    } finally {
      setIsResettingSystem(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    const query = new URLSearchParams({ sessionId });
    const res = await fetch(`/api/plans/${planId}?${query.toString()}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const nextPlans = plans.filter((p) => p.id !== planId);
      setPlans(nextPlans);
      if (selectedPlanId === planId) {
        setSelectedPlanId(nextPlans[0]?.id ?? null);
      }
    }
  };

  const handleOpenPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setActiveTab('plans');
  };

  const handleGoToChat = (prefillPrompt?: string, mode?: AdvisoryMode) => {
    if (mode) {
      setAdvisoryMode(mode);
    }
    setActiveTab('consult');
    setMobilePane('chat');
    if (prefillPrompt) {
      void handleSendMessage(prefillPrompt, mode);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-[#FAF8F5] text-[#1F2937] flex flex-col overflow-x-hidden">
        {/* Warm ambient sunlit glow (purely decorative, non-blocking) */}
        <div
          aria-hidden="true"
          className="no-print pointer-events-none fixed inset-0 overflow-hidden z-0"
        >
          <div className="absolute -top-40 -left-32 h-[420px] w-[420px] rounded-full bg-amber-200/30 blur-3xl" />
          <div className="absolute top-24 right-[-120px] h-[380px] w-[380px] rounded-full bg-emerald-200/25 blur-3xl" />
          <div className="absolute bottom-[-140px] left-1/3 h-[360px] w-[360px] rounded-full bg-orange-100/40 blur-3xl" />
        </div>

        {/* Top Bar Contract: Brand — Nav Links — 1 Primary Action */}
        <header className="sticky top-0 z-30 bg-[#FFFCF7]/90 backdrop-blur-xl border-b border-stone-200/80 shadow-[0_2px_14px_-4px_rgba(28,25,23,0.06)]">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
            {/* Zone 1: Single-line Brand Wordmark */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('consult');
              }}
              className="text-lg font-bold tracking-tight text-[#1F2937] whitespace-nowrap shrink-0 flex items-center gap-2.5 group"
            >
              <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#059669] to-[#0D9488] flex items-center justify-center shadow-sm shadow-[#059669]/20 group-hover:scale-105 transition-transform duration-200">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <path
                    d="M5 16L9.5 11.5L13 14.5L19 8"
                    stroke="#FFFFFF"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M15 8H19V12"
                    stroke="#FEF3C7"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-[#1F2937]">FINSMART</span>
            </a>

            {/* Zone 2: Concise single-line navigation links */}
            <nav
              aria-label="Điều hướng chính"
              className="hidden md:flex items-center gap-1 text-xs lg:text-sm font-medium overflow-x-auto no-scrollbar"
            >
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Tổng quan</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('consult')}
                className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'consult'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <MessageSquareText className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Tư vấn</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tracker')}
                className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'tracker'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Thu chi</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('goals')}
                className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'goals'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <Target className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Mục tiêu & Quỹ</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('plans')}
                className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'plans'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Kế hoạch</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'guide'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Cẩm nang</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <History className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Lịch sử</span>
              </button>
            </nav>

            {/* Zone 3: Single Primary Action */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => void handleNewConversation()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] shadow-md shadow-[#059669]/20 hover:shadow-lg hover:shadow-[#059669]/25 hover:-translate-y-0.5 active:scale-[0.98] rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                <span>Tư vấn mới</span>
              </button>
            </div>
          </div>

          {/* Mobile Tab Navigation */}
          <div className="md:hidden border-t border-stone-100 px-3 py-1.5 flex items-center gap-1 overflow-x-auto bg-[#FFFCF7]/95">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'overview'
                  ? 'bg-amber-50 text-[#0F766E] font-semibold'
                  : 'text-stone-600'
              }`}
            >
              Tổng quan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('consult')}
              className={`px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'consult'
                  ? 'bg-amber-50 text-[#0F766E] font-semibold'
                  : 'text-stone-600'
              }`}
            >
              Tư vấn
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tracker')}
              className={`px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'tracker'
                  ? 'bg-amber-50 text-[#0F766E] font-semibold'
                  : 'text-stone-600'
              }`}
            >
              Thu chi ({snapshots.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('goals')}
              className={`px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'goals'
                  ? 'bg-amber-50 text-[#0F766E] font-semibold'
                  : 'text-stone-600'
              }`}
            >
              Mục tiêu & Quỹ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className={`px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'plans'
                  ? 'bg-amber-50 text-[#0F766E] font-semibold'
                  : 'text-stone-600'
              }`}
            >
              Kế hoạch ({plans.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'guide'
                  ? 'bg-amber-50 text-[#0F766E] font-semibold'
                  : 'text-stone-600'
              }`}
            >
              Cẩm nang
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'history'
                  ? 'bg-amber-50 text-[#0F766E] font-semibold'
                  : 'text-stone-600'
              }`}
            >
              Lịch sử ({conversations.length})
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main
          id="top"
          className="relative z-10 flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5"
        >
          {/* Trang chủ: Giới thiệu ngắn gọn + Cảnh báo bắt buộc */}
          {activeTab === 'consult' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="no-print flex flex-col gap-3"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight">
                    <span className="text-[#0F766E]">FINSMART</span>{' '}
                    – Chuyên gia tư vấn tài chính cá nhân
                  </h1>
                  <p className="text-xs sm:text-sm text-stone-600 mt-1">
                    Đồng hành cùng bạn cân đối thu chi, tối ưu tiết kiệm và xây dựng kế hoạch tài chính cá nhân phù hợp.
                  </p>
                </div>

                {/* Mobile switcher between Chat and Profile */}
                <div className="lg:hidden flex items-center gap-1 p-1 bg-[#F3EDE2] border border-amber-200/70 rounded-xl self-start">
                  <button
                    type="button"
                    onClick={() => setMobilePane('chat')}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                      mobilePane === 'chat'
                        ? 'bg-[#FFFEFC] text-[#0F766E] font-semibold shadow-sm'
                        : 'text-stone-600 hover:text-[#1F2937]'
                    }`}
                  >
                    Trò chuyện tư vấn
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePane('profile')}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                      mobilePane === 'profile'
                        ? 'bg-[#FFFEFC] text-[#0F766E] font-semibold shadow-sm'
                        : 'text-stone-600 hover:text-[#1F2937]'
                    }`}
                  >
                    Hồ sơ tài chính
                  </button>
                </div>
              </div>

              {mobilePane === 'profile' && (
                <div className="lg:hidden">
                  <DisclaimerBanner compact />
                </div>
              )}
            </motion.div>
          )}

          {isLoadingWorkspace ? (
            <div className="bg-[#FFFEFC]/95 border border-stone-200/90 rounded-2xl p-10 text-center text-sm text-stone-500 shadow-sm">
              Đang chuẩn bị không gian tài chính của bạn...
            </div>
          ) : activeTab === 'overview' ? (
            <OverviewDashboardView
              profile={profile}
              snapshots={snapshots}
              transactions={transactions}
              plans={plans}
              conversations={conversations}
              onNavigateTab={(tab, pane) => {
                setActiveTab(tab);
                if (pane) setMobilePane(pane);
              }}
              onAskAdvisor={(prompt) => handleGoToChat(prompt)}
            />
          ) : activeTab === 'consult' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <div className={mobilePane === 'profile' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}>
                <FinancialProfilePanel
                  profile={profile}
                  snapshots={snapshots}
                  onChange={setProfile}
                  onSaveProfile={handleSaveProfile}
                  onResetProfile={handleResetProfile}
                  isResettingProfile={isResettingProfile || isResettingSystem}
                  onSelectSnapshot={handleSelectSnapshot}
                  onDeleteSnapshot={handleDeleteSnapshot}
                  onAnalyze={handleAnalyzeProfile}
                  isAnalyzing={isSending}
                  hasExistingMessages={messages.length > 0}
                />
              </div>

              <div className={mobilePane === 'chat' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}>
                <ChatWorkspace
                  messages={messages}
                  plans={plans}
                  isSending={isSending}
                  errorMessage={errorMessage}
                  advisoryMode={advisoryMode}
                  onChangeAdvisoryMode={setAdvisoryMode}
                  onSendMessage={handleSendMessage}
                  onNewConversation={handleNewConversation}
                  onClearHistory={handleClearAllHistory}
                  isClearingHistory={isClearingHistory || isResettingSystem}
                  onOpenPlan={handleOpenPlan}
                />
              </div>
            </div>
          ) : activeTab === 'tracker' ? (
            <FinancialTrackerView
              profile={profile}
              snapshots={snapshots}
              transactions={transactions}
              plans={plans}
              onCreateTransaction={handleCreateTransaction}
              onCreateTransactionsBatch={handleCreateTransactionsBatch}
              onDeleteTransaction={handleDeleteTransaction}
              onResetTransactions={handleResetTransactions}
              isResettingTransactions={isResettingTransactions || isResettingSystem}
              onLoadSnapshotToProfile={(snap) => {
                handleSelectSnapshot(snap);
                setActiveTab('consult');
                setMobilePane('profile');
              }}
              onDeleteSnapshot={handleDeleteSnapshot}
              onGoToConsult={() => {
                setActiveTab('consult');
                setMobilePane('profile');
              }}
              onAskAdvisor={(prompt) => handleGoToChat(prompt)}
            />
          ) : activeTab === 'goals' ? (
            <SavingsGoalsView
              profile={profile}
              transactions={transactions}
              onCreateTransaction={handleCreateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onResetSavings={() => handleResetTransactions('savings')}
              isResetting={isResettingTransactions || isResettingSystem}
              onAskAdvisor={(prompt, mode) => handleGoToChat(prompt, mode)}
            />
          ) : activeTab === 'plans' ? (
            <FinancialPlansView
              plans={plans}
              profile={profile}
              selectedPlanId={selectedPlanId}
              onSelectPlan={setSelectedPlanId}
              onDeletePlan={handleDeletePlan}
              onGoToChat={handleGoToChat}
            />
          ) : activeTab === 'guide' ? (
            <FinancialGuideView
              profile={profile}
              onAskScenario={(prompt, mode) => handleGoToChat(prompt, mode)}
            />
          ) : (
            <HistoryView
              sessionId={sessionId}
              conversations={conversations}
              activeConversationId={activeConversationId}
              snapshotsCount={snapshots.length}
              hasProfileData={hasSavedProfileData(profile)}
              transactionsCount={transactions.length}
              savingsCount={transactions.filter((t) => t.type === 'savings').length}
              plansCount={plans.length}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              onResetAllSystem={handleResetAllSystem}
              isClearingHistory={isClearingHistory}
              isResetting={isResettingProfile || isResettingTransactions || isResettingSystem}
              onNewConversation={handleNewConversation}
            />
          )}
        </main>
      </div>
    </MotionConfig>
  );
}
