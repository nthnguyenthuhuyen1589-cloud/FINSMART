import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  HardDrive,
  MessageSquareText,
  PiggyBank,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import type {
  Conversation,
  FinancialPlan,
  FinancialProfile,
  ProfileSnapshot,
  TransactionItem,
} from '../types.ts';
import {
  formatMonthYearVi,
  formatRecordDateVi,
  formatVnd,
  getMonthYearKey,
  todayIsoDate,
} from '../utils/format.ts';

interface OverviewDashboardViewProps {
  profile: FinancialProfile;
  snapshots: ProfileSnapshot[];
  transactions: TransactionItem[];
  plans: FinancialPlan[];
  conversations: Conversation[];
  onNavigateTab: (
    tab: 'consult' | 'tracker' | 'goals' | 'plans' | 'guide' | 'history',
    mobilePane?: 'chat' | 'profile'
  ) => void;
  onAskAdvisor: (prompt: string) => void;
}

export function OverviewDashboardView({
  profile,
  snapshots,
  transactions,
  plans,
  conversations,
  onNavigateTab,
  onAskAdvisor,
}: OverviewDashboardViewProps) {
  const currentMonthKey = useMemo(() => getMonthYearKey(todayIsoDate()), []);

  const summary = useMemo(() => {
    const monthTx = transactions.filter((t) => getMonthYearKey(t.txDate) === currentMonthKey);
    let monthExpense = 0;
    let monthIncome = 0;
    let monthSavings = 0;

    for (const tx of monthTx) {
      if (tx.type === 'expense') monthExpense += tx.amount;
      else if (tx.type === 'income') monthIncome += tx.amount;
      else if (tx.type === 'savings') monthSavings += tx.amount;
    }

    const totalSavedAllTime = transactions
      .filter((t) => t.type === 'savings')
      .reduce((sum, t) => sum + t.amount, 0);

    const plannedExpenses = profile.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const essentialPlanned = profile.expenses
      .filter((e) => e.isEssential)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const flexiblePlanned = profile.expenses
      .filter((e) => !e.isEssential)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const projectedBalance = profile.monthlyIncome - plannedExpenses;

    return {
      monthTxCount: monthTx.length,
      monthExpense,
      monthIncome,
      monthSavings,
      totalSavedAllTime,
      plannedExpenses,
      essentialPlanned,
      flexiblePlanned,
      projectedBalance,
      recentTransactions: transactions.slice(0, 5),
    };
  }, [transactions, profile, currentMonthKey]);

  const totalIncomeBase = Math.max(1, profile.monthlyIncome);
  const essentialPct =
    profile.monthlyIncome > 0
      ? Math.round((summary.essentialPlanned / totalIncomeBase) * 100)
      : 0;
  const flexiblePct =
    profile.monthlyIncome > 0
      ? Math.round((summary.flexiblePlanned / totalIncomeBase) * 100)
      : 0;
  const balancePct =
    profile.monthlyIncome > 0
      ? Math.max(0, Math.round((summary.projectedBalance / totalIncomeBase) * 100))
      : 0;
  const goalPct =
    profile.targetAmount > 0
      ? Math.min(100, Math.round((summary.totalSavedAllTime / profile.targetAmount) * 100))
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      {/* Header Bar */}
      <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0F766E] shrink-0 mt-0.5">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">
              Tổng quan bức tranh tài chính cá nhân
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
              Tổng hợp nhanh thu nhập, chi tiêu, quỹ tiết kiệm và các kế hoạch đang lưu trên thiết bị của bạn trong {formatMonthYearVi(currentMonthKey)}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('consult', 'profile')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Cập nhật hồ sơ</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('tracker')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Ghi thu chi ngay</span>
          </button>
        </div>
      </section>

      {/* Symmetrical 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <div className="p-4 rounded-2xl bg-[#1F2937] text-white shadow-md shadow-stone-900/10 flex flex-col justify-between">
          <span className="text-xs text-stone-300">Thu nhập tháng (Hồ sơ + Thêm)</span>
          <div className="mt-2">
            <span className="text-xl font-mono tabular-nums font-bold text-white block">
              {formatVnd(profile.monthlyIncome + summary.monthIncome)}
            </span>
            <span className="block text-xs text-stone-300 mt-1 tabular-nums">
              Cố định {formatVnd(profile.monthlyIncome)} · Thêm {formatVnd(summary.monthIncome)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/80 flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#B45309]">
            Chi tiêu thực tế tháng này
          </span>
          <div className="mt-2">
            <span className="text-xl font-mono tabular-nums font-bold text-[#92400E] block">
              {formatVnd(summary.monthExpense)}
            </span>
            <span className="block text-xs text-stone-600 mt-1 tabular-nums">
              Dự kiến hồ sơ: {formatVnd(summary.plannedExpenses)}/tháng
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200/80 flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#047857]">
            Tổng quỹ tiết kiệm tích lũy
          </span>
          <div className="mt-2">
            <span className="text-xl font-mono tabular-nums font-bold text-[#059669] block">
              {formatVnd(summary.totalSavedAllTime)}
            </span>
            <span className="block text-xs text-stone-600 mt-1 tabular-nums">
              {profile.targetAmount > 0
                ? `Đạt ${goalPct}% mục tiêu ${formatVnd(profile.targetAmount)}`
                : `Tháng này bỏ quỹ: +${formatVnd(summary.monthSavings)}`}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFEFC] border border-stone-200/90 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-stone-600">Dữ liệu lưu trên thiết bị</span>
          <div className="mt-2">
            <span className="text-xl font-mono tabular-nums font-bold text-[#0F766E] block">
              {snapshots.length + transactions.length + plans.length + conversations.length} bản ghi
            </span>
            <span className="block text-xs text-stone-500 mt-1 tabular-nums">
              {snapshots.length} mốc · {transactions.length} giao dịch · {plans.length} kế hoạch
            </span>
          </div>
        </div>
      </div>

      {/* Symmetrical 2-Column Analytical Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: Cơ cấu phân bổ thu chi theo hồ sơ */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <Wallet className="h-4 w-4 text-[#0F766E]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#1F2937]">
                  Cơ cấu ngân sách theo hồ sơ
                </h3>
              </div>
              <span className="text-xs text-stone-500 tabular-nums">
                {profile.roleType}
              </span>
            </div>

            {profile.monthlyIncome === 0 && summary.plannedExpenses === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-stone-600 leading-relaxed max-w-sm mx-auto">
                  Bạn chưa nhập thu nhập và các khoản chi dự kiến trong hồ sơ tài chính. Hãy cập nhật để xem tỷ lệ cân đối tự động.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2.5 text-xs items-stretch">
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between">
                    <span className="text-stone-500">Thiết yếu ({essentialPct}%)</span>
                    <span className="font-mono tabular-nums font-bold text-[#0F766E] text-sm mt-1">
                      {formatVnd(summary.essentialPlanned)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between">
                    <span className="text-stone-500">Linh hoạt ({flexiblePct}%)</span>
                    <span className="font-mono tabular-nums font-bold text-[#B45309] text-sm mt-1">
                      {formatVnd(summary.flexiblePlanned)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between">
                    <span className="text-stone-500">Phần dư ({balancePct}%)</span>
                    <span
                      className={`font-mono tabular-nums font-bold text-sm mt-1 ${
                        summary.projectedBalance >= 0 ? 'text-[#059669]' : 'text-red-600'
                      }`}
                    >
                      {summary.projectedBalance >= 0 ? '+' : ''}
                      {formatVnd(summary.projectedBalance)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {profile.expenses.filter((e) => e.amount > 0).length === 0 ? (
                    <p className="text-xs text-stone-500">
                      Chưa có khoản chi nào có số tiền lớn hơn 0.
                    </p>
                  ) : (
                    profile.expenses
                      .filter((e) => e.amount > 0)
                      .map((exp) => {
                        const pct =
                          profile.monthlyIncome > 0
                            ? Math.min(100, Math.round((exp.amount / profile.monthlyIncome) * 100))
                            : 0;
                        return (
                          <div key={exp.id} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-[#1F2937]">{exp.category}</span>
                              <span className="font-mono tabular-nums text-stone-600">
                                <strong className="text-[#1F2937]">{formatVnd(exp.amount)}</strong>
                                {profile.monthlyIncome > 0 ? ` (${pct}%)` : ''}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                              <div
                                style={{ width: `${Math.max(4, pct)}%` }}
                                className={`h-full rounded-full ${
                                  exp.isEssential ? 'bg-[#0F766E]' : 'bg-[#D97706]'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </>
            )}
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
            <span className="text-xs text-stone-500">
              Cập nhật hồ sơ để chuyên gia phân tích sát thực tế
            </span>
            <button
              type="button"
              onClick={() =>
                onAskAdvisor(
                  'Hãy đánh giá nhanh tổng quan thu nhập, cơ cấu chi tiêu và quỹ tiết kiệm hiện tại của tôi, sau đó đề xuất 3 việc nên làm ngay trong tuần này.'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Nhờ chuyên gia đánh giá</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* Right: Hoạt động gần đây trên sổ thu chi */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#1F2937]">
                  Giao dịch gần nhất trên thiết bị
                </h3>
              </div>
              <span className="text-xs text-stone-500 tabular-nums">
                {summary.monthTxCount} khoản tháng này
              </span>
            </div>

            {summary.recentTransactions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-stone-600 leading-relaxed max-w-sm mx-auto">
                  Chưa có giao dịch thu chi hoặc bỏ quỹ nào được ghi nhận. Hãy vào mục Theo dõi thu chi để nhập nhiều khoản cùng lúc chỉ trong vài giây.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {summary.recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#1F2937] truncate">{tx.category}</div>
                      <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                        <span className="tabular-nums">{formatRecordDateVi(tx.txDate)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {tx.type === 'expense'
                            ? 'Khoản chi'
                            : tx.type === 'income'
                              ? 'Khoản thu'
                              : 'Quỹ tiết kiệm'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`font-mono tabular-nums font-bold whitespace-nowrap ${
                        tx.type === 'expense'
                          ? 'text-[#B45309]'
                          : tx.type === 'income'
                            ? 'text-[#059669]'
                            : 'text-[#0F766E]'
                      }`}
                    >
                      {tx.type === 'expense' ? '-' : '+'}
                      {formatVnd(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
            <span className="text-xs text-stone-500">
              Ghi chép hằng ngày giúp kiểm soát dòng tiền chặt chẽ hơn
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('tracker')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Mở sổ thu chi</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      {/* Symmetrical 4-Column Quick Feature Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <button
          type="button"
          onClick={() => onNavigateTab('consult', 'chat')}
          className="text-left p-4 rounded-2xl bg-[#FFFEFC]/95 border border-stone-200/90 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="space-y-1.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#059669]">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-[#1F2937]">Tư vấn cá nhân hóa</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Trao đổi 6 chủ đề chuyên sâu: cắt chi, quỹ dự phòng, đánh giá vay và gỡ rối bội chi.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E]">
            <span>Mở khung tư vấn</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('goals')}
          className="text-left p-4 rounded-2xl bg-[#FFFEFC]/95 border border-stone-200/90 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="space-y-1.5">
            <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0F766E]">
              <Target className="h-4 w-4" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-[#1F2937]">Mục tiêu & Quỹ dự phòng</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Theo dõi cột mốc quỹ dự phòng 3–6 tháng và thử nhanh 4 mô hình phân bổ ngân sách.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E]">
            <span>Xem mục tiêu</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('plans')}
          className="text-left p-4 rounded-2xl bg-[#FFFEFC]/95 border border-stone-200/90 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="space-y-1.5">
            <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B45309]">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-[#1F2937]">Kế hoạch & Báo cáo</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Xem bảng phân bổ chi tiết, xuất file báo cáo hoặc in kế hoạch theo từng giai đoạn.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E]">
            <span>Xem {plans.length} kế hoạch</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('history')}
          className="text-left p-4 rounded-2xl bg-[#FFFEFC]/95 border border-stone-200/90 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="space-y-1.5">
            <div className="h-9 w-9 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-[#1F2937]">Lưu trữ trên thiết bị</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Kiểm tra dữ liệu lưu riêng trên thiết bị này, xem lại lịch sử hoặc đặt lại từng mục.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E]">
            <span>Quản lý lưu trữ</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>
      </div>
    </motion.div>
  );
}
