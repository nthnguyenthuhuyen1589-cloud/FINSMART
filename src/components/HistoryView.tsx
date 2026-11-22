import {
  ArrowRight,
  CalendarDays,
  HardDrive,
  History,
  MessageSquare,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { Conversation } from '../types.ts';
import { formatDateVi, formatMonthYearVi, getMonthYearKey } from '../utils/format.ts';

interface HistoryViewProps {
  sessionId: string;
  conversations: Conversation[];
  activeConversationId: string | null;
  snapshotsCount: number;
  hasProfileData: boolean;
  transactionsCount: number;
  savingsCount: number;
  plansCount: number;
  onSelectConversation: (conversationId: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onResetAllSystem: () => Promise<void>;
  isClearingHistory?: boolean;
  isResetting?: boolean;
  onNewConversation: () => Promise<void>;
}

export function HistoryView({
  sessionId,
  conversations,
  activeConversationId,
  snapshotsCount,
  hasProfileData,
  transactionsCount,
  savingsCount,
  plansCount,
  onSelectConversation,
  onDeleteConversation,
  onResetAllSystem,
  isClearingHistory = false,
  isResetting = false,
  onNewConversation,
}: HistoryViewProps) {
  const [query, setQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deviceFeedback, setDeviceFeedback] = useState<string | null>(null);

  const busy = isClearingHistory || isResetting;
  const shortDeviceCode = sessionId.slice(0, 14);

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

  const handleConfirmResetAll = async () => {
    setDeviceFeedback(null);
    await onResetAllSystem();
    setShowResetConfirm(false);
    setDeviceFeedback('Đã đặt lại toàn bộ hệ thống trên thiết bị này về trạng thái ban đầu.');
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Mục lưu trữ lịch sử trên thiết bị & Đặt lại toàn bộ hệ thống */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-12px_rgba(28,25,23,0.08)] rounded-2xl p-5 sm:p-6 flex flex-col gap-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0F766E] shrink-0 mt-0.5">
              <HardDrive className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#1F2937]">
                  Lưu trữ lịch sử trên thiết bị
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold text-[#047857] bg-emerald-50 border border-emerald-200 rounded-lg">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  <span>Riêng tư theo thiết bị ({shortDeviceCode}...)</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                Thông tin hồ sơ, tiết kiệm, thu chi, kế hoạch và trò chuyện được lưu giữ trực tiếp trên thiết bị này, không ảnh hưởng đến người dùng khác và sẽ còn nguyên vẹn trừ khi bạn tự nguyện đặt lại.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDeviceFeedback(null);
              setShowResetConfirm(true);
            }}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Đặt lại toàn bộ hệ thống</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs items-stretch">
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between min-h-[84px]">
            <span className="block text-stone-500 font-medium">Hồ sơ & mốc lưu</span>
            <span className="mt-2 block font-mono tabular-nums text-base font-bold text-[#1F2937]">
              {snapshotsCount} mốc {hasProfileData ? '· Có dữ liệu' : '· Trống'}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between min-h-[84px]">
            <span className="block text-stone-500 font-medium">Thu chi & Tiết kiệm</span>
            <span className="mt-2 block font-mono tabular-nums text-base font-bold text-[#0F766E]">
              {transactionsCount} mục ({savingsCount} quỹ)
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between min-h-[84px]">
            <span className="block text-stone-500 font-medium">Kế hoạch đã lưu</span>
            <span className="mt-2 block font-mono tabular-nums text-base font-bold text-[#B45309]">
              {plansCount} kế hoạch
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between min-h-[84px]">
            <span className="block text-stone-500 font-medium">Lịch sử trò chuyện</span>
            <span className="mt-2 block font-mono tabular-nums text-base font-bold text-[#059669]">
              {conversations.length} phiên
            </span>
          </div>
        </div>

        {deviceFeedback && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm font-medium text-[#047857]">
            {deviceFeedback}
          </div>
        )}

        {showResetConfirm && (
          <div
            role="alertdialog"
            aria-label="Xác nhận đặt lại toàn bộ hệ thống trên thiết bị"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <p className="text-xs sm:text-sm text-red-800 font-medium leading-relaxed">
              Bạn xác nhận đặt lại toàn bộ hệ thống (hồ sơ, tiết kiệm, thu chi, kế hoạch và trò chuyện) trên thiết bị này? Người dùng khác hoàn toàn không bị ảnh hưởng.
            </p>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={busy}
                className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmResetAll()}
                disabled={busy}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {busy ? 'Đang đặt lại...' : 'Xác nhận đặt lại toàn bộ'}
              </button>
            </div>
          </div>
        )}
      </motion.section>

      {/* Danh sách các cuộc trò chuyện đã lưu */}
      {conversations.length === 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-12px_rgba(28,25,23,0.08)] rounded-2xl p-8 sm:p-10 text-center w-full"
        >
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#0D9488] flex items-center justify-center text-white shadow-md shadow-[#059669]/20 mb-4">
            <History className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-[#1F2937]">Chưa có lịch sử trò chuyện tư vấn</h3>
          <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto leading-relaxed">
            Mỗi cuộc trò chuyện và phân tích tài chính của bạn sẽ được tự động lưu riêng trên thiết bị này để dễ dàng xem lại và điều chỉnh về sau.
          </p>
          <button
            type="button"
            onClick={() => void onNewConversation()}
            className="mt-6 inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] hover:shadow-lg hover:shadow-[#059669]/20 hover:-translate-y-0.5 active:scale-[0.98] rounded-xl transition-all duration-200 cursor-pointer"
          >
            Bắt đầu phiên tư vấn đầu tiên
          </button>
        </motion.section>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-12px_rgba(28,25,23,0.08)] rounded-2xl p-5 sm:p-6 w-full"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-[#B45309] shrink-0">
                <History className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1F2937]">Lịch sử trò chuyện tư vấn</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {conversations.length} cuộc trò chuyện đã lưu trên thiết bị
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

              <div className="relative w-full sm:w-56">
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
                        <h4 className="text-sm font-semibold text-[#1F2937] mt-1 leading-snug">
                          {conv.title}
                        </h4>
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
      )}
    </div>
  );
}
