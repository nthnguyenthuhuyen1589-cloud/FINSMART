import {
  ArrowRight,
  Calculator,
  Compass,
  Cpu,
  FileSpreadsheet,
  Info,
  MessageSquarePlus,
  PiggyBank,
  Scissors,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import advisorAvatar from '../assets/images/advisor_avatar_1794990322481.jpg';
import type {
  AdvisoryMode,
  AiProvidersAvailability,
  ChatMessage,
  FinancialPlan,
  ProviderStatusInfo,
} from '../types.ts';
import { formatDateVi } from '../utils/format.ts';
import { DisclaimerBanner } from './DisclaimerBanner.tsx';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  plans: FinancialPlan[];
  isSending: boolean;
  errorMessage: string | null;
  advisoryMode: AdvisoryMode;
  onChangeAdvisoryMode: (mode: AdvisoryMode) => void;
  aiEnabled: boolean;
  onToggleAi: () => void;
  aiAvailability: AiProvidersAvailability | null;
  lastProviderStatus: ProviderStatusInfo | null;
  onSendMessage: (text: string, overrideMode?: AdvisoryMode) => Promise<void>;
  onNewConversation: () => Promise<void>;
  onClearHistory: () => Promise<void>;
  isClearingHistory?: boolean;
  onOpenPlan: (planId: string) => void;
}

const SUGGESTED_QUESTIONS = [
  'Tôi là sinh viên, mỗi tháng có 4 triệu đồng tiền sinh hoạt. Tôi muốn tiết kiệm nhưng vẫn đảm bảo các nhu cầu thiết yếu. Tôi nên làm thế nào?',
  'Thu nhập 5 triệu đồng/tháng thì nên phân bổ tiền như thế nào cho hợp lý?',
  'Chi tiêu hàng tháng của tôi đang vượt quá thu nhập, tôi cần điều chỉnh ra sao?',
  'Làm thế nào để quản lý tiền khi thường xuyên có nhiều khoản chi phát sinh đột xuất?',
  'Tôi có nên vay tiền để phục vụ nhu cầu cá nhân không?',
  'Làm thế nào để xây dựng kế hoạch tài chính cá nhân phù hợp với thu nhập của tôi?',
];

const ADVISORY_MODES: Array<{
  id: AdvisoryMode;
  label: string;
  quickPrompt: string;
  icon: typeof Compass;
}> = [
  {
    id: 'general',
    label: 'Tổng quát',
    quickPrompt: 'Hãy đánh giá tổng quan thu chi hiện tại của tôi và gợi ý cách phân bổ tối ưu.',
    icon: Compass,
  },
  {
    id: 'cut_expenses',
    label: 'Cắt giảm chi',
    quickPrompt: 'Dựa trên hồ sơ và chi tiêu của tôi, đâu là 3 khoản có thể cắt giảm ngay mà ít ảnh hưởng sinh hoạt nhất?',
    icon: Scissors,
  },
  {
    id: 'emergency_fund',
    label: 'Quỹ dự phòng',
    quickPrompt: 'Hãy tính giúp tôi mục tiêu quỹ dự phòng 3–6 tháng và lộ trình tích lũy từng tuần.',
    icon: ShieldCheck,
  },
  {
    id: 'savings_goal',
    label: 'Mục tiêu tiết kiệm',
    quickPrompt: 'Hãy lập lộ trình chia nhỏ mục tiêu tiết kiệm theo tuần/tháng để tôi dễ duy trì nhất.',
    icon: PiggyBank,
  },
  {
    id: 'loan_check',
    label: 'Đánh giá vay',
    quickPrompt: 'Tôi đang cân nhắc vay hoặc mua trả góp. Hãy phân tích ngưỡng an toàn dựa trên thu nhập hiện tại của tôi.',
    icon: Calculator,
  },
  {
    id: 'debt_recovery',
    label: 'Gỡ rối bội chi',
    quickPrompt: 'Chi tiêu của tôi đang có dấu hiệu vượt thu. Hãy lập phương án khắc phục trong 30 ngày tới.',
    icon: ShieldAlert,
  },
];

const ADVISOR_AVATAR_URL = advisorAvatar;

