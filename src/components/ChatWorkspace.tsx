import { ArrowRight, FileSpreadsheet, MessageSquarePlus, Send, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import advisorAvatar from '../assets/images/advisor_avatar_1794990322481.jpg';
import type { ChatMessage, FinancialPlan } from '../types.ts';
import { formatDateVi } from '../utils/format.ts';
import { DisclaimerBanner } from './DisclaimerBanner.tsx';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  plans: FinancialPlan[];
  isSending: boolean;
  errorMessage: string | null;
  onSendMessage: (text: string) => Promise<void>;
  onNewConversation: () => Promise<void>;
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

const ADVISOR_AVATAR_URL = advisorAvatar;

export function ChatWorkspace({
  messages,
  plans,
  isSending,
  errorMessage,
  onSendMessage,
  onNewConversation,
  onOpenPlan,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

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
      className="bg-[#FFFEFC] border border-stone-200/90 shadow-[0_14px_38px_-16px_rgba(28,25,23,0.1)] rounded-2xl flex flex-col h-[calc(100vh-13rem)] min-h-[540px] lg:h-[calc(100vh-11.5rem)] lg:min-h-[620px] overflow-hidden"
    >
      {/* Advisor Header - Warm Deep Forest Teal */}
      <div className="relative flex items-center justify-between gap-4 px-5 py-4 bg-gradient-to-r from-[#134E4A] via-[#115E59] to-[#0F766E] text-white overflow-hidden shrink-0">
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

        <button
          type="button"
          onClick={onNewConversation}
          disabled={isSending}
          className="relative inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/12 hover:bg-white/22 border border-white/25 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
        >
          <MessageSquarePlus className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
          <span>Phiên mới</span>
        </button>
      </div>

      {/* Mandatory Disclaimer inside Chat Workspace */}
      <div className="px-5 pt-3.5 bg-[#FCF9F4]">
        <DisclaimerBanner compact />
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
                    className={`flex items-center justify-between gap-4 mb-1.5 text-[11px] ${
                      isUser ? 'text-emerald-100' : 'text-stone-500'
                    }`}
                  >
                    <span className="font-semibold">
                      {isUser ? 'Bạn' : 'Chuyên gia FINSMART'}
                    </span>
                    <span className="tabular-nums">{formatDateVi(msg.createdAt)}</span>
                  </div>

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

      {/* Chat Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3.5 border-t border-stone-200/80 bg-white flex items-end gap-2.5"
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
    </motion.section>
  );
}
