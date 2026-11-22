import {
  ArrowRight,
  CheckCircle2,
  PiggyBank,
  PlusCircle,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import type {
  AdvisoryMode,
  FinancialProfile,
  TransactionItem,
  TransactionType,
} from '../types.ts';
import { formatRecordDateVi, formatVnd, todayIsoDate } from '../utils/format.ts';
import { MoneyInput } from './MoneyInput.tsx';

interface SavingsGoalsViewProps {
  profile: FinancialProfile;
  transactions: TransactionItem[];
  onCreateTransaction: (input: {
    txDate: string;
    type: TransactionType;
    category: string;
    amount: number;
    note: string;
  }) => Promise<void>;
  onDeleteTransaction: (txId: string) => Promise<void>;
  onResetSavings: () => Promise<void>;
  isResetting?: boolean;
  onAskAdvisor: (prompt: string, mode?: AdvisoryMode) => void;
}

const BUDGET_MODELS = [
  {
    id: 'balanced-50-30-20',
    name: '50 / 30 / 20 Cân bằng',
    essentialPct: 50,
    flexiblePct: 30,
    savingsPct: 20,
    note: 'Phù hợp người mới đi làm có thu nhập ổn định và muốn giữ nhịp sống thoải mái.',
  },
  {
    id: 'student-60-20-20',
    name: '60 / 20 / 20 Thiết yếu ưu tiên',
    essentialPct: 60,
    flexiblePct: 20,
    savingsPct: 20,
    note: 'Phù hợp sinh viên ở trọ hoặc thu nhập vừa phải, tiền nhà và ăn uống chiếm tỷ trọng cao.',
  },
  {
    id: 'shield-50-20-30',
    name: '50 / 20 / 30 Tăng tốc dự phòng',
    essentialPct: 50,
    flexiblePct: 20,
    savingsPct: 30,
    note: 'Dành cho giai đoạn cần gom nhanh quỹ dự phòng 3 tháng hoặc chuẩn bị mua thiết bị lớn.',
  },
  {
    id: 'tight-70-15-15',
    name: '70 / 15 / 15 Vượt giai đoạn thắt chặt',
    essentialPct: 70,
    flexiblePct: 15,
    savingsPct: 15,
    note: 'Áp dụng khi đang hỗ trợ gia đình hoặc có khoản chi cố định cao nhưng vẫn giữ thói quen tích lũy.',
  },
];

const QUICK_SAVINGS_CATEGORIES = [
  'Quỹ dự phòng khẩn cấp',
  'Tiết kiệm mục tiêu lớn',
  'Tiền để dành cuối ngày / cuối tuần',
  'Quỹ học tập / Nâng cấp bản thân',
];

export function SavingsGoalsView({
  profile,
  transactions,
  onCreateTransaction,
  onDeleteTransaction,
  onResetSavings,
  isResetting = false,
  onAskAdvisor,
}: SavingsGoalsViewProps) {
  const [reserveMonths, setReserveMonths] = useState<3 | 6>(3);
  const [selectedModelId, setSelectedModelId] = useState<string>(BUDGET_MODELS[1].id);
  const [quickAmount, setQuickAmount] = useState<number>(200_000);
  const [quickCategory, setQuickCategory] = useState<string>(QUICK_SAVINGS_CATEGORIES[0]);
  const [quickNote, setQuickNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const savingsTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'savings'),
    [transactions]
  );

  const totalSaved = useMemo(
    () => savingsTransactions.reduce((sum, t) => sum + t.amount, 0),
    [savingsTransactions]
  );

  const essentialMonthly = useMemo(() => {
    const sum = profile.expenses
      .filter((e) => e.isEssential)
      .reduce((acc, e) => acc + (e.amount || 0), 0);
    if (sum > 0) return sum;
    return profile.monthlyIncome > 0 ? Math.round(profile.monthlyIncome * 0.6) : 3_000_000;
  }, [profile]);

  const emergencyTarget = essentialMonthly * reserveMonths;
  const emergencyPct =
    emergencyTarget > 0 ? Math.min(100, Math.round((totalSaved / emergencyTarget) * 100)) : 0;
  const emergencyRemaining = Math.max(0, emergencyTarget - totalSaved);

  const personalTarget = profile.targetAmount > 0 ? profile.targetAmount : 10_000_000;
  const personalPct =
    personalTarget > 0 ? Math.min(100, Math.round((totalSaved / personalTarget) * 100)) : 0;

  const selectedModel =
    BUDGET_MODELS.find((m) => m.id === selectedModelId) ?? BUDGET_MODELS[0];
  const monthlyIncomeForModel =
    profile.monthlyIncome > 0 ? profile.monthlyIncome : 5_000_000;

  const handleQuickDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAmount <= 0) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await onCreateTransaction({
        txDate: todayIsoDate(),
        type: 'savings',
        category: quickCategory,
        amount: quickAmount,
        note: quickNote.trim(),
      });
      setQuickNote('');
      setFeedback(`Đã ghi nhận thêm ${formatVnd(quickAmount)} vào "${quickCategory}".`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      {/* Header Card */}
      <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#059669] shrink-0 mt-0.5">
            <Target className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">
              Quản lý mục tiêu tiết kiệm & Quỹ dự phòng
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
              Theo dõi tiến độ quỹ khẩn cấp, hoàn thành từng cột mốc mục tiêu cá nhân và chọn mô hình chia ngân sách phù hợp.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {savingsTransactions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={isResetting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Xóa mục tiết kiệm</span>
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              onAskAdvisor(
                `Hiện tại tôi đã tích lũy được ${formatVnd(totalSaved)}. Mục tiêu quỹ dự phòng ${reserveMonths} tháng của tôi là ${formatVnd(emergencyTarget)} và mục tiêu cá nhân là ${formatVnd(personalTarget)}. Hãy lập lộ trình tăng tốc tiết kiệm phù hợp cho tôi.`,
                'emergency_fund'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <span>Tối ưu quỹ cùng chuyên gia</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

      {showClearConfirm && (
        <div
          role="alertdialog"
          aria-label="Xác nhận xóa toàn bộ dữ liệu mục tiết kiệm"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <p className="text-xs sm:text-sm text-red-800 font-medium">
            Bạn xác nhận xóa {savingsTransactions.length} khoản thuộc mục quỹ tiết kiệm trên thiết bị này? Thao tác này không ảnh hưởng đến người dùng khác.
          </p>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              disabled={isResetting}
              className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={async () => {
                await onResetSavings();
                setShowClearConfirm(false);
              }}
              disabled={isResetting}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              {isResetting ? 'Đang xóa...' : 'Xác nhận xóa mục tiết kiệm'}
            </button>
          </div>
        </div>
      )}

      {/* Row 1: Symmetrical 2-Column Split (Emergency Fund vs Personal Goal & Deposit) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: Quỹ dự phòng khẩn cấp */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#0F766E]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#1F2937]">
                  Quỹ dự phòng an toàn
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-1 bg-[#FAF8F5] border border-stone-200/80 p-0.5 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setReserveMonths(3)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    reserveMonths === 3
                      ? 'bg-[#0F766E] text-white font-semibold'
                      : 'text-stone-600 hover:text-[#1F2937]'
                  }`}
                >
                  Chuẩn 3 tháng
                </button>
                <button
                  type="button"
                  onClick={() => setReserveMonths(6)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    reserveMonths === 6
                      ? 'bg-[#0F766E] text-white font-semibold'
                      : 'text-stone-600 hover:text-[#1F2937]'
                  }`}
                >
                  Vững 6 tháng
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs items-stretch">
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between">
                <span className="text-stone-500">Chi thiết yếu / tháng</span>
                <span className="font-mono tabular-nums font-bold text-base text-[#1F2937] mt-1">
                  {formatVnd(essentialMonthly)}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between">
                <span className="text-stone-500">Mục tiêu {reserveMonths} tháng</span>
                <span className="font-mono tabular-nums font-bold text-base text-[#0F766E] mt-1">
                  {formatVnd(emergencyTarget)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#047857]">Tiến độ quỹ hiện tại</span>
                <span className="font-mono tabular-nums font-bold text-[#059669]">
                  {formatVnd(totalSaved)} / {formatVnd(emergencyTarget)} ({emergencyPct}%)
                </span>
              </div>
              <div className="h-3 rounded-full bg-white border border-emerald-200/80 overflow-hidden">
                <div
                  style={{ width: `${emergencyPct}%` }}
                  className="h-full bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-full transition-all"
                />
              </div>
              <p className="text-xs text-stone-600">
                {emergencyRemaining === 0
                  ? 'Chúc mừng! Bạn đã đạt ngưỡng quỹ dự phòng an toàn cho mức chi thiết yếu hiện tại.'
                  : `Còn thiếu ${formatVnd(emergencyRemaining)} để hoàn thiện lá chắn dự phòng ${reserveMonths} tháng.`}
              </p>
            </div>

            {/* 4 Balanced Milestone Tiles (2x2) */}
            <div className="grid grid-cols-2 gap-2.5 text-xs items-stretch">
              {[25, 50, 75, 100].map((pct) => {
                const milestoneAmount = Math.round((emergencyTarget * pct) / 100);
                const reached = totalSaved >= milestoneAmount && emergencyTarget > 0;
                return (
                  <div
                    key={pct}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      reached
                        ? 'bg-emerald-50/70 border-emerald-200 text-[#047857]'
                        : 'bg-[#FAF8F5] border-stone-200/80 text-stone-600'
                    }`}
                  >
                    <div>
                      <span className="block font-semibold">Cột mốc {pct}%</span>
                      <span className="font-mono tabular-nums text-[11px]">
                        {formatVnd(milestoneAmount)}
                      </span>
                    </div>
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 ${
                        reached ? 'text-[#059669]' : 'text-stone-300'
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
            <span className="text-xs text-stone-500">
              Quỹ dự phòng giúp bạn vững vàng trước rủi ro đột xuất
            </span>
            <button
              type="button"
              onClick={() =>
                onAskAdvisor(
                  `Chi thiết yếu mỗi tháng của tôi khoảng ${formatVnd(essentialMonthly)}, quỹ dự phòng mục tiêu ${reserveMonths} tháng là ${formatVnd(emergencyTarget)} và hiện đã có ${formatVnd(totalSaved)}. Tôi nên chia mỗi tuần bao nhiêu để đạt cột mốc đầu tiên nhanh nhất?`,
                  'emergency_fund'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Lập kế hoạch quỹ</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* Right: Mục tiêu cá nhân & Ghi nhanh khoản bỏ quỹ */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <PiggyBank className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#1F2937]">
                  Mục tiêu cá nhân & Bỏ quỹ nhanh
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-[#059669]">
                {personalPct}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#1F2937]">
                  {profile.financialGoal || 'Mục tiêu tiết kiệm cá nhân'}
                </span>
                <span className="font-mono tabular-nums font-bold text-[#B45309]">
                  {formatVnd(totalSaved)} / {formatVnd(personalTarget)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white border border-stone-200 overflow-hidden">
                <div
                  style={{ width: `${personalPct}%` }}
                  className="h-full bg-gradient-to-r from-[#D97706] to-[#F59E0B] rounded-full transition-all"
                />
              </div>
            </div>

            {feedback && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-[#047857]">
                {feedback}
              </div>
            )}

            <form onSubmit={handleQuickDeposit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="goal-quick-category"
                    className="block text-xs font-semibold text-stone-700 mb-1.5"
                  >
                    Hũ / Quỹ tích lũy
                  </label>
                  <select
                    id="goal-quick-category"
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                  >
                    {QUICK_SAVINGS_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="goal-quick-amount"
                    className="block text-xs font-semibold text-stone-700 mb-1.5"
                  >
                    Số tiền bỏ quỹ hôm nay (VNĐ)
                  </label>
                  <MoneyInput
                    id="goal-quick-amount"
                    size="sm"
                    value={quickAmount}
                    onChange={setQuickAmount}
                    accent="emerald"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[50_000, 100_000, 200_000, 500_000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setQuickAmount(amt)}
                    className="py-1.5 text-xs font-medium text-stone-700 bg-[#FAF8F5] hover:bg-emerald-50 hover:text-[#059669] border border-stone-200 rounded-lg transition-colors cursor-pointer tabular-nums"
                  >
                    {amt / 1000}k
                  </button>
                ))}
              </div>

              <div>
                <label
                  htmlFor="goal-quick-note"
                  className="block text-xs font-semibold text-stone-700 mb-1.5"
                >
                  Ghi chú (tùy chọn)
                </label>
                <input
                  id="goal-quick-note"
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="Ví dụ: Tiết kiệm tiền ăn ngoài tuần này..."
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || quickAmount <= 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                <span>{isSubmitting ? 'Đang ghi nhận...' : 'Bỏ quỹ tiết kiệm ngay'}</span>
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Row 2: Symmetrical 2-Column Split (Budget Models 2x2 vs Savings Ledger) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: 4 Mô hình chia thu nhập */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-[#1F2937]">
                Thử nhanh 4 mô hình phân bổ thu nhập
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                Tính trên mức thu nhập {formatVnd(monthlyIncomeForModel)}/tháng {profile.monthlyIncome === 0 ? '(mức tham khảo)' : '(theo hồ sơ của bạn)'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
              {BUDGET_MODELS.map((model) => {
                const active = model.id === selectedModelId;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModelId(model.id)}
                    className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                      active
                        ? 'bg-emerald-50/70 border-[#0F766E] shadow-xs'
                        : 'bg-[#FAF8F5] border-stone-200/80 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold text-[#1F2937]">{model.name}</div>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">{model.note}</p>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[#0F766E] font-semibold">
                      Thiết yếu {model.essentialPct}% · Linh hoạt {model.flexiblePct}% · Quỹ {model.savingsPct}%
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs items-stretch">
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between">
                <span className="text-stone-500">Thiết yếu ({selectedModel.essentialPct}%)</span>
                <span className="font-mono tabular-nums font-bold text-[#0F766E] text-sm mt-1">
                  {formatVnd(Math.round((monthlyIncomeForModel * selectedModel.essentialPct) / 100))}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between">
                <span className="text-stone-500">Linh hoạt ({selectedModel.flexiblePct}%)</span>
                <span className="font-mono tabular-nums font-bold text-[#B45309] text-sm mt-1">
                  {formatVnd(Math.round((monthlyIncomeForModel * selectedModel.flexiblePct) / 100))}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between">
                <span className="text-stone-500">Tiết kiệm ({selectedModel.savingsPct}%)</span>
                <span className="font-mono tabular-nums font-bold text-[#059669] text-sm mt-1">
                  {formatVnd(Math.round((monthlyIncomeForModel * selectedModel.savingsPct) / 100))}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onAskAdvisor(
                `Hãy lập cho tôi kế hoạch chi tiết theo mô hình "${selectedModel.name}" (${selectedModel.essentialPct}% thiết yếu, ${selectedModel.flexiblePct}% linh hoạt, ${selectedModel.savingsPct}% tiết kiệm) với thu nhập khoảng ${formatVnd(monthlyIncomeForModel)}/tháng.`,
                'savings_goal'
              )
            }
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <span>Áp dụng mô hình {selectedModel.name} cùng chuyên gia</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>

        {/* Right: Nhật ký các khoản đã bỏ quỹ tiết kiệm */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <PiggyBank className="h-4 w-4 text-[#0F766E]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#1F2937]">
                  Lịch sử bỏ quỹ tiết kiệm ({savingsTransactions.length})
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums font-bold text-[#059669]">
                Tổng: {formatVnd(totalSaved)}
              </span>
            </div>

            {savingsTransactions.length === 0 ? (
              <div className="my-auto py-8 text-center">
                <p className="text-sm text-stone-600 leading-relaxed max-w-sm mx-auto">
                  Bạn chưa ghi khoản bỏ quỹ tiết kiệm nào trên thiết bị này. Hãy thử ghi khoản đầu tiên ngay ở khung phía trên.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                {savingsTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1F2937] truncate">
                        {tx.category}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
                        <span className="tabular-nums">{formatRecordDateVi(tx.txDate)}</span>
                        {tx.note && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{tx.note}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-mono tabular-nums font-bold text-[#059669] whitespace-nowrap">
                        +{formatVnd(tx.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void onDeleteTransaction(tx.id)}
                        aria-label={`Xóa khoản tiết kiệm ${tx.category}`}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
