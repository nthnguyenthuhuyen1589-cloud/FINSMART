import {
  Calculator,
  Check,
  CheckCircle2,
  Pencil,
  PiggyBank,
  PlusCircle,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
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
  aiEnabled: boolean;
  onSaveProfile: (profileToSave: FinancialProfile) => Promise<void>;
  onCreateTransaction: (input: {
    txDate: string;
    type: TransactionType;
    category: string;
    amount: number;
    note: string;
  }) => Promise<void>;
  onUpdateTransaction: (
    txId: string,
    patch: {
      txDate?: string;
      category?: string;
      amount?: number;
      note?: string;
    }
  ) => Promise<void>;
  onDeleteTransaction: (txId: string) => Promise<void>;
  onResetSavings: () => Promise<void>;
  isResetting?: boolean;
  onAskAdvisor: (prompt: string, mode?: AdvisoryMode, overrideAiEnabled?: boolean) => void;
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
  aiEnabled,
  onSaveProfile,
  onCreateTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onResetSavings,
  isResetting = false,
  onAskAdvisor,
}: SavingsGoalsViewProps) {
  // Emergency fund controls (3, 6, or custom months + editable essential base)
  const [reserveMonths, setReserveMonths] = useState<number>(3);
  const [isCustomMonths, setIsCustomMonths] = useState(false);
  const [customEssentialMonthly, setCustomEssentialMonthly] = useState<number | null>(null);
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);

  // Personal goal inline editing state (persisted to profile)
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalNameDraft, setGoalNameDraft] = useState(profile.financialGoal || '');
  const [goalAmountDraft, setGoalAmountDraft] = useState(profile.targetAmount || 0);
  const [goalMonthsDraft, setGoalMonthsDraft] = useState(profile.targetMonths || 0);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [goalFeedback, setGoalFeedback] = useState<string | null>(null);

  // Quick deposit form (free-text fund name + quick chips)
  const [quickAmount, setQuickAmount] = useState<number>(200_000);
  const [quickCategory, setQuickCategory] = useState<string>(QUICK_SAVINGS_CATEGORIES[0]);
  const [quickDate, setQuickDate] = useState<string>(todayIsoDate());
  const [quickNote, setQuickNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Budget models income (editable directly)
  const [selectedModelId, setSelectedModelId] = useState<string>(BUDGET_MODELS[1].id);
  const [customModelIncome, setCustomModelIncome] = useState<number | null>(null);

  // Inline editing for saved savings transactions
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editTxCategory, setEditTxCategory] = useState('');
  const [editTxAmount, setEditTxAmount] = useState(0);
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxNote, setEditTxNote] = useState('');
  const [isUpdatingTx, setIsUpdatingTx] = useState(false);

  useEffect(() => {
    if (!isEditingGoal) {
      setGoalNameDraft(profile.financialGoal || '');
      setGoalAmountDraft(profile.targetAmount || 0);
      setGoalMonthsDraft(profile.targetMonths || 0);
    }
  }, [profile.financialGoal, profile.targetAmount, profile.targetMonths, isEditingGoal]);

  const savingsTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'savings'),
    [transactions]
  );

  const totalSaved = useMemo(
    () => savingsTransactions.reduce((sum, t) => sum + t.amount, 0),
    [savingsTransactions]
  );

  const profileEssentialMonthly = useMemo(() => {
    const sum = profile.expenses
      .filter((e) => e.isEssential)
      .reduce((acc, e) => acc + (e.amount || 0), 0);
    if (sum > 0) return sum;
    return profile.monthlyIncome > 0 ? Math.round(profile.monthlyIncome * 0.6) : 0;
  }, [profile]);

  const essentialMonthly =
    customEssentialMonthly !== null ? customEssentialMonthly : profileEssentialMonthly;

  const emergencyTarget = essentialMonthly * Math.max(1, reserveMonths);
  const emergencyPct =
    emergencyTarget > 0 ? Math.min(100, Math.round((totalSaved / emergencyTarget) * 100)) : 0;
  const emergencyRemaining = Math.max(0, emergencyTarget - totalSaved);

  const personalTarget = profile.targetAmount > 0 ? profile.targetAmount : 0;
  const personalPct =
    personalTarget > 0 ? Math.min(100, Math.round((totalSaved / personalTarget) * 100)) : 0;

  const selectedModel =
    BUDGET_MODELS.find((m) => m.id === selectedModelId) ?? BUDGET_MODELS[0];
  const monthlyIncomeForModel =
    customModelIncome !== null ? customModelIncome : profile.monthlyIncome;

  const handleSavePersonalGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGoal(true);
    setGoalFeedback(null);
    try {
      await onSaveProfile({
        ...profile,
        financialGoal: goalNameDraft.trim(),
        targetAmount: Math.max(0, Math.round(goalAmountDraft)),
        targetMonths: Math.max(0, Math.min(240, Math.round(goalMonthsDraft))),
      });
      setIsEditingGoal(false);
      setGoalFeedback('Đã lưu thông tin mục tiêu cá nhân của bạn.');
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleQuickDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAmount <= 0) return;
    const categoryToSave = quickCategory.trim() || QUICK_SAVINGS_CATEGORIES[0];
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await onCreateTransaction({
        txDate: quickDate || todayIsoDate(),
        type: 'savings',
        category: categoryToSave,
        amount: quickAmount,
        note: quickNote.trim(),
      });
      setQuickNote('');
      setFeedback(`Đã ghi nhận thêm ${formatVnd(quickAmount)} vào "${categoryToSave}".`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditTransaction = (tx: TransactionItem) => {
    setEditingTxId(tx.id);
    setEditTxCategory(tx.category);
    setEditTxAmount(tx.amount);
    setEditTxDate(tx.txDate);
    setEditTxNote(tx.note || '');
  };

  const handleSaveEditedTransaction = async (txId: string) => {
    if (editTxAmount <= 0) return;
    setIsUpdatingTx(true);
    try {
      await onUpdateTransaction(txId, {
        category: editTxCategory.trim() || 'Quỹ tiết kiệm',
        amount: editTxAmount,
        txDate: editTxDate || todayIsoDate(),
        note: editTxNote.trim(),
      });
      setEditingTxId(null);
    } finally {
      setIsUpdatingTx(false);
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
              Tự nhập, chỉnh sửa mục tiêu cá nhân, tên hũ quỹ tiết kiệm, mức quỹ dự phòng và theo dõi tiến độ thực tế.
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
                `Hiện tại tôi đã tích lũy được ${formatVnd(totalSaved)}. Mục tiêu quỹ dự phòng ${reserveMonths} tháng của tôi là ${formatVnd(emergencyTarget)}${personalTarget > 0 ? ` và mục tiêu "${profile.financialGoal || 'cá nhân'}" là ${formatVnd(personalTarget)}` : ''}. Hãy lập lộ trình tăng tốc tiết kiệm phù hợp cho tôi.`,
                'emergency_fund',
                true
              )
            }
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              aiEnabled
                ? 'text-white bg-gradient-to-r from-[#059669] to-[#0D9488] shadow-sm hover:shadow-md'
                : 'text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tối ưu quỹ Có AI</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onAskAdvisor(
                `Hiện tại tôi đã tích lũy được ${formatVnd(totalSaved)}. Mục tiêu quỹ dự phòng ${reserveMonths} tháng của tôi là ${formatVnd(emergencyTarget)}${personalTarget > 0 ? ` và mục tiêu "${profile.financialGoal || 'cá nhân'}" là ${formatVnd(personalTarget)}` : ''}. Hãy lập lộ trình tăng tốc tiết kiệm phù hợp cho tôi.`,
                'emergency_fund',
                false
              )
            }
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              !aiEnabled
                ? 'text-white bg-gradient-to-r from-[#B45309] to-[#D97706] shadow-sm hover:shadow-md'
                : 'text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tối ưu Không AI</span>
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
        {/* Left: Quỹ dự phòng khẩn cấp (tùy chỉnh số tháng & chi thiết yếu) */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#0F766E]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#1F2937]">
                  Quỹ dự phòng an toàn
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-[#FAF8F5] border border-stone-200/80 p-0.5 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMonths(false);
                    setReserveMonths(3);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    !isCustomMonths && reserveMonths === 3
                      ? 'bg-[#0F766E] text-white font-semibold'
                      : 'text-stone-600 hover:text-[#1F2937]'
                  }`}
                >
                  3 tháng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMonths(false);
                    setReserveMonths(6);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    !isCustomMonths && reserveMonths === 6
                      ? 'bg-[#0F766E] text-white font-semibold'
                      : 'text-stone-600 hover:text-[#1F2937]'
                  }`}
                >
                  6 tháng
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomMonths(true)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isCustomMonths
                      ? 'bg-[#0F766E] text-white font-semibold'
                      : 'text-stone-600 hover:text-[#1F2937]'
                  }`}
                >
                  Tự nhập
                </button>
              </div>
            </div>

            {isCustomMonths && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs">
                <label htmlFor="custom-reserve-months" className="font-semibold text-amber-900">
                  Số tháng dự phòng mong muốn:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="custom-reserve-months"
                    type="number"
                    min={1}
                    max={36}
                    value={reserveMonths}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(36, Math.round(Number(e.target.value) || 1)));
                      setReserveMonths(val);
                    }}
                    className="w-20 px-2.5 py-1 text-center font-mono font-bold bg-white border border-amber-300 rounded-lg text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                  />
                  <span className="text-stone-600">tháng</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs items-stretch">
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-500">Chi thiết yếu / tháng</span>
                  <div className="flex items-center gap-1">
                    {customEssentialMonthly !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomEssentialMonthly(null);
                          setIsEditingEmergency(false);
                        }}
                        title="Dùng lại theo hồ sơ"
                        className="text-[11px] text-stone-500 hover:text-[#0F766E] cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingEmergency((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F766E] hover:underline cursor-pointer"
                    >
                      <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                      <span>{isEditingEmergency ? 'Xong' : 'Sửa'}</span>
                    </button>
                  </div>
                </div>
                {isEditingEmergency ? (
                  <MoneyInput
                    size="sm"
                    value={essentialMonthly}
                    onChange={(next) => setCustomEssentialMonthly(next)}
                    ariaLabel="Tự nhập chi thiết yếu hàng tháng"
                    placeholder="Nhập mức chi thiết yếu"
                  />
                ) : (
                  <span className="font-mono tabular-nums font-bold text-base text-[#1F2937]">
                    {essentialMonthly > 0 ? formatVnd(essentialMonthly) : 'Chưa nhập'}
                  </span>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between">
                <span className="text-stone-500">Mục tiêu {reserveMonths} tháng</span>
                <span className="font-mono tabular-nums font-bold text-base text-[#0F766E] mt-1">
                  {emergencyTarget > 0 ? formatVnd(emergencyTarget) : 'Chưa xác định'}
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
                {emergencyTarget === 0
                  ? 'Hãy nhấn "Sửa" ở ô Chi thiết yếu/tháng hoặc cập nhật hồ sơ để tính mục tiêu quỹ dự phòng của riêng bạn.'
                  : emergencyRemaining === 0
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

          <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-xs text-stone-500">
              Lập kế hoạch tích lũy quỹ dự phòng:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onAskAdvisor(
                    `Chi thiết yếu mỗi tháng của tôi khoảng ${formatVnd(essentialMonthly)}, quỹ dự phòng mục tiêu ${reserveMonths} tháng là ${formatVnd(emergencyTarget)} và hiện đã có ${formatVnd(totalSaved)}. Tôi nên chia mỗi tuần bao nhiêu để đạt cột mốc đầu tiên nhanh nhất?`,
                    'emergency_fund',
                    true
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kế hoạch Có AI</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskAdvisor(
                    `Chi thiết yếu mỗi tháng của tôi khoảng ${formatVnd(essentialMonthly)}, quỹ dự phòng mục tiêu ${reserveMonths} tháng là ${formatVnd(emergencyTarget)} và hiện đã có ${formatVnd(totalSaved)}. Tôi nên chia mỗi tuần bao nhiêu để đạt cột mốc đầu tiên nhanh nhất?`,
                    'emergency_fund',
                    false
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kế hoạch Không AI</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right: Mục tiêu cá nhân (Tự nhập & Chỉnh sửa) & Ghi nhanh khoản bỏ quỹ */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <PiggyBank className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#1F2937]">
                  Mục tiêu cá nhân & Bỏ quỹ nhanh
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGoalFeedback(null);
                    setIsEditingGoal((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  <span>{isEditingGoal ? 'Đóng' : 'Sửa mục tiêu'}</span>
                </button>
                <span className="text-xs font-mono tabular-nums font-semibold text-[#059669]">
                  {personalPct}%
                </span>
              </div>
            </div>

            {isEditingGoal ? (
              <form
                onSubmit={handleSavePersonalGoal}
                className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-3"
              >
                <div>
                  <label
                    htmlFor="goals-tab-goal-name"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Tên mục tiêu tài chính
                  </label>
                  <input
                    id="goals-tab-goal-name"
                    type="text"
                    value={goalNameDraft}
                    onChange={(e) => setGoalNameDraft(e.target.value)}
                    placeholder="Ví dụ: Mua laptop học tập, Quỹ khẩn cấp 10 triệu..."
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="goals-tab-goal-amount"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      Số tiền mục tiêu (VNĐ)
                    </label>
                    <MoneyInput
                      id="goals-tab-goal-amount"
                      size="sm"
                      value={goalAmountDraft}
                      onChange={setGoalAmountDraft}
                      placeholder="10.000.000"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="goals-tab-goal-months"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      Thời hạn (tháng)
                    </label>
                    <input
                      id="goals-tab-goal-months"
                      type="number"
                      min={0}
                      max={240}
                      value={goalMonthsDraft || ''}
                      onChange={(e) =>
                        setGoalMonthsDraft(Math.max(0, Math.min(240, Number(e.target.value) || 0)))
                      }
                      placeholder="Linh hoạt (VD: 6)"
                      className="w-full px-3 py-2 text-xs sm:text-sm font-mono bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingGoal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGoal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#115E59] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isSavingGoal ? 'Đang lưu...' : 'Lưu mục tiêu'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#1F2937]">
                    {profile.financialGoal || 'Chưa đặt tên mục tiêu — nhấn "Sửa mục tiêu" để tự nhập'}
                  </span>
                  <span className="font-mono tabular-nums font-bold text-[#B45309]">
                    {personalTarget > 0
                      ? `${formatVnd(totalSaved)} / ${formatVnd(personalTarget)}`
                      : `Đã tích lũy: ${formatVnd(totalSaved)}`}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white border border-stone-200 overflow-hidden">
                  <div
                    style={{ width: `${personalPct}%` }}
                    className="h-full bg-gradient-to-r from-[#D97706] to-[#F59E0B] rounded-full transition-all"
                  />
                </div>
                {profile.targetMonths > 0 && personalTarget > 0 && (
                  <p className="text-[11px] text-stone-500">
                    Thời hạn dự kiến: {profile.targetMonths} tháng · Còn thiếu{' '}
                    <span className="font-semibold text-stone-700">
                      {formatVnd(Math.max(0, personalTarget - totalSaved))}
                    </span>
                  </p>
                )}
              </div>
            )}

            {goalFeedback && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-[#047857]">
                {goalFeedback}
              </div>
            )}

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
                    Tên hũ / Quỹ tích lũy (tự nhập hoặc chọn nhanh)
                  </label>
                  <input
                    id="goal-quick-category"
                    type="text"
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value)}
                    placeholder="Nhập tên quỹ của bạn..."
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="goal-quick-amount"
                    className="block text-xs font-semibold text-stone-700 mb-1.5"
                  >
                    Số tiền bỏ quỹ (VNĐ)
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

              {/* Quick fund chips so user can tap OR type custom name */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SAVINGS_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setQuickCategory(cat)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors cursor-pointer ${
                      quickCategory === cat
                        ? 'bg-emerald-50 text-[#0F766E] border-emerald-300 font-semibold'
                        : 'bg-[#FAF8F5] text-stone-600 border-stone-200 hover:border-amber-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="goal-quick-date"
                    className="block text-xs font-semibold text-stone-700 mb-1.5"
                  >
                    Ngày bỏ quỹ
                  </label>
                  <input
                    id="goal-quick-date"
                    type="date"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                  />
                </div>
                <div className="sm:col-span-2">
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

      {/* Row 2: Symmetrical 2-Column Split (Budget Models 2x2 vs Editable Savings Ledger) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: 4 Mô hình chia thu nhập (với ô tự nhập mức thu nhập tính thử) */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="pb-3 border-b border-stone-100 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1F2937]">
                  Thử nhanh 4 mô hình phân bổ thu nhập
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Tự nhập thu nhập bên cạnh hoặc dùng số liệu hồ sơ ({formatVnd(profile.monthlyIncome)})
                </p>
              </div>
              <div className="w-full sm:w-44 shrink-0">
                <MoneyInput
                  size="sm"
                  value={monthlyIncomeForModel}
                  onChange={(next) => setCustomModelIncome(next)}
                  ariaLabel="Thu nhập để tính mô hình phân bổ"
                  placeholder="Nhập thu nhập..."
                />
              </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() =>
                onAskAdvisor(
                  `Hãy lập cho tôi kế hoạch chi tiết theo mô hình "${selectedModel.name}" (${selectedModel.essentialPct}% thiết yếu, ${selectedModel.flexiblePct}% linh hoạt, ${selectedModel.savingsPct}% tiết kiệm) với thu nhập ${formatVnd(monthlyIncomeForModel)}/tháng.`,
                  'savings_goal',
                  true
                )
              }
              disabled={monthlyIncomeForModel <= 0}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Áp dụng ({selectedModel.name.split(' ')[0]}) Có AI</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onAskAdvisor(
                  `Hãy lập cho tôi kế hoạch chi tiết theo mô hình "${selectedModel.name}" (${selectedModel.essentialPct}% thiết yếu, ${selectedModel.flexiblePct}% linh hoạt, ${selectedModel.savingsPct}% tiết kiệm) với thu nhập ${formatVnd(monthlyIncomeForModel)}/tháng.`,
                  'savings_goal',
                  false
                )
              }
              disabled={monthlyIncomeForModel <= 0}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <Calculator className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Áp dụng Không AI</span>
            </button>
          </div>
        </section>

        {/* Right: Nhật ký các khoản đã bỏ quỹ tiết kiệm (Hỗ trợ Sửa & Xóa trực tiếp) */}
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
                  Bạn chưa ghi khoản bỏ quỹ tiết kiệm nào trên thiết bị này. Hãy tự nhập tên quỹ và số tiền ở khung phía trên.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                {savingsTransactions.map((tx) => {
                  const isEditingThis = editingTxId === tx.id;
                  if (isEditingThis) {
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-col gap-2"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editTxCategory}
                            onChange={(e) => setEditTxCategory(e.target.value)}
                            aria-label="Tên hũ / quỹ"
                            className="px-2.5 py-1.5 text-xs sm:text-sm bg-white border border-stone-200 rounded-lg text-[#1F2937]"
                          />
                          <MoneyInput
                            size="sm"
                            value={editTxAmount}
                            onChange={setEditTxAmount}
                            ariaLabel="Số tiền bỏ quỹ"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={editTxDate}
                            onChange={(e) => setEditTxDate(e.target.value)}
                            aria-label="Ngày bỏ quỹ"
                            className="px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-[#1F2937]"
                          />
                          <input
                            type="text"
                            value={editTxNote}
                            onChange={(e) => setEditTxNote(e.target.value)}
                            placeholder="Ghi chú..."
                            aria-label="Ghi chú"
                            className="px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-[#1F2937]"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingTxId(null)}
                            disabled={isUpdatingTx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                            <span>Hủy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveEditedTransaction(tx.id)}
                            disabled={isUpdatingTx || editTxAmount <= 0}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" aria-hidden="true" />
                            <span>{isUpdatingTx ? 'Đang lưu...' : 'Lưu'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
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

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-mono tabular-nums font-bold text-[#059669] whitespace-nowrap mr-1">
                          +{formatVnd(tx.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditTransaction(tx)}
                          aria-label={`Chỉnh sửa khoản tiết kiệm ${tx.category}`}
                          title="Chỉnh sửa"
                          className="p-1.5 text-stone-400 hover:text-[#0F766E] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteTransaction(tx.id)}
                          aria-label={`Xóa khoản tiết kiệm ${tx.category}`}
                          title="Xóa"
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