export function ChatWorkspace({
  messages,
  plans,
  isSending,
  errorMessage,
  advisoryMode,
  onChangeAdvisoryMode,
  aiEnabled,
  onToggleAi,
  aiAvailability,
  lastProviderStatus,
  onSendMessage,
  onNewConversation,
  onClearHistory,
  isClearingHistory = false,
  onOpenPlan,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  useEffect(() => {
    if (messages.length === 0) {
      setShowClearConfirm(false);
    }
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    await onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isSending) return;
      setInput('');
      void onSendMessage(trimmed);
    }
  };

  const findPlanById = (planId?: string | null) =>
    planId ? plans.find((p) => p.id === planId) : undefined;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Khung trò chuyện với chuyên gia tư vấn tài chính"
      className="bg-[#FFFEFC] border border-stone-200/90 shadow-[0_14px_38px_-16px_rgba(28,25,23,0.1)] rounded-2xl flex flex-col min-h-[680px] h-[max(calc(100vh-6rem),700px)] lg:min-h-[840px] lg:h-[max(calc(100vh-5.5rem),840px)] overflow-hidden"
    >
      {/* Advisor Header - Warm Deep Forest Teal */}
      <div className="relative flex items-center justify-between gap-4 px-5 py-3 min-h-[68px] bg-gradient-to-r from-[#134E4A] via-[#115E59] to-[#0F766E] text-white overflow-hidden shrink-0">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-300/15 blur-2xl"
        />
        <div className="relative flex items-center gap-3.5 min-w-0">
          <div className="p-0.5 rounded-full bg-amber-200/80 shrink-0 shadow-sm">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-white flex items-center justify-center">
              {!avatarFailed ? (
                <img
                  src={ADVISOR_AVATAR_URL}
                  alt="Chuyên gia tư vấn FINSMART"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-full w-full object-contain p-0.5"
                />
              ) : (
                <span className="text-sm font-bold text-[#0F766E]">FS</span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white leading-snug">
              Chuyên gia tư vấn FINSMART
            </h2>
            <p className="text-xs text-emerald-100/90 leading-snug mt-0.5">
              Quản lý thu nhập · Tối ưu chi tiêu · Quỹ dự phòng · Kế hoạch cá nhân
            </p>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={aiEnabled}
            onClick={onToggleAi}
            disabled={isSending}
            title={
              aiEnabled
                ? 'AI đang bật (Ưu tiên Gemini AI, tự động chuyển sang Công thức & Quy tắc nếu lỗi hoặc hết hạn mức). Nhấn để tắt AI.'
                : 'AI đang tắt — hệ thống chạy hoàn toàn bằng Công thức & Quy tắc nội bộ. Nhấn để bật AI.'
            }
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 active:scale-[0.98] ${
              aiEnabled
                ? 'bg-emerald-400/20 hover:bg-emerald-400/30 text-white border-emerald-200/50'
                : 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 border-amber-200/45'
            }`}
          >
            {aiEnabled ? (
              <Sparkles className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true" />
            ) : (
              <Calculator className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
            )}
            <span>{aiEnabled ? 'AI: Bật' : 'AI: Tắt'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={isSending || isClearingHistory || messages.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white/95 bg-white/10 hover:bg-red-500/30 border border-white/20 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <Trash2 className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
            <span>Xóa lịch sử</span>
          </button>

          <button
            type="button"
            onClick={onNewConversation}
            disabled={isSending || isClearingHistory}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/12 hover:bg-white/22 border border-white/25 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
            <span>Phiên mới</span>
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <div
          role="alertdialog"
          aria-label="Xác nhận xóa lịch sử trò chuyện"
          className="px-5 py-3 bg-red-50 border-b border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0"
        >
          <p className="text-xs sm:text-sm text-red-800 font-medium">
            Xóa toàn bộ lịch sử trò chuyện đã lưu trên thiết bị này? Thông tin chỉ bị xóa khi bạn xác nhận.
          </p>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              disabled={isClearingHistory}
              className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={async () => {
                await onClearHistory();
                setShowClearConfirm(false);
              }}
              disabled={isClearingHistory}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              {isClearingHistory ? 'Đang xóa...' : 'Xác nhận xóa'}
            </button>
          </div>
        </div>
      )}

      {/* Mandatory Disclaimer + Hybrid Provider Status + Advisory Modes */}
      <div className="px-4 sm:px-5 pt-2.5 pb-2 bg-[#FCF9F4] border-b border-stone-200/70 flex flex-col gap-1.5 shrink-0">
        <DisclaimerBanner compact />

        {/* Active Provider & Mode Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1 rounded-xl bg-white border border-stone-200/80 text-[11px]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                !aiEnabled
                  ? 'bg-amber-500'
                  : lastProviderStatus?.source === 'ai'
                    ? 'bg-emerald-500'
                    : aiAvailability?.anyAiConfigured
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
              }`}
              aria-hidden="true"
            />
            <span className="font-semibold text-[#1F2937] flex items-center gap-1">
              <Cpu className="h-3 w-3 text-[#0F766E] shrink-0" aria-hidden="true" />
              <span>Chế độ hoạt động:</span>
            </span>
            <span className="text-stone-700 font-medium truncate">
              {!aiEnabled
                ? 'Công thức & Quy tắc (AI đang tắt)'
                : lastProviderStatus
                  ? lastProviderStatus.source === 'ai'
                    ? `AI · ${lastProviderStatus.provider}`
                    : 'Công thức & Quy tắc (Dự phòng tự động)'
                  : aiAvailability?.anyAiConfigured
                    ? `AI Sẵn sàng (${aiAvailability.primaryProvider})`
                    : 'Công thức & Quy tắc (Chưa cấu hình API Key Gemini)'}
            </span>
          </div>

          <span className="text-[11px] text-stone-500 whitespace-nowrap">
            {aiEnabled
              ? 'Chế độ: Gemini AI → Công thức dự phòng'
              : 'Không gọi API ngoài · Xử lý 100% theo quy tắc'}
          </span>
        </div>

        {(lastProviderStatus?.notice ||
          (!aiEnabled && !lastProviderStatus?.notice) ||
          (aiEnabled && aiAvailability && !aiAvailability.anyAiConfigured && !lastProviderStatus?.notice)) && (
          <div
            role="status"
            className="flex items-start gap-2 px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-900 leading-snug"
          >
            <Info className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {lastProviderStatus?.notice
                ? lastProviderStatus.notice
                : !aiEnabled
                  ? 'Bạn đã tắt AI. FINSMART đang tư vấn trực tiếp bằng hệ thống Công thức & Quy tắc tài chính dựa trên dữ liệu bạn nhập.'
                  : 'Máy chủ hiện chưa có API Key Gemini — hệ thống tự động dùng Công thức & Quy tắc tài chính mà không bị gián đoạn.'}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-stone-500 whitespace-nowrap shrink-0 mr-1">
            Chủ đề tư vấn:
          </span>
          {ADVISORY_MODES.map((mode) => {
            const Icon = mode.icon;
            const active = advisoryMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onChangeAdvisoryMode(mode.id)}
                disabled={isSending}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#0F766E] text-white border-[#0F766E] shadow-xs font-semibold'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-amber-300 hover:text-[#1F2937]'
                }`}
              >
                <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 bg-[#FCF9F4]">
        {messages.length === 0 ? (
          <div className="my-auto max-w-2xl mx-auto w-full py-3">
            <div className="mb-5 p-5 rounded-2xl bg-gradient-to-br from-amber-50/90 via-[#FFFDF9] to-emerald-50/70 border border-amber-200/70">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-9 w-9 rounded-full overflow-hidden border border-amber-300/80 bg-white shrink-0">
                  {!avatarFailed ? (
                    <img
                      src={ADVISOR_AVATAR_URL}
                      alt="Chuyên gia tư vấn"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                      className="h-full w-full object-contain p-0.5"
                    />
                  ) : (
                    <span className="text-xs font-bold text-[#0F766E] flex h-full w-full items-center justify-center">
                      FS
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#1F2937]">
                  Xin chào, tôi có thể hỗ trợ gì cho tài chính của bạn hôm nay?
                </h3>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed">
                Bạn có thể điền bảng <span className="font-semibold text-[#1F2937]">Hồ sơ tài chính</span> bên cạnh rồi nhấn{' '}
                <span className="font-semibold text-[#059669]">Phân tích và tư vấn</span>, hoặc chọn một tình huống gợi ý bên dưới để trò chuyện ngay.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2.5">
                Câu hỏi tình huống gợi ý
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-stretch">
                {SUGGESTED_QUESTIONS.map((question, idx) => (
                  <motion.button
                    key={idx}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    disabled={isSending}
                    onClick={() => void onSendMessage(question)}
                    className="group h-full text-left p-3.5 rounded-xl border border-stone-200/90 bg-white hover:border-amber-300 hover:bg-amber-50/35 hover:shadow-md hover:shadow-amber-900/5 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 text-xs sm:text-sm text-stone-700 leading-relaxed flex items-start justify-between gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{question}</span>
                    <span className="h-6 w-6 rounded-lg bg-stone-100 group-hover:bg-[#059669] flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                      <ArrowRight
                        className="h-3.5 w-3.5 text-[#0F766E] group-hover:text-white transition-colors"
                        aria-hidden="true"
                      />
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const linkedPlan = findPlanById(msg.planId);

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="h-9 w-9 rounded-full overflow-hidden border border-amber-300/80 bg-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                    {!avatarFailed ? (
                      <img
                        src={ADVISOR_AVATAR_URL}
                        alt="FINSMART"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarFailed(true)}
                        className="h-full w-full object-contain p-0.5"
                      />
                    ) : (
                      <span className="text-xs font-bold text-[#0F766E]">FS</span>
                    )}
                  </div>
                )}

                <div
                  className={`max-w-[86%] sm:max-w-[78%] rounded-2xl px-4 py-3.5 ${
                    isUser
                      ? 'bg-gradient-to-br from-[#0F766E] to-[#059669] text-white shadow-sm shadow-[#0F766E]/20'
                      : 'bg-white border border-stone-200/90 text-stone-800 shadow-[0_4px_16px_-6px_rgba(28,25,23,0.08)]'
                  }`}
                >
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 mb-1.5 text-[11px] ${
                      isUser ? 'text-emerald-100' : 'text-stone-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">
                        {isUser ? 'Bạn' : 'Chuyên gia FINSMART'}
                      </span>
                      {!isUser && (msg.source || msg.provider) && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${
                            msg.source === 'rules' || msg.provider === 'RulesEngine'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-[#0F766E] border-emerald-200'
                          }`}
                        >
                          {msg.source === 'rules' || msg.provider === 'RulesEngine' ? (
                            <>
                              <Calculator className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              <span>Công thức & Quy tắc (Không AI)</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              <span>AI · {msg.provider || 'Trợ lý'}</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums">{formatDateVi(msg.createdAt)}</span>
                  </div>

                  {!isUser && msg.fallbackNotice && (
                    <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200/70 text-[11px] text-amber-900">
                      {msg.fallbackNotice}
                    </div>
                  )}

                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="text-sm leading-relaxed space-y-2.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-[#1F2937] [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-[#0F766E] [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[#1F2937] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_strong]:font-semibold [&_strong]:text-[#1F2937] [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:text-left [&_th]:py-2 [&_th]:px-2.5 [&_th]:border-b [&_th]:border-stone-200 [&_th]:bg-stone-50 [&_th]:font-semibold [&_td]:py-2 [&_td]:px-2.5 [&_td]:border-b [&_td]:border-stone-100 [&_td]:tabular-nums">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}

                  {linkedPlan && (
                    <div className="mt-3.5 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="text-xs text-stone-600">
                        <span className="font-semibold text-[#059669]">Đã lưu kế hoạch:</span>{' '}
                        <span className="font-medium text-[#1F2937]">{linkedPlan.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenPlan(linkedPlan.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] hover:shadow-md hover:shadow-[#059669]/20 hover:-translate-y-0.5 active:scale-[0.98] rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Xem kế hoạch & báo cáo</span>
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="h-9 w-9 rounded-full border border-emerald-200 bg-emerald-50 flex items-center justify-center shrink-0 mt-1 text-[#0F766E]">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}
              </motion.div>
            );
          })
        )}

        {isSending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 justify-start"
          >
            <div className="h-9 w-9 rounded-full overflow-hidden border border-amber-300/80 bg-white flex items-center justify-center shrink-0">
              {!avatarFailed ? (
                <img
                  src={ADVISOR_AVATAR_URL}
                  alt="FINSMART"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain p-0.5"
                />
              ) : (
                <span className="text-xs font-bold text-[#0F766E]">FS</span>
              )}
            </div>
            <div className="bg-white border border-stone-200 shadow-xs rounded-2xl px-4 py-3 text-sm text-stone-600 flex items-center gap-3">
              <div className="flex items-center gap-1" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-[#059669] ai-dot-1" />
                <span className="h-2 w-2 rounded-full bg-[#D97706] ai-dot-2" />
                <span className="h-2 w-2 rounded-full bg-[#0F766E] ai-dot-3" />
              </div>
              <span>
                Chuyên gia FINSMART đang phân tích số liệu và soạn phương án phù hợp cho bạn...
              </span>
            </div>
          </motion.div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick Advisory Trigger Strip + Chat Composer */}
      <div className="border-t border-stone-200/80 bg-white shrink-0">
        <div className="px-3.5 pt-2 pb-1 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] text-stone-500 whitespace-nowrap shrink-0">Hỏi nhanh:</span>
          {ADVISORY_MODES.filter((m) => m.id !== 'general').map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={isSending}
              onClick={() => {
                onChangeAdvisoryMode(mode.id);
                void onSendMessage(mode.quickPrompt, mode.id);
              }}
              className="px-2.5 py-1 text-[11px] font-medium text-[#0F766E] bg-emerald-50/80 hover:bg-emerald-100/90 border border-emerald-200/80 rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              + {mode.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={handleSubmit}
          className="px-3.5 pt-1.5 pb-3 flex items-end gap-2.5"
        >
        <label htmlFor="chat-input" className="sr-only">
          Nhập câu hỏi tài chính cá nhân của bạn
        </label>
        <textarea
          id="chat-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          placeholder="Đặt câu hỏi về thu nhập, chi tiêu, tiết kiệm hoặc yêu cầu điều chỉnh kế hoạch..."
          className="flex-1 px-3.5 py-2.5 text-sm bg-[#FAF8F5] border border-stone-200 rounded-xl text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-none transition-all"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 h-[44px] text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] hover:shadow-md hover:shadow-[#059669]/20 hover:-translate-y-0.5 active:scale-[0.98] rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          <span>Gửi</span>
        </button>
      </form>
      </div>
    </motion.section>
  );
}
