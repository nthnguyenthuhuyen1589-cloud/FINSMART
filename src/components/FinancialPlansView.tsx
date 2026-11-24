import {
  Calculator,
  CalendarDays,
  Download,
  FileText,
  Printer,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { AdvisoryMode, FinancialPlan, FinancialProfile } from '../types.ts';
import {
  buildReportMarkdown,
  formatDateVi,
  formatMonthYearVi,
  formatRecordDateVi,
  formatVnd,
  getMonthYearKey,
} from '../utils/format.ts';
import { DisclaimerBanner } from './DisclaimerBanner.tsx';

interface FinancialPlansViewProps {
  plans: FinancialPlan[];
  profile: FinancialProfile;
  selectedPlanId: string | null;
  aiEnabled: boolean;
  isGeneratingPlan?: boolean;
  onSelectPlan: (planId: string) => void;
  onDeletePlan: (planId: string) => Promise<void>;
  onGeneratePlan: (overrideAiEnabled?: boolean) => Promise<{
    plan: FinancialPlan | null;
    notice: string | null;
  }>;
  onGoToChat: (prefillPrompt?: string, mode?: AdvisoryMode, overrideAiEnabled?: boolean) => void;
}

export function FinancialPlansView({
  plans,
  profile,
  selectedPlanId,
  aiEnabled,
  isGeneratingPlan = false,
  onSelectPlan,
  onDeletePlan,
  onGeneratePlan,
  onGoToChat,
}: FinancialPlansViewProps) {
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [planFeedback, setPlanFeedback] = useState<string | null>(null);

  const handleDirectCreatePlan = async (useAi: boolean) => {
    setPlanFeedback(null);
    const result = await onGeneratePlan(useAi);
    if (result.notice) {
      setPlanFeedback(result.notice);
    } else if (result.plan) {
      setPlanFeedback(
        result.plan.source === 'rules'
          ? 'Đã tạo kế hoạch mới bằng Công thức & Quy tắc (Không AI).'
          : 'Đã tạo kế hoạch mới bằng Gemini AI.'
      );
    }
  };

  if (plans.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-12px_rgba(28,25,23,0.08)] rounded-2xl p-8 sm:p-10 text-center max-w-2xl mx-auto my-6"
      >
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#0D9488] flex items-center justify-center text-white shadow-md shadow-[#059669]/20 mb-4">
          <FileText className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-[#1F2937]">Chưa có kế hoạch tài chính nào được lưu</h2>
        <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto leading-relaxed">
          Bạn có thể tạo kế hoạch ngân sách ngay tại đây từ số liệu hồ sơ hiện tại theo chế độ{' '}
          <span className="font-semibold text-[#059669]">Có AI (Gemini)</span> hoặc{' '}
          <span className="font-semibold text-[#B45309]">Không AI (Công thức)</span>, hoặc mở khung trò chuyện tư vấn.
        </p>

        {planFeedback && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-[#92400E] text-left">
            {planFeedback}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            disabled={isGeneratingPlan}
            onClick={() => void handleDirectCreatePlan(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] hover:shadow-lg hover:shadow-[#059669]/20 hover:-translate-y-0.5 active:scale-[0.98] rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{isGeneratingPlan ? 'Đang tạo...' : 'Tạo kế hoạch Có AI'}</span>
          </button>

          <button
            type="button"
            disabled={isGeneratingPlan}
            onClick={() => void handleDirectCreatePlan(false)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-60"
          >
            <Calculator className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{isGeneratingPlan ? 'Đang tính...' : 'Tạo kế hoạch Không AI'}</span>
          </button>

          <button
            type="button"
            onClick={() => onGoToChat()}
            className="inline-flex items-center justify-center px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
          >
            Mở khung trò chuyện
          </button>
        </div>
      </motion.section>
    );
  }

  const availableMonths = Array.from(
    new Set(plans.map((p) => getMonthYearKey(p.planDate || p.createdAt)).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));

  const filteredPlans =
    monthFilter === 'all'
      ? plans
      : plans.filter((p) => getMonthYearKey(p.planDate || p.createdAt) === monthFilter);

  const visiblePlans = filteredPlans.length > 0 ? filteredPlans : plans;
  const activePlan = visiblePlans.find((p) => p.id === selectedPlanId) ?? visiblePlans[0];

  const groupTotals = activePlan.allocations.reduce(
    (acc, item) => {
      acc[item.group] = (acc[item.group] || 0) + item.percentage;
      return acc;
    },
    {} as Record<string, number>
  );

  const essentialPct = Math.round((groupTotals['Thiết yếu'] || 0) * 10) / 10;
  const flexiblePct = Math.round((groupTotals['Cá nhân & Linh hoạt'] || 0) * 10) / 10;
  const savingsPct = Math.round((groupTotals['Tiết kiệm & Dự phòng'] || 0) * 10) / 10;

  const handleDownloadMarkdown = () => {
    const markdown = buildReportMarkdown(activePlan, profile);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-tai-chinh-${activePlan.id.slice(0, 8)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      {/* Plan Selector & Action Toolbar */}
      <div className="no-print flex flex-col gap-3.5 bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_6px_24px_-8px_rgba(28,25,23,0.06)] rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5 w-full">
          <div className="flex items-center gap-2 shrink-0 md:w-52">
            <CalendarDays className="h-4 w-4 text-[#0F766E] shrink-0" aria-hidden="true" />
            <label htmlFor="plan-month-filter" className="sr-only">
              Lọc theo tháng và năm
            </label>
            <select
              id="plan-month-filter"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-[#FAF8F5] border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] cursor-pointer"
            >
              <option value="all">Tất cả tháng/năm ({plans.length})</option>
              {availableMonths.map((mk) => (
                <option key={mk} value={mk}>
                  {formatMonthYearVi(mk)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label htmlFor="plan-select" className="sr-only">
              Chọn kế hoạch đã lưu
            </label>
            <select
              id="plan-select"
              value={activePlan.id}
              onChange={(e) => onSelectPlan(e.target.value)}
              className="w-full min-w-0 flex-1 px-3.5 py-2 text-xs sm:text-sm font-medium bg-[#FAF8F5] border border-stone-200 rounded-xl text-[#1F2937] truncate focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] cursor-pointer"
            >
              {visiblePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title} ({formatRecordDateVi(plan.planDate || plan.createdAt)})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void onDeletePlan(activePlan.id)}
              aria-label="Xóa kế hoạch này"
              title="Xóa kế hoạch này"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50/70 hover:bg-red-100 border border-red-200/80 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Xóa</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-3 border-t border-stone-100">
          <button
            type="button"
            disabled={isGeneratingPlan}
            onClick={() => void handleDirectCreatePlan(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] hover:shadow-md rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{isGeneratingPlan ? 'Đang tạo...' : 'Tạo mới (Có AI)'}</span>
          </button>

          <button
            type="button"
            disabled={isGeneratingPlan}
            onClick={() => void handleDirectCreatePlan(false)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <Calculator className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{isGeneratingPlan ? 'Đang tính...' : 'Tạo mới (Không AI)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReportPreview((v) => !v)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-[0.98]"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{showReportPreview ? 'Xem dạng bảng' : 'Xem báo cáo đầy đủ'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-2.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200/70 rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Tải .md</span>
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-2.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200/70 rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-[0.98]"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>In PDF</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onGoToChat(
                `Tôi muốn điều chỉnh kế hoạch "${activePlan.title}". Nếu chi phí sinh hoạt thay đổi hoặc có khoản phát sinh, tôi nên phân bổ lại như thế nào?`,
                'general',
                aiEnabled
              )
            }
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[#1F2937] bg-[#FAF8F5] hover:bg-stone-100 border border-stone-200 rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-[0.98]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Điều chỉnh ({aiEnabled ? 'Có AI' : 'Không AI'})</span>
          </button>
        </div>

        {planFeedback && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2 text-xs font-medium text-[#92400E]">
            {planFeedback}
          </div>
        )}
      </div>

      {showReportPreview ? (
        <article className="bg-white border border-stone-200/90 shadow-[0_12px_35px_-12px_rgba(28,25,23,0.08)] rounded-2xl p-6 sm:p-8 max-w-4xl mx-auto w-full">
          <div className="border-b border-stone-200 pb-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#059669]">
                FINSMART · Báo cáo kế hoạch tài chính cá nhân
              </p>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-lg border ${
                  activePlan.source === 'rules'
                    ? 'bg-amber-50 text-[#B45309] border-amber-200'
                    : 'bg-emerald-50 text-[#0F766E] border-emerald-200'
                }`}
              >
                {activePlan.source === 'rules'
                  ? 'Công thức & Quy tắc (Không AI)'
                  : 'Tư vấn AI · Gemini'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[#1F2937] mt-1">{activePlan.title}</h1>
            <p className="text-xs text-stone-500 mt-2">
              {activePlan.planDate ? `Kỳ ghi nhận: ${formatRecordDateVi(activePlan.planDate)} · ` : ''}
              Ngày lập: {formatDateVi(activePlan.createdAt)} · Nhóm: {profile.roleType}
              {profile.fullName ? ` · ${profile.fullName}` : ''}
            </p>
          </div>

          <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
            <div>
              <h2 className="text-base font-bold text-[#1F2937] mb-2">1. Đánh giá tổng quan</h2>
              <p>{activePlan.summary}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-stone-100 items-stretch">
              <div className="flex flex-col justify-between">
                <span className="block text-xs text-stone-500">Thu nhập tháng</span>
                <span className="text-base font-mono tabular-nums font-bold text-[#1F2937] mt-1">
                  {formatVnd(activePlan.monthlyIncome)}
                </span>
              </div>
              <div className="flex flex-col justify-between">
                <span className="block text-xs text-stone-500">Chi tiêu dự kiến</span>
                <span className="text-base font-mono tabular-nums font-bold text-[#0F766E] mt-1">
                  {formatVnd(activePlan.totalExpenses)}
                </span>
              </div>
              <div className="flex flex-col justify-between">
                <span className="block text-xs text-stone-500">Tiết kiệm / tháng</span>
                <span className="text-base font-mono tabular-nums font-bold text-[#059669] mt-1">
                  {formatVnd(activePlan.recommendedMonthlySavings)}
                </span>
              </div>
              <div className="flex flex-col justify-between">
                <span className="block text-xs text-stone-500">Mục tiêu dự phòng</span>
                <span className="text-base font-mono tabular-nums font-bold text-[#B45309] mt-1">
                  {formatVnd(activePlan.emergencyFundTarget)}
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-[#1F2937] mb-3">
                2. Bảng phân bổ ngân sách hàng tháng
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2 pr-3 font-semibold w-[22%]">Hạng mục</th>
                      <th className="py-2 px-3 font-semibold whitespace-nowrap w-[16%]">Nhóm</th>
                      <th className="py-2 px-3 font-semibold text-right whitespace-nowrap w-[15%]">Số tiền</th>
                      <th className="py-2 px-3 font-semibold text-right whitespace-nowrap w-[9%]">Tỷ lệ</th>
                      <th className="py-2 pl-3 font-semibold w-[38%]">Lý do phân bổ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePlan.allocations.map((row, idx) => (
                      <tr key={idx} className="border-b border-stone-100 align-top">
                        <td className="py-2.5 pr-3 font-medium text-[#1F2937]">{row.category}</td>
                        <td className="py-2.5 px-3 text-stone-600 whitespace-nowrap">{row.group}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1F2937] whitespace-nowrap">
                          {formatVnd(row.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-700 whitespace-nowrap">
                          {row.percentage}%
                        </td>
                        <td className="py-2.5 pl-3 text-stone-600">{row.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-[#1F2937] mb-3">
                3. Lộ trình thực hiện theo tuần và tháng
              </h2>
              <div className="space-y-3">
                {activePlan.actionSteps.map((step, idx) => (
                  <div key={idx} className="pb-3 border-b border-stone-100 last:border-none">
                    <div className="font-semibold text-[#1F2937]">
                      {step.timeframe} — {step.title}
                    </div>
                    <p className="text-stone-600 mt-1">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {activePlan.adjustmentGuidance && (
              <div>
                <h2 className="text-base font-bold text-[#1F2937] mb-2">
                  4. Phương án điều chỉnh khi tình hình thay đổi
                </h2>
                <p>{activePlan.adjustmentGuidance}</p>
              </div>
            )}

            <DisclaimerBanner />
          </div>
        </article>
      ) : (
        <>
          {/* Header & 4-Column KPI Strip */}
          <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_32px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 sm:p-6">
            <div className="flex flex-col gap-1.5 pb-5 border-b border-stone-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-stone-500">
                  {activePlan.planDate ? `Kỳ ghi nhận: ${formatRecordDateVi(activePlan.planDate)} · ` : ''}
                  Ngày lập: {formatDateVi(activePlan.createdAt)} · Nhóm: {profile.roleType}
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-lg border ${
                    activePlan.source === 'rules'
                      ? 'bg-amber-50 text-[#B45309] border-amber-200'
                      : 'bg-emerald-50 text-[#0F766E] border-emerald-200'
                  }`}
                >
                  {activePlan.source === 'rules' ? (
                    <Calculator className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                  )}
                  <span>
                    {activePlan.source === 'rules'
                      ? 'Công thức & Quy tắc (Không AI)'
                      : 'AI · Gemini'}
                  </span>
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#1F2937]">{activePlan.title}</h2>
              <p className="text-sm text-stone-600 leading-relaxed max-w-3xl">
                {activePlan.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 items-stretch">
              <div className="p-4 sm:p-5 rounded-2xl bg-[#1F2937] text-white shadow-md shadow-stone-900/10 hover:-translate-y-0.5 transition-transform duration-200 flex flex-col justify-between min-h-[112px]">
                <span className="text-xs text-stone-300 block">Thu nhập hàng tháng</span>
                <div className="mt-2">
                  <span className="text-lg sm:text-xl font-mono tabular-nums font-bold text-white block">
                    {formatVnd(activePlan.monthlyIncome)}
                  </span>
                  <span className="block text-[11px] text-stone-400 mt-1 tabular-nums">
                    Ngân sách gốc 100%
                  </span>
                </div>
              </div>
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50/40 border border-teal-200/80 hover:-translate-y-0.5 transition-transform duration-200 flex flex-col justify-between min-h-[112px]">
                <span className="text-xs font-semibold text-[#0F766E] block">Chi tiêu tối ưu dự kiến</span>
                <div className="mt-2">
                  <span className="text-lg sm:text-xl font-mono tabular-nums font-bold text-[#134E4A] block">
                    {formatVnd(activePlan.totalExpenses)}
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1 tabular-nums">
                    {activePlan.monthlyIncome > 0
                      ? `${Math.round((activePlan.totalExpenses / activePlan.monthlyIncome) * 100)}% thu nhập hàng tháng`
                      : 'Theo định mức đề xuất'}
                  </span>
                </div>
              </div>
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50/50 border border-emerald-200/80 hover:-translate-y-0.5 transition-transform duration-200 flex flex-col justify-between min-h-[112px]">
                <span className="text-xs font-semibold text-[#047857] block">Tiết kiệm khuyến nghị/tháng</span>
                <div className="mt-2">
                  <span className="text-lg sm:text-xl font-mono tabular-nums font-bold text-[#059669] block">
                    {formatVnd(activePlan.recommendedMonthlySavings)}
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1 tabular-nums">
                    {activePlan.monthlyIncome > 0
                      ? `${Math.round((activePlan.recommendedMonthlySavings / activePlan.monthlyIncome) * 100)}% thu nhập hàng tháng`
                      : 'Tích lũy định kỳ'}
                  </span>
                </div>
              </div>
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/80 hover:-translate-y-0.5 transition-transform duration-200 flex flex-col justify-between min-h-[112px]">
                <span className="text-xs font-semibold text-[#B45309] block">Mục tiêu quỹ dự phòng</span>
                <div className="mt-2">
                  <span className="text-lg sm:text-xl font-mono tabular-nums font-bold text-[#92400E] block">
                    {formatVnd(activePlan.emergencyFundTarget)}
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1 tabular-nums">
                    {activePlan.recommendedMonthlySavings > 0
                      ? `~${Math.ceil(activePlan.emergencyFundTarget / activePlan.recommendedMonthlySavings)} tháng tích lũy`
                      : 'Đệm an toàn khẩn cấp'}
                  </span>
                </div>
              </div>
            </div>

            {/* Proportional Stacked Bar */}
            <div className="mt-6 pt-5 border-t border-stone-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 text-xs">
                <span className="font-semibold text-[#1F2937]">Cơ cấu phân bổ ngân sách</span>
                <div className="flex flex-wrap items-center gap-4 text-stone-600 tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#0F766E]" aria-hidden="true" />
                    Thiết yếu: <strong className="text-[#0F766E]">{essentialPct}%</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#D97706]" aria-hidden="true" />
                    Cá nhân & Linh hoạt: <strong className="text-[#B45309]">{flexiblePct}%</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#10B981]" aria-hidden="true" />
                    Tiết kiệm & Dự phòng: <strong className="text-[#059669]">{savingsPct}%</strong>
                  </span>
                </div>
              </div>
              <div className="h-3.5 w-full rounded-full overflow-hidden bg-stone-100 flex p-0.5 gap-0.5">
                {essentialPct > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, essentialPct)}%` }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-[#0F766E] h-full rounded-l-full"
                    title={`Thiết yếu: ${essentialPct}%`}
                  />
                )}
                {flexiblePct > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, flexiblePct)}%` }}
                    transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-[#D97706] h-full"
                    title={`Cá nhân & Linh hoạt: ${flexiblePct}%`}
                  />
                )}
                {savingsPct > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, savingsPct)}%` }}
                    transition={{ duration: 0.45, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-[#10B981] h-full rounded-r-full"
                    title={`Tiết kiệm & Dự phòng: ${savingsPct}%`}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Allocation Table */}
          <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_32px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 sm:p-6">
            <h3 className="text-base font-bold text-[#1F2937] mb-4">
              Phân chia ngân sách cụ thể theo hạng mục
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2.5 pr-4 font-semibold w-[22%]">Hạng mục chi / tiết kiệm</th>
                    <th className="py-2.5 px-4 font-semibold whitespace-nowrap w-[16%]">Nhóm</th>
                    <th className="py-2.5 px-4 font-semibold text-right whitespace-nowrap w-[15%]">Số tiền / tháng</th>
                    <th className="py-2.5 px-4 font-semibold text-right whitespace-nowrap w-[11%]">Tỷ lệ</th>
                    <th className="py-2.5 pl-4 font-semibold w-[36%]">Lý do & khuyến nghị</th>
                  </tr>
                </thead>
                <tbody>
                  {activePlan.allocations.map((item, idx) => {
                    const barColor =
                      item.group === 'Tiết kiệm & Dự phòng'
                        ? 'bg-[#10B981]'
                        : item.group === 'Thiết yếu'
                          ? 'bg-[#0F766E]'
                          : 'bg-[#D97706]';
                    return (
                      <tr key={idx} className="border-b border-stone-100 hover:bg-amber-50/30 transition-colors align-top">
                        <td className="py-3.5 pr-4 font-semibold text-[#1F2937]">{item.category}</td>
                        <td className="py-3.5 px-4 text-xs font-semibold whitespace-nowrap">
                          <span
                            className={
                              item.group === 'Tiết kiệm & Dự phòng'
                                ? 'text-[#059669]'
                                : item.group === 'Thiết yếu'
                                  ? 'text-[#0F766E]'
                                  : 'text-[#B45309]'
                            }
                          >
                            {item.group}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#1F2937] whitespace-nowrap">
                          {formatVnd(item.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-stone-700 whitespace-nowrap">
                          <div className="flex flex-col items-end gap-1">
                            <span>{item.percentage}%</span>
                            <div className="w-16 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, item.percentage)}%` }}
                                className={`h-full rounded-full ${barColor}`}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 pl-4 text-xs sm:text-sm text-stone-600 leading-relaxed">
                          {item.rationale}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Action Steps & Adjustment Guidance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_32px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#1F2937] mb-4">
                  Lộ trình thực hiện theo tuần và tháng
                </h3>
                <div className="space-y-4">
                  {activePlan.actionSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="pb-4 border-b border-stone-100 last:border-none last:pb-0 flex items-start gap-3"
                    >
                      <div className="h-6 w-6 rounded-lg bg-amber-100 text-[#B45309] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#0F766E]">{step.timeframe}</div>
                        <h4 className="text-sm font-semibold text-[#1F2937] mt-0.5">{step.title}</h4>
                        <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_32px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5">
              <div>
                <h3 className="text-base font-bold text-[#1F2937] mb-2.5">
                  Phương án điều chỉnh khi tình hình thay đổi
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  {activePlan.adjustmentGuidance ||
                    'Khi thu nhập tăng/giảm hoặc phát sinh chi phí đột xuất, hãy ưu tiên giữ nguyên các khoản thiết yếu, giảm tạm nhóm linh hoạt và cập nhật lại hồ sơ để điều chỉnh kế hoạch phù hợp hơn.'}
                </p>
              </div>

              {activePlan.risksAndNotes.length > 0 && (
                <div className="pt-4 border-t border-stone-100">
                  <h4 className="text-sm font-bold text-[#1F2937] mb-2">
                    Lưu ý và điểm cần kiểm soát
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-stone-600">
                    {activePlan.risksAndNotes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </motion.div>
  );
}
