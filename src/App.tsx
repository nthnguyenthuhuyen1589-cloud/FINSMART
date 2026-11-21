import {
  BarChart3,
  BookOpen,
  History,
  MessageSquarePlus,
  MessageSquareText,
  TrendingUp,
} from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { ChatWorkspace } from './components/ChatWorkspace.tsx';
import { DisclaimerBanner } from './components/DisclaimerBanner.tsx';
import { FinancialGuideView } from './components/FinancialGuideView.tsx';
import { FinancialPlansView } from './components/FinancialPlansView.tsx';
import { FinancialProfilePanel } from './components/FinancialProfilePanel.tsx';
import { FinancialTrackerView } from './components/FinancialTrackerView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import type {
  ChatMessage,
  Conversation,
  FinancialPlan,
  FinancialProfile,
  ProfileSnapshot,
  TransactionItem,
  TransactionType,
  WorkspaceData,
} from './types.ts';
import { getOrCreateSessionId, todayIsoDate } from './utils/format.ts';

type ActiveTab = 'consult' | 'tracker' | 'plans' | 'guide' | 'history';
type MobilePane = 'chat' | 'profile';

const EMPTY_PROFILE: FinancialProfile = {
  sessionId: 'default-workspace',
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

export default function App() {
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [activeTab, setActiveTab] = useState<ActiveTab>('consult');
  const [mobilePane, setMobilePane] = useState<MobilePane>('chat');

  const [profile, setProfile] = useState<FinancialProfile>(EMPTY_PROFILE);
  const [snapshots, setSnapshots] = useState<ProfileSnapshot[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWorkspace = useCallback(
    async (convId?: string | null) => {
      try {
        setErrorMessage(null);
        const query = new URLSearchParams({ sessionId });
        if (convId) query.set('conversationId', convId);

        const res = await fetch(`/api/workspace?${query.toString()}`);
        if (!res.ok) {
          throw new Error('Không thể tải dữ liệu lúc này.');
        }
        const data = (await res.json()) as WorkspaceData;
        setProfile(data.profile);
        setSnapshots(data.snapshots ?? []);
        setTransactions(data.transactions ?? []);
        setConversations(data.conversations);
        setActiveConversationId(data.activeConversationId);
        setMessages(data.messages);
        setPlans(data.plans);
        if (data.plans.length > 0) {
          setSelectedPlanId((prev) => prev ?? data.plans[0].id);
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Lỗi kết nối dữ liệu.');
      } finally {
        setIsLoadingWorkspace(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

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
      setMessages((prev) => {
        const sameConv = activeConversationId === data.conversation.id;
        return sameConv
          ? [...prev, data.userMessage, data.assistantMessage]
          : [data.userMessage, data.assistantMessage];
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

  const handleSendMessage = async (text: string) => {
    setIsSending(true);
    setErrorMessage(null);

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

      setActiveConversationId(data.conversation.id);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        data.userMessage,
        data.assistantMessage,
      ]);

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
      setActiveTab('consult');
      setMobilePane('chat');
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const query = new URLSearchParams({ sessionId });
    const res = await fetch(`/api/conversations/${conversationId}?${query.toString()}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const nextList = conversations.filter((c) => c.id !== conversationId);
      setConversations(nextList);
      if (activeConversationId === conversationId) {
        const nextActive = nextList[0]?.id ?? null;
        setActiveConversationId(nextActive);
        if (nextActive) {
          await handleSelectConversation(nextActive);
        } else {
          setMessages([]);
        }
      }
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

  const handleGoToChat = (prefillPrompt?: string) => {
    setActiveTab('consult');
    setMobilePane('chat');
    if (prefillPrompt) {
      void handleSendMessage(prefillPrompt);
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
              className="hidden md:flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm font-medium"
            >
              <button
                type="button"
                onClick={() => setActiveTab('consult')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'consult'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <MessageSquareText className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Tư vấn tài chính</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tracker')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'tracker'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Theo dõi thu chi</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('plans')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'plans'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Kế hoạch & Báo cáo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
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
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-amber-50 text-[#0F766E] font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                <History className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Lịch sử tư vấn</span>
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
              onClick={() => setActiveTab('consult')}
              className={`px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'consult'
                  ? 'bg-amber-50 text-[#0F766E] font-semibold'
                  : 'text-stone-600'
              }`}
            >
              Tư vấn tài chính
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
              Theo dõi ({snapshots.length})
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
          ) : activeTab === 'consult' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <div className={mobilePane === 'profile' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}>
                <FinancialProfilePanel
                  profile={profile}
                  snapshots={snapshots}
                  onChange={setProfile}
                  onSaveProfile={handleSaveProfile}
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
                  onSendMessage={handleSendMessage}
                  onNewConversation={handleNewConversation}
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
            <FinancialGuideView onAskScenario={(prompt) => handleGoToChat(prompt)} />
          ) : (
            <HistoryView
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              onNewConversation={handleNewConversation}
            />
          )}
        </main>
      </div>
    </MotionConfig>
  );
}
