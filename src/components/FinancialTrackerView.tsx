import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Gauge,
  PiggyBank,
  Plus,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import type {
  AdvisoryMode,
  FinancialPlan,
  FinancialProfile,
  ProfileSnapshot,
  TransactionItem,
  TransactionType,
} from '../types.ts';
import {
  buildFactBasedReanalysisPrompt,
  computeFinancialDiagnostics,
} from '../utils/financialDiagnostics.ts';
import {
  formatMonthYearVi,
  formatRecordDateVi,
  formatVnd,
  getMonthYearKey,
  getYearKey,
  todayIsoDate,
} from '../utils/format.ts';
import { DateSelectorVi } from './DateSelectorVi.tsx';
import { MoneyInput } from './MoneyInput.tsx';

interface FinancialTrackerViewProps {
  profile: FinancialProfile;
  snapshots: ProfileSnapshot[];
  transactions: TransactionItem[];
  plans: FinancialPlan[];
  aiEnabled: boolean;
  onCreateTransaction: (input: {
    txDate: string;
    type: TransactionType;
    category: string;
    amount: number;
    note: string;
  }) => Promise<void>;
  onCreateTransactionsBatch: (
    items: Array<{
      txDate: string;
      type: TransactionType;
      category: string;
      amount: number;
      note: string;
    }>
  ) => Promise<void>;
  onDeleteTransaction: (txId: string) => Promise<void>;
  onResetTransactions: (type?: TransactionType) => Promise<void>;
  isResettingTransactions?: boolean;
  onLoadSnapshotToProfile: (snapshot: ProfileSnapshot) => void;
  onDeleteSnapshot: (snapshotId: string) => Promise<void>;
  onGoToConsult: () => void;
  onAskAdvisor: (prompt: string, mode?: AdvisoryMode, overrideAiEnabled?: boolean) => void;
}

const QUICK_AMOUNTS = [
  { label: '30k', value: 30_000 },
  { label: '50k', value: 50_000 },
  { label: '100k', value: 100_000 },
  { label: '200k', value: 200_000 },
  { label: '500k', value: 500_000 },
];

const EXPENSE_PRESET_CATEGORIES = [
  'Ăn uống & Sinh hoạt',
  'Cà phê / Đồ uống / Ăn vặt',
  'Đi chợ / Siêu thị / Nhu yếu phẩm',
  'Nhà ở / Phòng trọ / Điện nước',
  'Internet / Điện thoại / 4G',
  'Di chuyển / Xăng xe / Gửi xe',
  'Học tập / Sách vở / Khóa học',
  'Công việc / Thiết bị / Công cụ',
  'Sức khỏe / Thuốc men / Thể thao',
  'Quần áo / Chăm sóc cá nhân',
  'Giải trí / Phim ảnh / Du lịch',
  'Hiếu hỉ / Quà tặng / Giao lưu',
  'Gia đình / Hỗ trợ người thân',
  'Trả góp / Trả nợ định kỳ',
  'Chi phát sinh đột xuất',
];

const INCOME_CATEGORIES = [
  'Lương / Trợ cấp tháng',
  'Làm thêm / Bán thời gian',
  'Freelance / Dự án ngoài',
  'Thưởng / Phụ cấp / Hoa hồng',
  'Học bổng / Hỗ trợ học tập',
  'Gia đình chu cấp / Quà tặng',
  'Bán đồ cũ / Thu hồi tiền',
  'Khoản thu khác',
];

const SAVINGS_CATEGORIES = [
  'Quỹ dự phòng khẩn cấp',
  'Tiết kiệm mục tiêu lớn',
  'Quỹ học tập / Nâng cấp bản thân',
  'Quỹ du lịch / Trải nghiệm',
  'Tiền để dành cuối ngày / cuối tuần',
  'Khoản tích lũy khác',
];

interface CustomBatchRow {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  note: string;
}

