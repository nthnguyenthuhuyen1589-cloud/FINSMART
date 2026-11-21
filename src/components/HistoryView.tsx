import { ArrowRight, CalendarDays, History, MessageSquare, Search, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { Conversation } from '../types.ts';
import { formatDateVi, formatMonthYearVi, getMonthYearKey } from '../utils/format.ts';

interface HistoryViewProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onNewConversation: () => Promise<void>;
}

export function HistoryView({
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
}: HistoryViewProps) {
  const [query, setQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const availableMonths = Array.from(
    new Set(conversations.map((c) => getMonthYearKey(c.updatedAt)).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));

  const filtered = conversations.filter((conv) => {
    if (monthFilter !== 'all' && getMonthYearKey(conv.updatedAt) !== monthFilter) {
      return false;
    }
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      conv.title.toLowerCase().includes(q) ||
      (conv.lastMessagePreview || '').toLowerCase().includes(q)
    );
  });

  if (conversations.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-12px_rgba(28,25,23,0.08)] rounded-2xl p-8 sm:p-10 text-center max-w-2xl mx-auto my-6"
      >
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#0D9488] flex items-center justify-center text-white shadow-md shadow-[#059669]/20 mb-4">
          <History className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-[#1F2937]">Chưa có lịch sử tư vấn</h2>
        <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto leading-relaxed">
          Mỗi cuộc trò chuyện và phân tích tài chính của bạn sẽ được tự động lưu lại tại đây để dễ dàng theo dõi và điều chỉnh về sau.
        </p>
        <button
          type="button"
          onClick={() => void onNewConversation()}
          className="mt-6 inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] hover:shadow-lg hover:shadow-[#059669]/20 hover:-translate-y-0.5 active:scale-[0.98] rounded-xl transition-all duration-200 cursor-pointer"
        >
          Bắt đầu phiên tư vấn đầu tiên
        </button>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-12px_rgba(28,25,23,0.08)] rounded-2xl p-5 sm:p-6 max-w-4xl mx-auto w-full"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-[#B45309] shrink-0">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">Lịch sử tư vấn tài chính</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {conversations.length} cuộc trò chuyện đã lưu
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-stone-50/80 border border-stone-200 rounded-xl px-3 py-2">
            <CalendarDays className="h-4 w-4 text-[#0F766E] shrink-0" aria-hidden="true" />
            <label htmlFor="history-month-filter" className="sr-only">
              Lọc theo tháng và năm
            </label>
            <select
              id="history-month-filter"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="text-xs sm:text-sm bg-transparent text-[#1F2937] focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả thời gian</option>
              {availableMonths.map((mk) => (
                <option key={mk} value={mk}>
                  {formatMonthYearVi(mk)}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo chủ đề..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50/80 border border-stone-200 rounded-xl text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-all"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-stone-500">
          Không tìm thấy cuộc trò chuyện phù hợp.
        </div>
      ) : (
        <div className="divide-y divide-stone-100 mt-2">
          {filtered.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={`py-4 px-3 -mx-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-50/80 to-amber-50/50'
                    : 'hover:bg-stone-50/80'
                }`}
              >
                <div className="min-w-0 flex-1 flex items-start gap-3">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-gradient-to-br from-[#059669] to-[#0D9488] text-white shadow-sm'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span className="tabular-nums">{formatDateVi(conv.updatedAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{conv.messageCount ?? 0} tin nhắn</span>
                      {isActive && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#059669]">Đang mở</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-[#1F2937] mt-1 leading-snug">
                      {conv.title}
                    </h3>
                    {conv.lastMessagePreview && (
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        {conv.lastMessagePreview}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-12 sm:pl-0">
                  <button
                    type="button"
                    onClick={() => void onSelectConversation(conv.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-[0.98]"
                  >
                    <span>Mở lại phiên</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteConversation(conv.id)}
                    aria-label={`Xóa cuộc trò chuyện ${conv.title}`}
                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
