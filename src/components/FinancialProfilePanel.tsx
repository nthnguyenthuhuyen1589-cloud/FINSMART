import { Plus, RefreshCw, RotateCcw, Save, Sparkles, Trash2, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { ExpenseItem, FinancialProfile, ProfileSnapshot, UserRoleType } from '../types.ts';
import { formatRecordDateVi, formatVnd, todayIsoDate } from '../utils/format.ts';
import { DateSelectorVi } from './DateSelectorVi.tsx';
import { MoneyInput, formatShortVietnameseUnit } from './MoneyInput.tsx';

interface FinancialProfilePanelProps {
  profile: FinancialProfile;
  snapshots: ProfileSnapshot[];
  onChange: (updated: FinancialProfile) => void;
  onSaveProfile: (profileToSave: FinancialProfile) => Promise<void>;
  onResetProfile: () => Promise<void>;
  isResettingProfile?: boolean;
  onSelectSnapshot: (snapshot: ProfileSnapshot) => void;
  onDeleteSnapshot: (snapshotId: string) => Promise<void>;
  onAnalyze: (profileToAnalyze: FinancialProfile, isReanalysis: boolean) => Promise<void>;
  isAnalyzing: boolean;
  hasExistingMessages: boolean;
}

const ROLE_OPTIONS: UserRoleType[] = ['Sinh viên', 'Người mới đi làm', 'Tự do / Khác'];

const INCOME_PRESETS = [
  { label: '4 triệu', value: 4_000_000 },
  { label: '5 triệu', value: 5_000_000 },
  { label: '8 triệu', value: 8_000_000 },
  { label: '12 triệu', value: 12_000_000 },
];

export function FinancialProfilePanel({
  profile,
  snapshots,
  onChange,
  onSaveProfile,
  onResetProfile,
  isResettingProfile = false,
  onSelectSnapshot,
  onDeleteSnapshot,
  onAnalyze,
  isAnalyzing,
  hasExistingMessages,
}: FinancialProfilePanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [monthsFocused, setMonthsFocused] = useState(false);
  const [monthsDraft, setMonthsDraft] = useState('');

  const totalExpenses = profile.expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  const balance = profile.monthlyIncome - totalExpenses;
  const savingsRatio =
    profile.monthlyIncome > 0 ? Math.round((balance / profile.monthlyIncome) * 100) : 0;

  const matchingSnapshot = snapshots.find((s) => s.recordDate === profile.recordDate);

  const updateField = <K extends keyof FinancialProfile>(key: K, value: FinancialProfile[K]) => {
    setSaveMessage(null);
    onChange({
      ...profile,
      [key]: value,
    });
  };

  const updateExpense = (id: string, patch: Partial<ExpenseItem>) => {
    setSaveMessage(null);
    onChange({
      ...profile,
      expenses: profile.expenses.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const addExpense = () => {
    setSaveMessage(null);
    onChange({
      ...profile,
      expenses: [
        ...profile.expenses,
        {
          id: `exp-${Date.now().toString(36)}`,
          category: 'Khoản chi mới',
          amount: 0,
          isEssential: false,
        },
      ],
    });
  };

  const removeExpense = (id: string) => {
    setSaveMessage(null);
    onChange({
      ...profile,
      expenses: profile.expenses.filter((item) => item.id !== id),
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onSaveProfile(profile);
      setSaveMessage(`Đã lưu hồ sơ cho ngày ${formatRecordDateVi(profile.recordDate)}.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Hồ sơ tài chính cá nhân"
      className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_14px_38px_-16px_rgba(28,25,23,0.1)] rounded-2xl flex flex-col lg:h-[calc(100vh-11.5rem)] lg:min-h-[620px] overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4 shrink-0 bg-[#FFFEFC]">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-[#B45309] shrink-0 mt-0.5">
            <Wallet className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1F2937]">Hồ sơ tài chính cá nhân</h2>
            <p className="text-xs text-stone-500 mt-1">
              Điền số liệu thực tế để nhận gợi ý và kế hoạch sát với hoàn cảnh của bạn.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={isSaving || isAnalyzing || isResettingProfile}
            title="Xóa & đặt lại mục hồ sơ về mặc định"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Đặt lại</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isAnalyzing || isResettingProfile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-amber-50 hover:text-[#B45309] border border-transparent hover:border-amber-200 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
          </button>
        </div>
      </div>

      {showResetConfirm && (
        <div
          role="alertdialog"
          aria-label="Xác nhận đặt lại mục hồ sơ tài chính"
          className="px-5 py-3 bg-red-50 border-b border-red-200 flex flex-col gap-2.5 shrink-0"
        >
          <p className="text-xs text-red-800 font-medium leading-relaxed">
            Xóa toàn bộ thông tin mục hồ sơ và {snapshots.length} mốc thời gian đã lưu trên thiết bị này? Thao tác này không ảnh hưởng đến người dùng khác.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              disabled={isResettingProfile}
              className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={async () => {
                await onResetProfile();
                setShowResetConfirm(false);
                setSaveMessage('Đã đặt lại mục hồ sơ trên thiết bị này về mặc định.');
              }}
              disabled={isResettingProfile}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              {isResettingProfile ? 'Đang đặt lại...' : 'Xác nhận xóa hồ sơ'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 lg:overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {saveMessage && (
          <div className="text-xs font-medium text-[#047857] bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
            {saveMessage}
          </div>
        )}

        {/* Ngày / Tháng / Năm ghi nhận & Mốc lưu trữ */}
        <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col gap-3">
          <DateSelectorVi
            idPrefix="profile-record-date"
            value={profile.recordDate || todayIsoDate()}
            onChange={(next) => updateField('recordDate', next)}
            label="Ngày / tháng / năm ghi nhận"
          />

          <div>
            <label
              htmlFor="saved-snapshot-select"
              className="block text-xs font-semibold text-stone-700 mb-1.5"
            >
              Mốc thời gian đã lưu ({snapshots.length})
            </label>
            {snapshots.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <select
                  id="saved-snapshot-select"
                  value={matchingSnapshot ? matchingSnapshot.id : ''}
                  onChange={(e) => {
                    const chosen = snapshots.find((s) => s.id === e.target.value);
                    if (chosen) {
                      setSaveMessage(null);
                      onSelectSnapshot(chosen);
                    }
                  }}
                  className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                >
                  <option value="">Chọn mốc để xem lại...</option>
                  {snapshots.map((snap) => (
                    <option key={snap.id} value={snap.id}>
                      {formatRecordDateVi(snap.recordDate)} · Thu {formatVnd(snap.monthlyIncome)}
                    </option>
                  ))}
                </select>
                {matchingSnapshot && (
                  <button
                    type="button"
                    onClick={() => void onDeleteSnapshot(matchingSnapshot.id)}
                    aria-label={`Xóa mốc ngày ${formatRecordDateVi(matchingSnapshot.recordDate)}`}
                    title="Xóa mốc ngày này"
                    className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-stone-200 bg-white transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-500 leading-relaxed">
                Nhấn <span className="font-semibold text-stone-700">Lưu hồ sơ</span> để lưu riêng theo từng ngày/tháng/năm và theo dõi dài hạn.
              </p>
            )}
          </div>
        </div>

        {/* Nhóm đối tượng & Tên */}
        <div className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="profile-name" className="block text-xs font-semibold text-stone-700 mb-1.5">
              Tên của bạn (tùy chọn)
            </label>
            <input
              id="profile-name"
              type="text"
              value={profile.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              placeholder="Ví dụ: Minh Anh"
              className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-all"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-stone-700 mb-1.5">Nhóm đối tượng</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-[#F3EDE2]/80 border border-stone-200/70 rounded-xl">
              {ROLE_OPTIONS.map((role) => {
                const active = profile.roleType === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => updateField('roleType', role)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#0F766E] text-white shadow-sm font-semibold'
                        : 'text-stone-600 hover:text-[#1F2937] hover:bg-white/70'
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      {/* Thu nhập hàng tháng */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label htmlFor="monthly-income" className="text-xs font-semibold text-stone-700">
            Thu nhập / tiền sinh hoạt hàng tháng (VNĐ)
          </label>
          <span className="text-xs font-mono tabular-nums font-semibold text-[#059669]">
            {formatVnd(profile.monthlyIncome)}
          </span>
        </div>
        <MoneyInput
          id="monthly-income"
          value={profile.monthlyIncome}
          onChange={(next) => updateField('monthlyIncome', next)}
          placeholder="Ví dụ: 5.000.000"
          showUnitHint
          accent="emerald"
        />
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {INCOME_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => updateField('monthlyIncome', preset.value)}
              className="px-2 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-amber-50 hover:text-[#B45309] border border-transparent hover:border-amber-200 rounded-lg transition-all whitespace-nowrap text-center cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Các khoản chi tiêu cơ bản */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-stone-700">Các khoản chi tiêu cơ bản / tháng</span>
          <button
            type="button"
            onClick={addExpense}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] hover:text-[#115E59] px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Thêm khoản chi</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_156px_28px] items-center gap-2.5 px-2.5 text-[11px] font-semibold text-stone-500">
            <span>Khoản chi</span>
            <span className="text-right pr-2">Số tiền (đ)</span>
            <span aria-hidden="true" />
          </div>
          {profile.expenses.map((expense) => {
            const shortUnit = formatShortVietnameseUnit(expense.amount);
            return (
              <div
                key={expense.id}
                className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_156px_28px] items-start gap-2.5 p-2.5 bg-[#FAF8F5] hover:bg-white border border-stone-200/80 hover:border-amber-300/80 rounded-xl transition-all duration-200"
              >
                <div className="min-w-0 pt-0.5">
                  <input
                    type="text"
                    value={expense.category}
                    onChange={(e) => updateExpense(expense.id, { category: e.target.value })}
                    aria-label="Tên khoản chi"
                    className="w-full text-xs sm:text-sm font-semibold text-[#1F2937] bg-transparent border-b border-transparent focus:border-[#0F766E] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateExpense(expense.id, { isEssential: !expense.isEssential })}
                    className={`text-[11px] font-medium mt-0.5 text-left transition-colors cursor-pointer ${
                      expense.isEssential
                        ? 'text-[#0F766E] hover:text-[#115E59]'
                        : 'text-[#B45309] hover:text-[#92400E]'
                    }`}
                  >
                    {expense.isEssential ? 'Khoản thiết yếu' : 'Khoản linh hoạt'}
                  </button>
                </div>
                <div>
                  <MoneyInput
                    size="sm"
                    value={expense.amount}
                    onChange={(next) => updateExpense(expense.id, { amount: next })}
                    ariaLabel={`Số tiền cho ${expense.category}`}
                    placeholder="0"
                  />
                  {expense.amount > 0 && (
                    <span className="block text-[11px] font-medium text-stone-600 text-right mt-0.5 pr-1 tabular-nums">
                      {expense.amount.toLocaleString('vi-VN')} đ{shortUnit ? ` · ${shortUnit}` : ''}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeExpense(expense.id)}
                  aria-label={`Xóa khoản chi ${expense.category}`}
                  className="w-7 h-7 flex items-center justify-center mt-0.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Tổng hợp thu chi - Warm Charcoal #1F2937 */}
        <div className="mt-3 p-3.5 rounded-xl bg-[#1F2937] text-white shadow-md shadow-stone-900/10 grid grid-cols-3 items-stretch gap-2 text-xs">
          <div className="flex flex-col justify-between">
            <span className="block text-stone-300">Tổng chi</span>
            <span className="font-mono tabular-nums font-bold text-white text-sm mt-1 block">
              {formatVnd(totalExpenses)}
            </span>
          </div>
          <div className="flex flex-col justify-between">
            <span className="block text-stone-300">Chênh lệch</span>
            <span
              className={`font-mono tabular-nums font-bold text-sm mt-1 block ${
                balance > 0 ? 'text-[#34D399]' : balance < 0 ? 'text-[#FBBF24]' : 'text-white'
              }`}
            >
              {balance >= 0 ? '+' : ''}
              {formatVnd(balance)}
            </span>
          </div>
          <div className="flex flex-col justify-between">
            <span className="block text-stone-300">Trạng thái</span>
            <span
              className={`font-semibold text-sm mt-1 block ${
                balance > 0
                  ? 'text-[#34D399]'
                  : balance < 0
                    ? 'text-[#FBBF24]'
                    : 'text-amber-200'
              }`}
            >
              {profile.monthlyIncome === 0
                ? 'Chưa nhập thu'
                : balance > 0
                  ? `Dư ${savingsRatio}%`
                  : balance < 0
                    ? 'Bội chi'
                    : 'Cân bằng'}
            </span>
          </div>
        </div>
      </div>

      {/* Mục tiêu tài chính */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label htmlFor="financial-goal" className="block text-xs font-semibold text-stone-700 mb-1.5">
            Mục tiêu tài chính
          </label>
          <input
            id="financial-goal"
            type="text"
            value={profile.financialGoal}
            onChange={(e) => updateField('financialGoal', e.target.value)}
            placeholder="Ví dụ: Tiết kiệm quỹ dự phòng hoặc mua laptop học tập"
            className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-3">
          <div>
            <label htmlFor="target-amount" className="block text-xs font-semibold text-stone-700 mb-1.5">
              Số tiền mục tiêu (VNĐ)
            </label>
            <MoneyInput
              id="target-amount"
              value={profile.targetAmount}
              onChange={(next) => updateField('targetAmount', next)}
              placeholder="10.000.000"
              showUnitHint
            />
          </div>
          <div>
            <label htmlFor="target-months" className="block text-xs font-semibold text-stone-700 mb-1.5">
              Thời hạn (tháng, tùy chọn)
            </label>
            <input
              id="target-months"
              type="text"
              inputMode="numeric"
              placeholder="Linh hoạt (VD: 3, 12...)"
              value={monthsFocused ? monthsDraft : profile.targetMonths > 0 ? String(profile.targetMonths) : ''}
              onFocus={() => {
                setMonthsDraft(profile.targetMonths > 0 ? String(profile.targetMonths) : '');
                setMonthsFocused(true);
              }}
              onBlur={() => {
                setMonthsFocused(false);
                setMonthsDraft('');
              }}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
                setMonthsDraft(digits);
                const parsed = digits ? Math.min(240, Number(digits)) : 0;
                updateField('targetMonths', parsed);
              }}
              className="w-full px-3.5 py-2.5 text-base font-mono tabular-nums font-medium bg-white border border-stone-200 rounded-xl text-[#1F2937] placeholder:text-stone-400 placeholder:text-xs placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="current-problem" className="block text-xs font-semibold text-stone-700 mb-1.5">
            Vấn đề đang gặp phải
          </label>
          <textarea
            id="current-problem"
            rows={2}
            value={profile.currentProblem}
            onChange={(e) => updateField('currentProblem', e.target.value)}
            placeholder="Ví dụ: Cuối tháng hay hết tiền vì ăn ngoài và phát sinh nhiều khoản nhỏ..."
            className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-xl text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-y transition-all"
          />
        </div>
      </div>
      </div>

      {/* Nút hành động chính */}
      <div className="flex flex-col sm:flex-row gap-2.5 px-5 py-3.5 border-t border-stone-100 bg-white shrink-0">
        <button
          type="button"
          onClick={() => onAnalyze(profile, false)}
          disabled={isAnalyzing}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] shadow-md shadow-[#059669]/20 hover:shadow-lg hover:shadow-[#059669]/25 hover:-translate-y-0.5 active:scale-[0.98] rounded-xl transition-all duration-200 whitespace-nowrap disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer"
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{isAnalyzing ? 'Đang phân tích...' : 'Phân tích và tư vấn'}</span>
        </button>

        {hasExistingMessages && (
          <button
            type="button"
            onClick={() => onAnalyze(profile, true)}
            disabled={isAnalyzing}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Phân tích lại</span>
          </button>
        )}
      </div>
    </motion.section>
  );
}