export function FinancialTrackerView({
  profile,
  snapshots,
  transactions,
  plans,
  aiEnabled,
  onCreateTransaction,
  onCreateTransactionsBatch,
  onDeleteTransaction,
  onResetTransactions,
  isResettingTransactions = false,
  onLoadSnapshotToProfile,
  onDeleteSnapshot,
  onGoToConsult,
  onAskAdvisor,
}: FinancialTrackerViewProps) {
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | TransactionType>('all');
  const [resetConfirmMode, setResetConfirmMode] = useState<'savings' | 'all' | null>(null);

  // Form ghi nhanh giao dịch hàng ngày (hỗ trợ nhập nhiều khoản cùng lúc hoặc 1 khoản lẻ)
  const [entryMode, setEntryMode] = useState<'batch' | 'single'>('batch');
  const [txDate, setTxDate] = useState<string>(() => todayIsoDate());
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => profile.expenses[0]?.category || 'Ăn uống & Sinh hoạt'
  );
  const [customCategory, setCustomCategory] = useState<string>('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txNote, setTxNote] = useState<string>('');
  const [batchDrafts, setBatchDrafts] = useState<
    Record<string, { amount: number; note: string }>
  >({});
  const [customBatchRows, setCustomBatchRows] = useState<CustomBatchRow[]>([]);
  const [isSubmittingTx, setIsSubmittingTx] = useState<boolean>(false);
  const [txFeedback, setTxFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Công cụ ước tính mục tiêu tiết kiệm linh hoạt
  const [goalAmount, setGoalAmount] = useState<number>(profile.targetAmount || 10_000_000);
  const [monthlySave, setMonthlySave] = useState<number>(
    Math.max(500_000, Math.round((profile.monthlyIncome || 5_000_000) * 0.15))
  );

  const categoryChoices = useMemo(() => {
    if (txType === 'income') return INCOME_CATEGORIES;
    if (txType === 'savings') return SAVINGS_CATEGORIES;
    const fromProfile = profile.expenses
      .map((e) => e.category.trim())
      .filter(Boolean);
    return Array.from(new Set([...fromProfile, ...EXPENSE_PRESET_CATEGORIES]));
  }, [txType, profile.expenses]);

  const effectiveCategory =
    selectedCategory === '__custom__'
      ? customCategory.trim() || 'Khoản khác'
      : categoryChoices.includes(selectedCategory)
        ? selectedCategory
        : categoryChoices[0] || 'Khoản khác';

  const handleTypeSwitch = (nextType: TransactionType) => {
    setTxType(nextType);
    setTxFeedback(null);
    if (nextType === 'income') {
      setSelectedCategory(INCOME_CATEGORIES[0]);
    } else if (nextType === 'savings') {
      setSelectedCategory(SAVINGS_CATEGORIES[0]);
    } else {
      setSelectedCategory(profile.expenses[0]?.category || 'Ăn uống & Sinh hoạt');
    }
    setCustomCategory('');
  };

  const updateBatchDraft = (
    type: TransactionType,
    category: string,
    patch: Partial<{ amount: number; note: string }>
  ) => {
    const key = `${type}::${category}`;
    setTxFeedback(null);
    setBatchDrafts((prev) => {
      const current = prev[key] || { amount: 0, note: '' };
      return {
        ...prev,
        [key]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const addCustomBatchRow = () => {
    setTxFeedback(null);
    setCustomBatchRows((prev) => [
      ...prev,
      {
        id: `custom-${Date.now().toString(36)}-${prev.length}`,
        type: txType,
        category: '',
        amount: 0,
        note: '',
      },
    ]);
  };

  const updateCustomBatchRow = (id: string, patch: Partial<CustomBatchRow>) => {
    setTxFeedback(null);
    setCustomBatchRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const removeCustomBatchRow = (id: string) => {
    setCustomBatchRows((prev) => prev.filter((row) => row.id !== id));
  };

  const pendingBatchItems = useMemo(() => {
    const items: Array<{
      txDate: string;
      type: TransactionType;
      category: string;
      amount: number;
      note: string;
    }> = [];

    for (const [key, val] of Object.entries(batchDrafts)) {
      if (!val || val.amount <= 0) continue;
      const sepIdx = key.indexOf('::');
      if (sepIdx === -1) continue;
      const rawType = key.slice(0, sepIdx) as TransactionType;
      const category = key.slice(sepIdx + 2);
      items.push({
        txDate,
        type: rawType,
        category,
        amount: val.amount,
        note: val.note.trim(),
      });
    }

    for (const row of customBatchRows) {
      if (row.amount <= 0) continue;
      items.push({
        txDate,
        type: row.type,
        category: row.category.trim() || 'Khoản khác',
        amount: row.amount,
        note: row.note.trim(),
      });
    }

    return items;
  }, [batchDrafts, customBatchRows, txDate]);

  const pendingBatchTotal = useMemo(
    () => pendingBatchItems.reduce((sum, item) => sum + item.amount, 0),
    [pendingBatchItems]
  );

  const handleClearBatchDrafts = () => {
    setBatchDrafts({});
    setCustomBatchRows([]);
    setTxFeedback(null);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingBatchItems.length === 0) {
      setTxFeedback({
        kind: 'err',
        text: 'Vui lòng nhập số tiền cho ít nhất 1 hạng mục trước khi lưu.',
      });
      return;
    }

    setIsSubmittingTx(true);
    setTxFeedback(null);
    try {
      await onCreateTransactionsBatch(pendingBatchItems);
      const savedCount = pendingBatchItems.length;
      setBatchDrafts({});
      setCustomBatchRows([]);
      setTxFeedback({
        kind: 'ok',
        text: `Đã ghi ${savedCount} khoản cho ngày ${formatRecordDateVi(txDate)}.`,
      });
    } catch (err) {
      setTxFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Chưa thể lưu danh sách giao dịch.',
      });
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (txAmount <= 0) {
      setTxFeedback({ kind: 'err', text: 'Vui lòng nhập số tiền lớn hơn 0.' });
      return;
    }
    setIsSubmittingTx(true);
    setTxFeedback(null);
    try {
      await onCreateTransaction({
        txDate,
        type: txType,
        category: effectiveCategory,
        amount: txAmount,
        note: txNote.trim(),
      });
      setTxAmount(0);
      setTxNote('');
      setTxFeedback({
        kind: 'ok',
        text: `Đã ghi vào sổ ngày ${formatRecordDateVi(txDate)} (${effectiveCategory}).`,
      });
    } catch (err) {
      setTxFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Chưa thể lưu giao dịch lúc này.',
      });
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const s of snapshots) {
      const y = getYearKey(s.recordDate);
      if (y) years.add(y);
    }
    for (const t of transactions) {
      const y = getYearKey(t.txDate);
      if (y) years.add(y);
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [snapshots, transactions]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const s of snapshots) {
      if (yearFilter !== 'all' && getYearKey(s.recordDate) !== yearFilter) continue;
      const mk = getMonthYearKey(s.recordDate);
      if (mk) months.add(mk);
    }
    for (const t of transactions) {
      if (yearFilter !== 'all' && getYearKey(t.txDate) !== yearFilter) continue;
      const mk = getMonthYearKey(t.txDate);
      if (mk) months.add(mk);
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [snapshots, transactions, yearFilter]);

  const filteredSnapshots = useMemo(
    () =>
      snapshots.filter((s) => {
        if (yearFilter !== 'all' && getYearKey(s.recordDate) !== yearFilter) return false;
        if (monthFilter !== 'all' && getMonthYearKey(s.recordDate) !== monthFilter) return false;
        return true;
      }),
    [snapshots, yearFilter, monthFilter]
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        if (yearFilter !== 'all' && getYearKey(t.txDate) !== yearFilter) return false;
        if (monthFilter !== 'all' && getMonthYearKey(t.txDate) !== monthFilter) return false;
        if (txTypeFilter !== 'all' && t.type !== txTypeFilter) return false;
        return true;
      }),
    [transactions, yearFilter, monthFilter, txTypeFilter]
  );

  const currentMonthKey = useMemo(() => getMonthYearKey(todayIsoDate()), []);
  const activeTrackMonthKey =
    monthFilter !== 'all' ? monthFilter : availableMonths[0] || currentMonthKey;

  const monthlyBudgetCheck = useMemo(() => {
    const monthTx = transactions.filter(
      (t) => getMonthYearKey(t.txDate) === activeTrackMonthKey
    );

    const spentByCat = new Map<string, number>();
    let totalSpent = 0;
    let totalExtraIncome = 0;
    let totalSavedInMonth = 0;

    for (const t of monthTx) {
      if (t.type === 'expense') {
        totalSpent += t.amount;
        spentByCat.set(t.category, (spentByCat.get(t.category) || 0) + t.amount);
      } else if (t.type === 'income') {
        totalExtraIncome += t.amount;
      } else if (t.type === 'savings') {
        totalSavedInMonth += t.amount;
      }
    }

    const totalPlannedBudget = profile.expenses.reduce((s, e) => s + (e.amount || 0), 0);

    // Build rows comparing profile expense limits vs actual logged expenses
    const rows: Array<{
      category: string;
      planned: number;
      actual: number;
      pct: number;
      isOver: boolean;
      isNear: boolean;
    }> = [];

    for (const item of profile.expenses) {
      const actual = spentByCat.get(item.category) || 0;
      if (item.amount === 0 && actual === 0) continue;
      const pct = item.amount > 0 ? Math.round((actual / item.amount) * 100) : actual > 0 ? 100 : 0;
      rows.push({
        category: item.category,
        planned: item.amount,
        actual,
        pct,
        isOver: item.amount > 0 && actual > item.amount,
        isNear: item.amount > 0 && actual <= item.amount && pct >= 80,
      });
    }

    for (const [cat, actual] of spentByCat.entries()) {
      if (!profile.expenses.some((e) => e.category === cat)) {
        rows.push({
          category: cat,
          planned: 0,
          actual,
          pct: 100,
          isOver: true,
          isNear: false,
        });
      }
    }

    // Month pacing calculation
    const match = /^(\d{4})-(\d{2})$/.exec(activeTrackMonthKey);
    const daysInMonth = match
      ? new Date(Number(match[1]), Number(match[2]), 0).getDate()
      : 30;
    const isCurrentMonth = activeTrackMonthKey === currentMonthKey;
    const todayDay = new Date().getDate();
    const elapsedDays = isCurrentMonth ? Math.max(1, todayDay) : daysInMonth;
    const remainingDays = isCurrentMonth ? Math.max(1, daysInMonth - todayDay + 1) : 1;
    const elapsedPct = Math.round((elapsedDays / daysInMonth) * 100);
    const spentPct =
      totalPlannedBudget > 0 ? Math.round((totalSpent / totalPlannedBudget) * 100) : 0;
    const avgDailySpent = Math.round(totalSpent / elapsedDays);
    const remainingBudget = totalPlannedBudget - totalSpent;
    const safeDailyRemaining =
      remainingBudget > 0 ? Math.round(remainingBudget / remainingDays) : 0;

    return {
      monthTxCount: monthTx.length,
      totalSpent,
      totalExtraIncome,
      totalSavedInMonth,
      totalPlannedBudget,
      spentPct,
      elapsedPct,
      elapsedDays,
      daysInMonth,
      remainingDays,
      avgDailySpent,
      remainingBudget,
      safeDailyRemaining,
      isCurrentMonth,
      rows,
    };
  }, [transactions, activeTrackMonthKey, currentMonthKey, profile.expenses]);

  const totalSavedAllTime = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'savings')
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const goalProgressPct =
    profile.targetAmount > 0
      ? Math.min(100, Math.round((totalSavedAllTime / profile.targetAmount) * 100))
      : 0;

  const stats = useMemo(() => {
    const source = filteredSnapshots;
    if (source.length === 0) {
      const currentExpense = profile.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      return {
        avgIncome: profile.monthlyIncome,
        avgExpense: currentExpense,
        avgBalance: profile.monthlyIncome - currentExpense,
        essentialTotal: profile.expenses
          .filter((e) => e.isEssential)
          .reduce((sum, e) => sum + (e.amount || 0), 0),
        flexibleTotal: profile.expenses
          .filter((e) => !e.isEssential)
          .reduce((sum, e) => sum + (e.amount || 0), 0),
      };
    }

    let incomeSum = 0;
    let expenseSum = 0;
    let essentialSum = 0;
    let flexibleSum = 0;

    for (const snap of source) {
      incomeSum += snap.monthlyIncome || 0;
      for (const exp of snap.expenses) {
        const amt = exp.amount || 0;
        expenseSum += amt;
        if (exp.isEssential) essentialSum += amt;
        else flexibleSum += amt;
      }
    }

    const avgIncome = Math.round(incomeSum / source.length);
    const avgExpense = Math.round(expenseSum / source.length);
    return {
      avgIncome,
      avgExpense,
      avgBalance: avgIncome - avgExpense,
      essentialTotal: Math.round(essentialSum / source.length),
      flexibleTotal: Math.round(flexibleSum / source.length),
    };
  }, [filteredSnapshots, profile]);

  const maxBarValue = useMemo(() => {
    let maxVal = 1;
    for (const snap of filteredSnapshots) {
      const expTotal = snap.expenses.reduce((s, e) => s + (e.amount || 0), 0);
      maxVal = Math.max(maxVal, snap.monthlyIncome, expTotal);
    }
    return maxVal;
  }, [filteredSnapshots]);

  const diagnostics = useMemo(
    () =>
      computeFinancialDiagnostics(
        profile,
        snapshots,
        transactions,
        activeTrackMonthKey
      ),
    [profile, snapshots, transactions, activeTrackMonthKey]
  );

  const estimatedMonths =
    goalAmount > 0 && monthlySave > 0 ? Math.ceil(goalAmount / monthlySave) : 0;

  const handleAskMonthlyReview = (overrideAi?: boolean) => {
    onAskAdvisor(
      buildFactBasedReanalysisPrompt(profile, diagnostics),
      'cut_expenses',
      overrideAi ?? aiEnabled
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      {/* Header & Filters */}
      <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#059669] shrink-0 mt-0.5">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">
              Theo dõi thu chi sát sao theo ngày, tháng, năm
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
              Ghi chép thu chi từng ngày, đối chiếu ngay với hạn mức ngân sách và theo dõi tiến độ tích lũy thực tế.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#FAF8F5] border border-stone-200 rounded-xl px-3 py-2">
            <CalendarDays className="h-4 w-4 text-[#0F766E] shrink-0" aria-hidden="true" />
            <label htmlFor="tracker-year-filter" className="sr-only">
              Lọc theo năm
            </label>
            <select
              id="tracker-year-filter"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setMonthFilter('all');
              }}
              className="text-xs sm:text-sm bg-transparent text-[#1F2937] focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả các năm</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#FAF8F5] border border-stone-200 rounded-xl px-3 py-2">
            <label htmlFor="tracker-month-filter" className="sr-only">
              Lọc theo tháng
            </label>
            <select
              id="tracker-month-filter"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="text-xs sm:text-sm bg-transparent text-[#1F2937] focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả các tháng</option>
              {availableMonths.map((mk) => (
                <option key={mk} value={mk}>
                  {formatMonthYearVi(mk)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setResetConfirmMode('all')}
            disabled={isResettingTransactions || transactions.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Xóa tiết kiệm / Thu chi</span>
          </button>

          <button
            type="button"
            onClick={onGoToConsult}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <span>Chỉnh hạn mức hồ sơ</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

      {resetConfirmMode && (
        <div
          role="alertdialog"
          aria-label="Xác nhận xóa dữ liệu tiết kiệm và thu chi"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          <p className="text-xs sm:text-sm text-red-800 font-medium leading-relaxed">
            {resetConfirmMode === 'savings'
              ? 'Xóa toàn bộ các khoản đã bỏ quỹ tiết kiệm trên thiết bị này? Giao dịch thu chi khác và người dùng khác không bị ảnh hưởng.'
              : 'Chọn phạm vi đặt lại trên thiết bị này: bạn có thể chỉ xóa mục tiết kiệm hoặc xóa toàn bộ nhật ký thu chi & tiết kiệm.'}
          </p>
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setResetConfirmMode(null)}
              disabled={isResettingTransactions}
              className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={async () => {
                await onResetTransactions('savings');
                setResetConfirmMode(null);
              }}
              disabled={isResettingTransactions || totalSavedAllTime === 0}
              className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white hover:bg-red-100 border border-red-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Chỉ xóa mục tiết kiệm
            </button>
            {resetConfirmMode === 'all' && (
              <button
                type="button"
                onClick={async () => {
                  await onResetTransactions();
                  setResetConfirmMode(null);
                }}
                disabled={isResettingTransactions}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {isResettingTransactions ? 'Đang xóa...' : 'Xóa toàn bộ thu chi & tiết kiệm'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Symmetrical 4-Column KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <div className="p-4 rounded-2xl bg-[#1F2937] text-white shadow-md shadow-stone-900/10 flex flex-col justify-between">
          <span className="text-xs text-stone-300">Dữ liệu theo dõi</span>
          <div className="mt-2">
            <span className="text-2xl font-mono tabular-nums font-bold text-white">
              {filteredTransactions.length} giao dịch
            </span>
            <span className="block text-xs text-stone-300 mt-1">
              {filteredSnapshots.length} mốc hồ sơ · {plans.length} kế hoạch
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200/80 flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#047857]">
            Thu nhập ({formatMonthYearVi(activeTrackMonthKey)})
          </span>
          <div className="mt-2">
            <span className="text-xl font-mono tabular-nums font-bold text-[#059669]">
              {formatVnd(stats.avgIncome + monthlyBudgetCheck.totalExtraIncome)}
            </span>
            <span className="block text-xs text-stone-600 mt-1">
              Hồ sơ {formatVnd(stats.avgIncome)} · Ghi thêm {formatVnd(monthlyBudgetCheck.totalExtraIncome)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/80 flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#B45309]">
            Đã chi thực tế ({formatMonthYearVi(activeTrackMonthKey)})
          </span>
          <div className="mt-2">
            <span className="text-xl font-mono tabular-nums font-bold text-[#92400E]">
              {formatVnd(monthlyBudgetCheck.totalSpent)}
            </span>
            <span className="block text-xs text-stone-600 mt-1">
              Hạn mức hồ sơ: {formatVnd(monthlyBudgetCheck.totalPlannedBudget)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFEFC] border border-stone-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-stone-600">Đã bỏ quỹ tiết kiệm</span>
            {totalSavedAllTime > 0 && (
              <button
                type="button"
                onClick={() => setResetConfirmMode('savings')}
                disabled={isResettingTransactions}
                title="Xóa mục quỹ tiết kiệm trên thiết bị này"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                <span>Xóa</span>
              </button>
            )}
          </div>
          <div className="mt-2">
            <span className="text-xl font-mono tabular-nums font-bold text-[#0F766E]">
              {formatVnd(totalSavedAllTime)}
            </span>
            <span className="block text-xs text-stone-500 mt-1">
              {profile.targetAmount > 0
                ? `Đạt ${goalProgressPct}% mục tiêu ${formatVnd(profile.targetAmount)}`
                : `Tháng này: +${formatVnd(monthlyBudgetCheck.totalSavedInMonth)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Row: Ghi nhanh giao dịch hàng ngày (Left) & Sổ thu chi chi tiết (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: Ghi nhanh giao dịch (nhiều khoản 1 lúc hoặc 1 khoản lẻ) */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col gap-4">
          <form
            onSubmit={entryMode === 'batch' ? handleSaveBatch : handleAddTransaction}
            className="flex-1 flex flex-col justify-between gap-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <PlusCircle className="h-4 w-4 text-[#059669]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#1F2937]">
                  Ghi nhanh thu chi hàng ngày
                </h3>
              </div>

              <div className="flex items-center gap-1 bg-[#FAF8F5] border border-stone-200/80 p-0.5 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode('batch');
                    setTxFeedback(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    entryMode === 'batch'
                      ? 'bg-[#0F766E] text-white font-semibold'
                      : 'text-stone-600 hover:text-[#1F2937]'
                  }`}
                >
                  Nhập nhiều khoản
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode('single');
                    setTxFeedback(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    entryMode === 'single'
                      ? 'bg-[#0F766E] text-white font-semibold'
                      : 'text-stone-600 hover:text-[#1F2937]'
                  }`}
                >
                  Ghi 1 khoản lẻ
                </button>
              </div>
            </div>

            {txFeedback && (
              <div
                className={`text-xs font-medium rounded-xl px-3.5 py-2.5 border ${
                  txFeedback.kind === 'ok'
                    ? 'text-[#047857] bg-emerald-50 border-emerald-200'
                    : 'text-red-700 bg-red-50 border-red-200'
                }`}
              >
                {txFeedback.text}
              </div>
            )}

            {/* Chọn loại giao dịch */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F3EDE2]/80 border border-stone-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeSwitch('expense')}
                className={`px-2.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  txType === 'expense'
                    ? 'bg-[#D97706] text-white shadow-sm'
                    : 'text-stone-600 hover:bg-white/80'
                }`}
              >
                Khoản chi
              </button>
              <button
                type="button"
                onClick={() => handleTypeSwitch('income')}
                className={`px-2.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  txType === 'income'
                    ? 'bg-[#059669] text-white shadow-sm'
                    : 'text-stone-600 hover:bg-white/80'
                }`}
              >
                Khoản thu
              </button>
              <button
                type="button"
                onClick={() => handleTypeSwitch('savings')}
                className={`px-2.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  txType === 'savings'
                    ? 'bg-[#0F766E] text-white shadow-sm'
                    : 'text-stone-600 hover:bg-white/80'
                }`}
              >
                Bỏ quỹ tiết kiệm
              </button>
            </div>

            {/* Ngày / Tháng / Năm */}
            <DateSelectorVi
              idPrefix="tx-date"
              value={txDate}
              onChange={setTxDate}
              label="Ngày / tháng / năm phát sinh"
            />

            {entryMode === 'batch' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
                  <span>
                    Điền số tiền vào các hạng mục phát sinh rồi bấm lưu 1 lần ({categoryChoices.length} hạng mục):
                  </span>
                  <div className="flex items-center gap-2">
                    {pendingBatchItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearBatchDrafts}
                        className="text-stone-500 hover:text-red-600 font-medium cursor-pointer"
                      >
                        Xóa số đang nhập
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addCustomBatchRow}
                      className="inline-flex items-center gap-1 font-semibold text-[#0F766E] hover:underline cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Thêm dòng tự nhập</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,1.2fr)_136px_minmax(0,1fr)_28px] items-center gap-2 px-2.5 text-[11px] font-semibold text-stone-500">
                    <span>Hạng mục</span>
                    <span className="text-right pr-2">Số tiền (đ)</span>
                    <span>Ghi chú</span>
                    <span aria-hidden="true" />
                  </div>

                  <div className="flex flex-col gap-2 max-h-[310px] overflow-y-auto pr-1">
                    {categoryChoices.map((cat) => {
                      const key = `${txType}::${cat}`;
                      const draft = batchDrafts[key] || { amount: 0, note: '' };
                      const isFilled = draft.amount > 0;
                      return (
                        <div
                          key={key}
                          className={`grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_136px_minmax(0,1fr)_28px] items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                            isFilled
                              ? 'bg-emerald-50/50 border-emerald-300/80'
                              : 'bg-[#FAF8F5] border-stone-200/80'
                          }`}
                        >
                          <span className="text-xs sm:text-sm font-medium text-[#1F2937]">
                            {cat}
                          </span>
                          <MoneyInput
                            size="sm"
                            value={draft.amount}
                            onChange={(next) => updateBatchDraft(txType, cat, { amount: next })}
                            ariaLabel={`Số tiền cho ${cat}`}
                            placeholder="0"
                            accent={txType === 'expense' ? 'sky' : 'emerald'}
                          />
                          <input
                            type="text"
                            value={draft.note}
                            onChange={(e) =>
                              updateBatchDraft(txType, cat, { note: e.target.value })
                            }
                            placeholder="Ghi chú..."
                            aria-label={`Ghi chú cho ${cat}`}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                          />
                          <div className="hidden sm:block w-7" aria-hidden="true" />
                        </div>
                      );
                    })}

                    {customBatchRows
                      .filter((row) => row.type === txType)
                      .map((row) => (
                        <div
                          key={row.id}
                          className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_136px_minmax(0,1fr)_28px] items-center gap-2 p-2.5 rounded-xl bg-amber-50/40 border border-amber-200/80"
                        >
                          <input
                            type="text"
                            value={row.category}
                            onChange={(e) =>
                              updateCustomBatchRow(row.id, { category: e.target.value })
                            }
                            placeholder="Tên hạng mục khác..."
                            aria-label="Tên hạng mục tự nhập"
                            className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-stone-200 rounded-lg text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                          />
                          <MoneyInput
                            size="sm"
                            value={row.amount}
                            onChange={(next) => updateCustomBatchRow(row.id, { amount: next })}
                            ariaLabel="Số tiền hạng mục tự nhập"
                            placeholder="0"
                            accent={txType === 'expense' ? 'sky' : 'emerald'}
                          />
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) =>
                              updateCustomBatchRow(row.id, { note: e.target.value })
                            }
                            placeholder="Ghi chú..."
                            aria-label="Ghi chú hạng mục tự nhập"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                          />
                          <button
                            type="button"
                            onClick={() => removeCustomBatchRow(row.id)}
                            aria-label="Xóa dòng tự nhập"
                            className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
                  <span className="text-stone-600">
                    {pendingBatchItems.length > 0 ? (
                      <>
                        Đã điền <strong className="text-[#1F2937]">{pendingBatchItems.length} khoản</strong> · Tổng{' '}
                        <strong className="font-mono tabular-nums text-[#0F766E]">
                          {formatVnd(pendingBatchTotal)}
                        </strong>
                      </>
                    ) : (
                      'Chưa nhập số tiền ở dòng nào'
                    )}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingTx || pendingBatchItems.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] shadow-sm hover:shadow-md rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isSubmittingTx
                      ? 'Đang lưu...'
                      : pendingBatchItems.length > 0
                        ? `Lưu tất cả (${pendingBatchItems.length} khoản)`
                        : 'Nhập số tiền để lưu'}
                  </span>
                </button>
              </>
            ) : (
              <>
                {/* Danh mục & Số tiền */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="tx-category"
                      className="block text-xs font-semibold text-stone-700 mb-1.5"
                    >
                      Hạng mục
                    </label>
                    <select
                      id="tx-category"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] cursor-pointer"
                    >
                      {categoryChoices.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__custom__">+ Tự nhập hạng mục khác</option>
                    </select>
                    {selectedCategory === '__custom__' && (
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Nhập tên hạng mục..."
                        className="mt-2 w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                      />
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="tx-amount"
                      className="block text-xs font-semibold text-stone-700 mb-1.5"
                    >
                      Số tiền (VNĐ)
                    </label>
                    <MoneyInput
                      id="tx-amount"
                      value={txAmount}
                      onChange={setTxAmount}
                      placeholder="Ví dụ: 50.000"
                      showUnitHint
                      accent={txType === 'expense' ? 'sky' : 'emerald'}
                    />
                    <div className="grid grid-cols-5 gap-1.5 mt-2">
                      {QUICK_AMOUNTS.map((q) => (
                        <button
                          key={q.value}
                          type="button"
                          onClick={() => setTxAmount(q.value)}
                          className="py-1.5 text-[11px] font-medium text-stone-600 bg-stone-100 hover:bg-amber-50 hover:text-[#B45309] rounded-lg transition-colors text-center cursor-pointer tabular-nums"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ghi chú & Nút lưu */}
                <div>
                  <label
                    htmlFor="tx-note"
                    className="block text-xs font-semibold text-stone-700 mb-1.5"
                  >
                    Ghi chú ngắn (tùy chọn)
                  </label>
                  <input
                    id="tx-note"
                    type="text"
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    placeholder={
                      txType === 'expense'
                        ? 'Ví dụ: Cơm trưa văn phòng, đổ xăng...'
                        : txType === 'income'
                          ? 'Ví dụ: Dạy kèm cuối tuần, thưởng...'
                          : 'Ví dụ: Gửi tiết kiệm cuối tuần...'
                    }
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingTx}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] shadow-sm hover:shadow-md rounded-xl transition-all cursor-pointer disabled:opacity-60"
                >
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  <span>{isSubmittingTx ? 'Đang ghi...' : 'Ghi vào sổ ngay'}</span>
                </button>
              </>
            )}
          </form>
        </section>

        {/* Right: Nhật ký giao dịch đã ghi */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <ClipboardList className="h-4 w-4 text-[#0F766E]" aria-hidden="true" />
              <h3 className="text-base font-bold text-[#1F2937]">Nhật ký thu chi chi tiết</h3>
            </div>
            <div className="flex items-center gap-1 bg-[#FAF8F5] border border-stone-200/80 p-0.5 rounded-xl text-xs">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'expense', label: 'Chi' },
                  { id: 'income', label: 'Thu' },
                  { id: 'savings', label: 'Quỹ' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTxTypeFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    txTypeFilter === tab.id
                      ? 'bg-[#0F766E] text-white font-semibold'
                      : 'text-stone-600 hover:text-[#1F2937]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="my-auto py-10 text-center">
              <p className="text-sm text-stone-600 leading-relaxed max-w-sm mx-auto">
                Chưa có giao dịch nào trong khoảng thời gian đang chọn. Hãy ghi lại khoản chi, khoản thu hoặc tiền bỏ quỹ ở khung bên cạnh để theo dõi sát sao mỗi ngày.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="hidden sm:grid sm:grid-cols-[32px_minmax(0,1fr)_88px_118px_28px] items-center gap-2.5 px-3 text-[11px] font-semibold text-stone-500">
                <span aria-hidden="true" />
                <span>Hạng mục & Ghi chú</span>
                <span className="text-center">Ngày</span>
                <span className="text-right">Số tiền</span>
                <span aria-hidden="true" />
              </div>

              <div className="flex flex-col gap-2 max-h-[470px] overflow-y-auto pr-1">
                {filteredTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/80 grid grid-cols-1 sm:grid-cols-[32px_minmax(0,1fr)_88px_118px_28px] items-center gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 sm:contents">
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isExpense
                              ? 'bg-amber-50 text-[#B45309] border border-amber-200/80'
                              : isIncome
                                ? 'bg-emerald-50 text-[#059669] border border-emerald-200/80'
                                : 'bg-teal-50 text-[#0F766E] border border-teal-200/80'
                          }`}
                        >
                          {isExpense ? (
                            <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
                          ) : isIncome ? (
                            <ArrowDownCircle className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <PiggyBank className="h-4 w-4" aria-hidden="true" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#1F2937] leading-snug">
                            {tx.category}
                          </div>
                          <p className="text-xs text-stone-600 mt-0.5 leading-snug">
                            {tx.note ||
                              (isExpense
                                ? 'Khoản chi tiêu'
                                : isIncome
                                  ? 'Khoản thu nhập'
                                  : 'Gửi vào quỹ tiết kiệm')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:contents pl-10 sm:pl-0">
                        <span className="text-xs font-mono tabular-nums text-stone-500 sm:text-center whitespace-nowrap">
                          {formatRecordDateVi(tx.txDate)}
                        </span>

                        <span
                          className={`text-sm font-mono tabular-nums font-bold sm:text-right whitespace-nowrap ${
                            isExpense
                              ? 'text-[#B45309]'
                              : isIncome
                                ? 'text-[#059669]'
                                : 'text-[#0F766E]'
                          }`}
                        >
                          {isExpense ? '-' : '+'}
                          {formatVnd(tx.amount)}
                        </span>

                        <button
                          type="button"
                          onClick={() => void onDeleteTransaction(tx.id)}
                          aria-label={`Xóa giao dịch ${tx.category} ngày ${formatRecordDateVi(tx.txDate)}`}
                          className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Row: Theo dõi hạn mức & Nhịp chi tiêu (Left) & Ước tính mục tiêu (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: Đối chiếu hạn mức từng hạng mục & Cảnh báo nhịp chi */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <Gauge className="h-4 w-4 text-[#0F766E]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#1F2937]">
                  Đối chiếu hạn mức ({formatMonthYearVi(activeTrackMonthKey)})
                </h3>
              </div>
              {monthlyBudgetCheck.totalPlannedBudget > 0 && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border ${
                    monthlyBudgetCheck.totalSpent > monthlyBudgetCheck.totalPlannedBudget
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : monthlyBudgetCheck.spentPct > monthlyBudgetCheck.elapsedPct + 10 ||
                          monthlyBudgetCheck.spentPct >= 80
                        ? 'bg-amber-50 text-[#B45309] border-amber-200'
                        : 'bg-emerald-50 text-[#047857] border-emerald-200'
                  }`}
                >
                  {monthlyBudgetCheck.totalSpent > monthlyBudgetCheck.totalPlannedBudget ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Vượt hạn mức tháng</span>
                    </>
                  ) : monthlyBudgetCheck.spentPct > monthlyBudgetCheck.elapsedPct + 10 ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Chi nhanh hơn nhịp tháng</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Đang kiểm soát tốt</span>
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Nhịp chi tiêu theo ngày */}
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-stretch">
              <div className="flex flex-col justify-between">
                <span className="block text-stone-500">Đã dùng hạn mức</span>
                <span className="text-sm font-mono tabular-nums font-bold text-[#1F2937] mt-1 block">
                  {monthlyBudgetCheck.totalPlannedBudget > 0
                    ? `${monthlyBudgetCheck.spentPct}% (ngày ${monthlyBudgetCheck.elapsedDays}/${monthlyBudgetCheck.daysInMonth})`
                    : formatVnd(monthlyBudgetCheck.totalSpent)}
                </span>
              </div>
              <div className="flex flex-col justify-between">
                <span className="block text-stone-500">Trung bình mỗi ngày</span>
                <span className="text-sm font-mono tabular-nums font-bold text-[#B45309] mt-1 block">
                  {formatVnd(monthlyBudgetCheck.avgDailySpent)}
                </span>
              </div>
              <div className="flex flex-col justify-between">
                <span className="block text-stone-500">Mức chi an toàn còn lại</span>
                <span
                  className={`text-sm font-mono tabular-nums font-bold mt-1 block ${
                    monthlyBudgetCheck.remainingBudget >= 0 ? 'text-[#059669]' : 'text-red-600'
                  }`}
                >
                  {monthlyBudgetCheck.totalPlannedBudget === 0
                    ? 'Chưa đặt hạn mức'
                    : monthlyBudgetCheck.remainingBudget >= 0
                      ? `${formatVnd(monthlyBudgetCheck.safeDailyRemaining)}/ngày`
                      : `Vượt ${formatVnd(Math.abs(monthlyBudgetCheck.remainingBudget))}`}
                </span>
              </div>
            </div>

            {/* Thanh tiến độ từng hạng mục */}
            {monthlyBudgetCheck.rows.length === 0 ? (
              <p className="text-xs sm:text-sm text-stone-600 py-3 leading-relaxed">
                Hãy điền mức chi dự kiến trong hồ sơ tài chính hoặc ghi vài giao dịch chi tiêu để hệ thống đối chiếu từng hạng mục cho bạn.
              </p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
                {monthlyBudgetCheck.rows.map((row) => {
                  const barColor = row.isOver
                    ? 'bg-red-500'
                    : row.isNear
                      ? 'bg-[#D97706]'
                      : 'bg-[#059669]';
                  const diff = row.planned - row.actual;
                  return (
                    <div key={row.category} className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#1F2937]">{row.category}</span>
                        <span className="font-mono tabular-nums text-stone-600">
                          <strong className={row.isOver ? 'text-red-600' : 'text-[#1F2937]'}>
                            {formatVnd(row.actual)}
                          </strong>
                          {row.planned > 0 ? ` / ${formatVnd(row.planned)}` : ' (ngoài hạn mức)'}
                        </span>
                      </div>
                      <div className="h-2 bg-stone-200/75 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, row.pct)}%` }}
                          className={`h-full rounded-full transition-all ${barColor}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span>{row.planned > 0 ? `Đã dùng ${row.pct}%` : 'Chưa có hạn mức'}</span>
                        {row.planned > 0 && (
                          <span className={diff >= 0 ? 'text-[#0F766E]' : 'text-red-600 font-semibold'}>
                            {diff >= 0 ? `Còn ${formatVnd(diff)}` : `Vượt ${formatVnd(Math.abs(diff))}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-xs text-stone-600">
              Nhận gợi ý siết chi phù hợp với số liệu thực tế:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAskMonthlyReview(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Đánh giá Có AI</span>
              </button>
              <button
                type="button"
                onClick={() => handleAskMonthlyReview(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
              >
                <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Đánh giá Không AI</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right: Tiến độ mục tiêu & Công cụ ước tính linh hoạt */}
        <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
              <Calculator className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
              <h3 className="text-base font-bold text-[#1F2937]">
                Tiến độ & Ước tính mục tiêu tiết kiệm
              </h3>
            </div>

            {profile.targetAmount > 0 && (
              <div className="mt-4 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#047857]">
                    Mục tiêu hiện tại: {profile.financialGoal || 'Quỹ tiết kiệm'}
                  </span>
                  <span className="font-mono tabular-nums font-bold text-[#059669]">
                    {formatVnd(totalSavedAllTime)} / {formatVnd(profile.targetAmount)} ({goalProgressPct}%)
                  </span>
                </div>
                <div className="h-2.5 bg-white rounded-full overflow-hidden border border-emerald-200/70">
                  <div
                    style={{ width: `${goalProgressPct}%` }}
                    className="h-full bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-full transition-all"
                  />
                </div>
              </div>
            )}

            <p className="text-xs sm:text-sm text-stone-600 mt-3 leading-relaxed">
              Thử thay đổi số tiền mục tiêu và mức tích lũy hàng tháng để xem lộ trình dự kiến phù hợp với khả năng của bạn.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-4 mt-4">
              <div>
                <label
                  htmlFor="calc-goal-amount"
                  className="block text-xs font-semibold text-stone-700 mb-1.5"
                >
                  Số tiền muốn đạt được (VNĐ)
                </label>
                <MoneyInput
                  id="calc-goal-amount"
                  value={goalAmount}
                  onChange={setGoalAmount}
                  placeholder="10.000.000"
                  showUnitHint
                />
              </div>

              <div>
                <label
                  htmlFor="calc-monthly-save"
                  className="block text-xs font-semibold text-stone-700 mb-1.5"
                >
                  Mức để dành mỗi tháng (VNĐ)
                </label>
                <MoneyInput
                  id="calc-monthly-save"
                  value={monthlySave}
                  onChange={setMonthlySave}
                  placeholder="1.000.000"
                  showUnitHint
                  accent="emerald"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-[#FFFDF9] to-amber-50/70 border border-emerald-200/80 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-[#059669] shrink-0">
                <PiggyBank className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <span className="block text-xs text-stone-600">Thời gian dự kiến hoàn thành</span>
                <span className="text-lg font-bold text-[#1F2937] font-mono tabular-nums">
                  {estimatedMonths > 0
                    ? `${estimatedMonths} tháng (~${(estimatedMonths / 12).toFixed(1)} năm)`
                    : 'Nhập số tiền để tính'}
                </span>
              </div>
            </div>

            {estimatedMonths > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-emerald-200/60">
                <span className="text-xs text-stone-600">
                  Mỗi tuần khoảng{' '}
                  <strong className="text-[#0F766E] font-mono tabular-nums">
                    {formatVnd(Math.round(monthlySave / 4))}
                  </strong>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onAskAdvisor(
                        `Tôi muốn đạt mục tiêu ${formatVnd(goalAmount)} bằng cách tiết kiệm khoảng ${formatVnd(monthlySave)} mỗi tháng (dự kiến ${estimatedMonths} tháng). Với thu nhập và chi tiêu thực tế hiện tại, tôi nên phân bổ các khoản chi như thế nào để duy trì đều đặn?`,
                        'savings_goal',
                        true
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Lộ trình Có AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAskAdvisor(
                        `Tôi muốn đạt mục tiêu ${formatVnd(goalAmount)} bằng cách tiết kiệm khoảng ${formatVnd(monthlySave)} mỗi tháng (dự kiến ${estimatedMonths} tháng). Với thu nhập và chi tiêu thực tế hiện tại, tôi nên phân bổ các khoản chi như thế nào để duy trì đều đặn?`,
                        'savings_goal',
                        false
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Lộ trình Không AI</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Theo dõi biến động thực tế & Nhắc nhở điều chỉnh (Không suy đoán) */}
      <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-[#D97706]" aria-hidden="true" />
            <div>
              <h3 className="text-base font-bold text-[#1F2937]">
                Nhận xét biến động & Nhắc nhở thực tế ({formatMonthYearVi(diagnostics.activeMonthKey)})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Tổng hợp trực tiếp từ số liệu đã ghi nhận trên thiết bị, hoàn toàn không tự suy đoán.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleAskMonthlyReview(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Phân tích Có AI</span>
            </button>
            <button
              type="button"
              onClick={() => handleAskMonthlyReview(false)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Phân tích Không AI</span>
            </button>
          </div>
        </div>

        {/* 3 balanced real-data variance indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-stretch">
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between gap-1">
            <span className="text-stone-500 font-medium">Khoản phát sinh ngoài hạn mức</span>
            <span
              className={`text-base font-mono tabular-nums font-bold ${
                diagnostics.unplannedExpense > 0 ? 'text-[#B45309]' : 'text-[#059669]'
              }`}
            >
              {formatVnd(diagnostics.unplannedExpense)}
            </span>
            <span className="text-[11px] text-stone-500">
              {diagnostics.unplannedCount > 0
                ? `${diagnostics.unplannedCount} khoản chưa khai báo trong hồ sơ`
                : 'Chưa phát sinh khoản ngoài dự kiến'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between gap-1">
            <span className="text-stone-500 font-medium">
              So với tháng trước ({formatMonthYearVi(diagnostics.prevMonthKey)})
            </span>
            <span
              className={`text-base font-mono tabular-nums font-bold ${
                diagnostics.expenseChangeVsPrev === null
                  ? 'text-stone-600'
                  : diagnostics.expenseChangeVsPrev > 0
                    ? 'text-red-600'
                    : 'text-[#059669]'
              }`}
            >
              {diagnostics.expenseChangeVsPrev === null
                ? 'Chưa đủ dữ liệu đối chiếu'
                : `${diagnostics.expenseChangeVsPrev >= 0 ? '+' : ''}${formatVnd(diagnostics.expenseChangeVsPrev)}`}
            </span>
            <span className="text-[11px] text-stone-500">
              {diagnostics.prevMonthTxCount > 0
                ? `Tháng trước chi ${formatVnd(diagnostics.prevMonthExpense)} · Bỏ quỹ ${formatVnd(diagnostics.prevMonthSavings)}`
                : 'Tháng trước chưa có giao dịch được ghi'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between gap-1">
            <span className="text-stone-500 font-medium">Biến động hồ sơ qua các mốc</span>
            <span
              className={`text-base font-mono tabular-nums font-bold ${
                !diagnostics.snapshotDelta
                  ? 'text-stone-600'
                  : diagnostics.snapshotDelta.balanceDiff >= 0
                    ? 'text-[#059669]'
                    : 'text-[#B45309]'
              }`}
            >
              {!diagnostics.snapshotDelta
                ? `${snapshots.length} mốc đã lưu`
                : `${diagnostics.snapshotDelta.balanceDiff >= 0 ? '+' : ''}${formatVnd(diagnostics.snapshotDelta.balanceDiff)} số dư`}
            </span>
            <span className="text-[11px] text-stone-500">
              {diagnostics.snapshotDelta
                ? `Từ ${formatRecordDateVi(diagnostics.snapshotDelta.prevDate)} đến ${formatRecordDateVi(diagnostics.snapshotDelta.latestDate)}`
                : 'Lưu từ 2 mốc hồ sơ trở lên để thấy biến động'}
            </span>
          </div>
        </div>

        {/* Fact-based reminders list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
          {diagnostics.reminders.map((rem) => {
            const boxStyle =
              rem.severity === 'danger'
                ? 'bg-red-50/75 border-red-200 text-red-900'
                : rem.severity === 'warning'
                  ? 'bg-amber-50/80 border-amber-200 text-[#92400E]'
                  : rem.severity === 'positive'
                    ? 'bg-emerald-50/75 border-emerald-200 text-[#047857]'
                    : 'bg-[#FAF8F5] border-stone-200 text-stone-700';

            return (
              <div
                key={rem.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 text-xs ${boxStyle}`}
              >
                <div className="space-y-1">
                  <div className="font-bold leading-snug">{rem.title}</div>
                  <p className="opacity-90 leading-relaxed">{rem.detail}</p>
                </div>
                <p className="pt-2 border-t border-current/15 font-medium leading-relaxed">
                  Gợi ý: {rem.suggestion}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lịch sử các mốc hồ sơ đã lưu */}
      <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <Wallet className="h-4 w-4 text-[#0F766E]" aria-hidden="true" />
            <h3 className="text-base font-bold text-[#1F2937]">
              Lịch sử các mốc hồ sơ đã lưu ({filteredSnapshots.length})
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#059669]" aria-hidden="true" />
              Thu nhập
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#D97706]" aria-hidden="true" />
              Chi tiêu
            </span>
          </div>
        </div>

        {filteredSnapshots.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-stone-600 leading-relaxed max-w-md mx-auto">
              Chưa có mốc hồ sơ nào được lưu trong khoảng thời gian này. Hãy điền thông tin ở trang{' '}
              <span className="font-semibold text-[#0F766E]">Tư vấn tài chính</span>, chọn ngày/tháng/năm và nhấn{' '}
              <span className="font-semibold text-[#059669]">Lưu hồ sơ</span>.
            </p>
            <button
              type="button"
              onClick={onGoToConsult}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
            >
              <span>Điền và lưu mốc đầu tiên</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {filteredSnapshots.map((snap) => {
              const expTotal = snap.expenses.reduce((s, e) => s + (e.amount || 0), 0);
              const diff = snap.monthlyIncome - expTotal;
              const incomePct = Math.round((snap.monthlyIncome / maxBarValue) * 100);
              const expPct = Math.round((expTotal / maxBarValue) * 100);

              return (
                <div
                  key={snap.id}
                  className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-between gap-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold text-[#1F2937] font-mono tabular-nums">
                        {formatRecordDateVi(snap.recordDate)}
                      </span>
                      <span className="text-xs text-stone-500 ml-2">
                        · {snap.roleType}
                        {snap.fullName ? ` (${snap.fullName})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onLoadSnapshotToProfile(snap)}
                        className="px-2.5 py-1 text-xs font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Mở vào hồ sơ
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteSnapshot(snap.id)}
                        aria-label={`Xóa mốc ngày ${formatRecordDateVi(snap.recordDate)}`}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-stone-600 shrink-0">Thu nhập</span>
                      <div className="flex-1 h-2.5 bg-stone-200/70 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, incomePct)}%` }}
                          className="h-full bg-[#059669] rounded-full"
                        />
                      </div>
                      <span className="w-28 text-right font-mono tabular-nums font-semibold text-[#059669]">
                        {formatVnd(snap.monthlyIncome)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-stone-600 shrink-0">Chi tiêu</span>
                      <div className="flex-1 h-2.5 bg-stone-200/70 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, expPct)}%` }}
                          className="h-full bg-[#D97706] rounded-full"
                        />
                      </div>
                      <span className="w-28 text-right font-mono tabular-nums font-semibold text-[#B45309]">
                        {formatVnd(expTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1.5 border-t border-stone-200/60">
                    <span className="text-stone-600">
                      {snap.financialGoal ? `Mục tiêu: ${snap.financialGoal}` : 'Chưa ghi mục tiêu'}
                    </span>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        diff >= 0 ? 'text-[#0F766E]' : 'text-red-600'
                      }`}
                    >
                      {diff >= 0 ? `Dư +${formatVnd(diff)}` : `Bội chi ${formatVnd(diff)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </motion.div>
  );
}
