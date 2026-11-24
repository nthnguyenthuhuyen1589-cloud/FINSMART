import type {
  AdvisoryMode,
  FinancialPlan,
  FinancialProfile,
  PlanActionStep,
  PlanAllocation,
  ProfileSnapshot,
  TransactionItem,
} from '../types.ts';
import {
  computeFinancialDiagnostics,
  type FinancialDiagnostics,
} from './financialDiagnostics.ts';

export type GeneratedPlanDraft = Omit<
  FinancialPlan,
  'id' | 'sessionId' | 'conversationId' | 'createdAt'
>;

export interface RulesFinancialMetrics {
  profileIncome: number;
  extraMonthIncome: number;
  totalIncome: number;
  incomeSourceNote: string;
  plannedExpenses: number;
  essentialPlanned: number;
  flexiblePlanned: number;
  actualMonthExpense: number;
  actualMonthSavings: number;
  totalSavedAllTime: number;
  projectedBalance: number;
  actualMonthBalance: number;
  projectedSavingsRatePct: number;
  actualMonthSavingsRatePct: number;
  essentialSharePct: number;
  flexibleSharePct: number;
  essentialBaseForEmergency: number;
  emergencyTarget3Months: number;
  emergencyTarget6Months: number;
  emergencyRemaining3Months: number;
  emergencyRemaining6Months: number;
  goalTargetAmount: number;
  goalRemaining: number;
  goalRequiredMonthly: number | null;
  goalRequiredWeekly: number | null;
  safeMonthlyDebtLimit: number;
  disposableAfterEssential: number;
  budgetOverrunAmount: number;
  unplannedExpense: number;
  diagnostics: FinancialDiagnostics;
}

export interface RulesConsultationOutput {
  needsMoreInfo: boolean;
  replyMarkdown: string;
  hasPlan: boolean;
  plan?: GeneratedPlanDraft;
  metrics: RulesFinancialMetrics;
}

function formatVnd(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('vi-VN').format(safe) + ' đ';
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Trích xuất số tiền (VNĐ) người dùng nêu rõ trong câu hỏi chat nếu hồ sơ chưa có số liệu,
 * ví dụ: "4 triệu", "5.5 triệu", "12tr", "4.000.000", "500k".
 */
function parseVietnameseAmountFromText(text: string): {
  incomeMentioned: number | null;
  loanMentioned: number | null;
  loanMonths: number | null;
} {
  const normalized = text.toLowerCase();

  const extractAfterPattern = (regex: RegExp): number | null => {
    const match = regex.exec(normalized);
    if (!match) return null;
    const rawNum = match[1].replace(/\./g, '').replace(',', '.');
    const num = Number(rawNum);
    if (!Number.isFinite(num) || num <= 0) return null;
    const unit = (match[2] || '').trim();
    if (unit.startsWith('tr')) return Math.round(num * 1_000_000);
    if (unit === 'k' || unit.startsWith('nghìn') || unit.startsWith('ngàn')) {
      return Math.round(num * 1_000);
    }
    if (num < 100) return Math.round(num * 1_000_000);
    return Math.round(num);
  };

  const incomeMentioned =
    extractAfterPattern(
      /(?:thu nhập|lương|tiền sinh hoạt|mỗi tháng có|kiếm được|có khoảng|mức)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|k|nghìn|ngàn|đồng|đ|vnd)?/i
    ) ??
    extractAfterPattern(
      /(\d+(?:[.,]\d+)?)\s*(triệu|tr)(?:\s*đồng)?\s*(?:\/|\s*mỗi|\s*1)?\s*tháng/i
    );

  const loanMentioned = extractAfterPattern(
    /(?:vay|trả góp|mượn|khoản vay)\s*(?:khoảng|tầm)?\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|k|nghìn|ngàn|đồng|đ|vnd)?/i
  );

  const monthMatch = /(\d{1,2})\s*tháng/i.exec(normalized);
  const loanMonths =
    monthMatch && Number(monthMatch[1]) > 0 && Number(monthMatch[1]) <= 120
      ? Number(monthMatch[1])
      : null;

  return {
    incomeMentioned,
    loanMentioned,
    loanMonths,
  };
}

function detectAdvisoryIntent(
  userMessage: string,
  explicitMode: AdvisoryMode,
  metrics: RulesFinancialMetrics
): AdvisoryMode {
  const lower = userMessage.toLowerCase();
  if (
    lower.includes('vay') ||
    lower.includes('trả góp') ||
    lower.includes('nợ') ||
    lower.includes('mượn tiền')
  ) {
    return 'loan_check';
  }
  if (
    lower.includes('vượt quá thu nhập') ||
    lower.includes('bội chi') ||
    lower.includes('hết tiền') ||
    lower.includes('âm tiền') ||
    metrics.projectedBalance < 0 ||
    metrics.budgetOverrunAmount > 0
  ) {
    if (explicitMode === 'general') {
      return 'debt_recovery';
    }
  }
  if (
    lower.includes('phát sinh') ||
    lower.includes('cắt giảm') ||
    lower.includes('tiết kiệm chi') ||
    lower.includes('tối ưu chi')
  ) {
    if (explicitMode === 'general') return 'cut_expenses';
  }
  if (lower.includes('dự phòng') || lower.includes('khẩn cấp')) {
    if (explicitMode === 'general') return 'emergency_fund';
  }
  if (lower.includes('mục tiêu')) {
    if (explicitMode === 'general') return 'savings_goal';
  }
  return explicitMode;
}

function isInvestmentRestrictedQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'chứng khoán',
    'cổ phiếu',
    'trái phiếu',
    'crypto',
    'tiền ảo',
    'tiền mã hóa',
    'bitcoin',
    'btc',
    'forex',
    'ngoại hối',
    'làm giàu nhanh',
    'đầu tư mã nào',
    'lãi suất cam kết',
  ];
  return keywords.some((kw) => lower.includes(kw));
}

export function calculateFinancialMetrics(
  profile: FinancialProfile,
  snapshots: ProfileSnapshot[] = [],
  transactions: TransactionItem[] = [],
  overrideProfileIncome?: number | null
): RulesFinancialMetrics {
  const diagnostics = computeFinancialDiagnostics(profile, snapshots, transactions);
  const usingOverrideIncome =
    profile.monthlyIncome <= 0 &&
    typeof overrideProfileIncome === 'number' &&
    overrideProfileIncome > 0;

  const profileIncome = usingOverrideIncome ? overrideProfileIncome : profile.monthlyIncome;
  const extraMonthIncome = diagnostics.monthIncome;
  const totalIncome = profileIncome + extraMonthIncome;

  const incomeSourceNote = usingOverrideIncome
    ? `Theo số liệu thu nhập bạn nêu trong câu hỏi (${formatVnd(profileIncome)})`
    : profile.monthlyIncome > 0
      ? extraMonthIncome > 0
        ? `Hồ sơ (${formatVnd(profileIncome)}) + Thu bổ sung thực tế (${formatVnd(extraMonthIncome)})`
        : `Hồ sơ tài chính (${formatVnd(profileIncome)})`
      : extraMonthIncome > 0
        ? `Thu nhập thực tế ghi trong sổ (${formatVnd(extraMonthIncome)})`
        : 'Chưa nhập thu nhập';

  const plannedExpenses = profile.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const essentialPlanned = profile.expenses
    .filter((e) => e.isEssential)
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const flexiblePlanned = profile.expenses
    .filter((e) => !e.isEssential)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const actualMonthExpense = diagnostics.monthExpense;
  const actualMonthSavings = diagnostics.monthSavings;
  const totalSavedAllTime = diagnostics.totalSavedAllTime;

  const projectedBalance = totalIncome - plannedExpenses;
  const actualMonthBalance = totalIncome - actualMonthExpense - actualMonthSavings;

  const projectedSavingsRatePct =
    totalIncome > 0 ? round1((projectedBalance / totalIncome) * 100) : 0;
  const actualMonthSavingsRatePct =
    totalIncome > 0 ? round1((actualMonthSavings / totalIncome) * 100) : 0;

  const essentialSharePct =
    totalIncome > 0 ? round1((essentialPlanned / totalIncome) * 100) : 0;
  const flexibleSharePct =
    totalIncome > 0 ? round1((flexiblePlanned / totalIncome) * 100) : 0;

  const essentialBaseForEmergency =
    essentialPlanned > 0
      ? essentialPlanned
      : plannedExpenses > 0
        ? plannedExpenses
        : totalIncome > 0
          ? Math.round(totalIncome * 0.6)
          : 0;

  const emergencyTarget3Months = essentialBaseForEmergency * 3;
  const emergencyTarget6Months = essentialBaseForEmergency * 6;
  const emergencyRemaining3Months = Math.max(0, emergencyTarget3Months - totalSavedAllTime);
  const emergencyRemaining6Months = Math.max(0, emergencyTarget6Months - totalSavedAllTime);

  const goalTargetAmount = profile.targetAmount || 0;
  const goalRemaining =
    goalTargetAmount > 0 ? Math.max(0, goalTargetAmount - totalSavedAllTime) : 0;
  const goalRequiredMonthly =
    goalTargetAmount > 0 && profile.targetMonths > 0
      ? Math.ceil(goalRemaining / profile.targetMonths)
      : null;
  const goalRequiredWeekly =
    goalRequiredMonthly !== null ? Math.ceil(goalRequiredMonthly / 4) : null;

  const essentialForDebt =
    essentialPlanned > 0
      ? essentialPlanned
      : plannedExpenses > 0
        ? plannedExpenses
        : Math.round(totalIncome * 0.6);
  const disposableAfterEssential = Math.max(0, totalIncome - essentialForDebt);
  const safeMonthlyDebtLimit =
    totalIncome > 0
      ? Math.max(
          0,
          Math.round(Math.min(totalIncome * 0.2, disposableAfterEssential * 0.5))
        )
      : 0;

  return {
    profileIncome,
    extraMonthIncome,
    totalIncome,
    incomeSourceNote,
    plannedExpenses,
    essentialPlanned,
    flexiblePlanned,
    actualMonthExpense,
    actualMonthSavings,
    totalSavedAllTime,
    projectedBalance,
    actualMonthBalance,
    projectedSavingsRatePct,
    actualMonthSavingsRatePct,
    essentialSharePct,
    flexibleSharePct,
    essentialBaseForEmergency,
    emergencyTarget3Months,
    emergencyTarget6Months,
    emergencyRemaining3Months,
    emergencyRemaining6Months,
    goalTargetAmount,
    goalRemaining,
    goalRequiredMonthly,
    goalRequiredWeekly,
    safeMonthlyDebtLimit,
    disposableAfterEssential,
    budgetOverrunAmount: diagnostics.budgetOverrunAmount,
    unplannedExpense: diagnostics.unplannedExpense,
    diagnostics,
  };
}

function buildRuleBasedMonthlyPlan(
  profile: FinancialProfile,
  metrics: RulesFinancialMetrics,
  effectiveMode: AdvisoryMode
): GeneratedPlanDraft | undefined {
  if (metrics.totalIncome <= 0) return undefined;

  const income = metrics.totalIncome;
  const isStudentOrTight = profile.roleType === 'Sinh viên' || income <= 6_000_000;
  const targetSavingsRate = isStudentOrTight ? 0.15 : 0.2;
  const targetSavings = Math.max(200_000, Math.round((income * targetSavingsRate) / 50_000) * 50_000);

  const nonZeroExpenses = profile.expenses.filter((e) => (e.amount || 0) > 0);
  const allocations: PlanAllocation[] = [];

  if (nonZeroExpenses.length > 0) {
    // Use user's actual expense categories; adjust flexible items proportionally if deficit or below savings goal
    const currentSum = nonZeroExpenses.reduce((s, e) => s + e.amount, 0);
    const maxExpenseBudget = Math.max(0, income - targetSavings);
    let allocatedExpenseTotal = 0;

    if (currentSum <= maxExpenseBudget) {
      for (const exp of nonZeroExpenses) {
        allocatedExpenseTotal += exp.amount;
        allocations.push({
          category: exp.category,
          group: exp.isEssential ? 'Thiết yếu' : 'Cá nhân & Linh hoạt',
          amount: exp.amount,
          percentage: round1((exp.amount / income) * 100),
          rationale: exp.isEssential
            ? 'Khoản chi thiết yếu theo số liệu hồ sơ thực tế của bạn.'
            : 'Khoản linh hoạt hiện nằm trong ngưỡng an toàn của thu nhập.',
        });
      }
    } else {
      // Preserve essential expenses first (up to budget) and trim flexible expenses mathematically
      const essentialTotal = nonZeroExpenses
        .filter((e) => e.isEssential)
        .reduce((s, e) => s + e.amount, 0);
      const flexibleTotal = nonZeroExpenses
        .filter((e) => !e.isEssential)
        .reduce((s, e) => s + e.amount, 0);

      const needToCut = currentSum - maxExpenseBudget;
      const flexibleCutRatio =
        flexibleTotal > 0 ? Math.min(0.65, needToCut / flexibleTotal) : 0;
      const afterFlexibleCut =
        essentialTotal + Math.round(flexibleTotal * (1 - flexibleCutRatio));
      const essentialScale =
        afterFlexibleCut > maxExpenseBudget && essentialTotal > 0
          ? Math.max(0.75, (maxExpenseBudget - Math.round(flexibleTotal * (1 - flexibleCutRatio))) / essentialTotal)
          : 1;

      for (const exp of nonZeroExpenses) {
        const adjusted = exp.isEssential
          ? Math.round((exp.amount * essentialScale) / 10_000) * 10_000
          : Math.round((exp.amount * (1 - flexibleCutRatio)) / 10_000) * 10_000;
        const safeAmt = Math.max(0, adjusted);
        allocatedExpenseTotal += safeAmt;
        allocations.push({
          category: exp.category,
          group: exp.isEssential ? 'Thiết yếu' : 'Cá nhân & Linh hoạt',
          amount: safeAmt,
          percentage: round1((safeAmt / income) * 100),
          rationale:
            safeAmt < exp.amount
              ? `Đề xuất tối ưu từ ${formatVnd(exp.amount)} xuống ${formatVnd(safeAmt)} để chấm dứt bội chi và giữ quỹ tiết kiệm.`
              : 'Giữ nguyên theo số liệu thực tế của bạn.',
        });
      }
    }

    const savingsRemainder = Math.max(0, income - allocatedExpenseTotal);
    const emergencyHalf = Math.round((savingsRemainder * 0.6) / 10_000) * 10_000;
    const goalHalf = Math.max(0, savingsRemainder - emergencyHalf);

    if (emergencyHalf > 0) {
      allocations.push({
        category: 'Quỹ dự phòng cá nhân',
        group: 'Tiết kiệm & Dự phòng',
        amount: emergencyHalf,
        percentage: round1((emergencyHalf / income) * 100),
        rationale: `Tích lũy hướng tới mốc dự phòng 3 tháng (${formatVnd(metrics.emergencyTarget3Months)}).`,
      });
    }
    if (goalHalf > 0) {
      allocations.push({
        category: profile.financialGoal
          ? `Mục tiêu: ${profile.financialGoal}`
          : 'Tiết kiệm mục tiêu cá nhân',
        group: 'Tiết kiệm & Dự phòng',
        amount: goalHalf,
        percentage: round1((goalHalf / income) * 100),
        rationale:
          metrics.goalRequiredMonthly !== null
            ? `Bám sát mục tiêu ${formatVnd(metrics.goalTargetAmount)} (yêu cầu ${formatVnd(metrics.goalRequiredMonthly)}/tháng).`
            : 'Tạo quỹ tích lũy định kỳ sau khi đã trừ các khoản chi.',
      });
    }
  } else {
    // No individual expenses itemized yet: allocate transparently using role-appropriate ratio
    const essentialRatio = isStudentOrTight ? 0.6 : 0.5;
    const flexRatio = isStudentOrTight ? 0.25 : 0.3;

    const foodAmt = Math.round((income * (essentialRatio * 0.5)) / 50_000) * 50_000;
    const housingAmt = Math.round((income * (essentialRatio * 0.35)) / 50_000) * 50_000;
    const moveAmt = Math.round((income * (essentialRatio * 0.15)) / 50_000) * 50_000;
    const flexAmt = Math.round((income * flexRatio) / 50_000) * 50_000;
    const saveAmt = Math.max(0, income - (foodAmt + housingAmt + moveAmt + flexAmt));

    allocations.push(
      {
        category: 'Ăn uống & Sinh hoạt thiết yếu',
        group: 'Thiết yếu',
        amount: foodAmt,
        percentage: round1((foodAmt / income) * 100),
        rationale: 'Định mức chuẩn ưu tiên dinh dưỡng và sinh hoạt cơ bản.',
      },
      {
        category: 'Nhà ở / Phòng trọ / Điện nước',
        group: 'Thiết yếu',
        amount: housingAmt,
        percentage: round1((housingAmt / income) * 100),
        rationale: 'Chi phí chỗ ở cố định hàng tháng (nên giữ dưới 25% thu nhập).',
      },
      {
        category: 'Di chuyển & Học tập / Công việc',
        group: 'Thiết yếu',
        amount: moveAmt,
        percentage: round1((moveAmt / income) * 100),
        rationale: 'Chi phí đi lại, internet và phục vụ học tập/công việc.',
      },
      {
        category: 'Chi cá nhân, giải trí & phát sinh nhỏ',
        group: 'Cá nhân & Linh hoạt',
        amount: flexAmt,
        percentage: round1((flexAmt / income) * 100),
        rationale: 'Khoản linh hoạt có trần tối đa để không lấn vào tiền tiết kiệm.',
      },
      {
        category: 'Quỹ dự phòng & Tiết kiệm mục tiêu',
        group: 'Tiết kiệm & Dự phòng',
        amount: saveAmt,
        percentage: round1((saveAmt / income) * 100),
        rationale: 'Trích ngay đầu tháng khi vừa nhận thu nhập.',
      }
    );
  }

  const totalAllocatedExpenses = allocations
    .filter((a) => a.group !== 'Tiết kiệm & Dự phòng')
    .reduce((s, a) => s + a.amount, 0);
  const recommendedSavings = allocations
    .filter((a) => a.group === 'Tiết kiệm & Dự phòng')
    .reduce((s, a) => s + a.amount, 0);

  const actionSteps: PlanActionStep[] = [
    {
      timeframe: 'Tuần 1',
      title: 'Tách riêng quỹ tiết kiệm ngay khi có thu nhập',
      detail: `Chuyển ngay ${formatVnd(recommendedSavings)} (hoặc ${formatVnd(Math.round(recommendedSavings / 4))}/tuần) sang tài khoản/ví riêng trước khi chi tiêu.`,
    },
    {
      timeframe: 'Tuần 2 – 3',
      title: 'Kiểm soát trần chi tiêu hàng ngày',
      detail: `Giới hạn mức chi biến đổi trung bình khoảng ${formatVnd(Math.round(totalAllocatedExpenses / 30))}/ngày và ghi chép đầy đủ mọi khoản phát sinh tại mục Thu chi.`,
    },
    {
      timeframe: 'Cuối tháng 1',
      title: 'Đối chiếu thực tế và xử lý chênh lệch',
      detail:
        metrics.unplannedExpense > 0
          ? `Rà soát lại ${metrics.diagnostics.unplannedCount} khoản phát sinh ngoài hạn mức (${formatVnd(metrics.unplannedExpense)}) để điều chỉnh bảng phân bổ tháng tới.`
          : 'So sánh tổng chi thực tế với hạn mức từng nhóm để tinh chỉnh lại tỷ lệ cho tháng thứ 2.',
    },
    {
      timeframe: 'Tháng 2 – 6',
      title: 'Hoàn thiện quỹ dự phòng an toàn 3 tháng',
      detail: `Duy trì nhịp tiết kiệm ${formatVnd(recommendedSavings)}/tháng để tích lũy hướng tới mốc dự phòng ${formatVnd(metrics.emergencyTarget3Months)}.`,
    },
  ];

  const risksAndNotes: string[] = [
    'Phân bổ trên được tính toán hoàn toàn bằng công thức lập trình dựa trên số liệu thực tế hiện có.',
  ];
  if (metrics.projectedBalance < 0) {
    risksAndNotes.push(
      `Hồ sơ hiện đang bội chi ${formatVnd(Math.abs(metrics.projectedBalance))}/tháng; cần ưu tiên giảm nhóm Cá nhân & Linh hoạt trước.`
    );
  }
  if (metrics.budgetOverrunAmount > 0) {
    risksAndNotes.push(
      `Chi tiêu thực tế tháng này đã vượt hạn mức ${formatVnd(metrics.budgetOverrunAmount)}.`
    );
  }
  if (nonZeroExpenses.length === 0) {
    risksAndNotes.push(
      'Bạn chưa nhập chi tiết từng khoản chi trong hồ sơ nên bảng chi tiết đang chia theo tỷ lệ tham chiếu chuẩn; hãy cập nhật từng khoản chi thực tế để công thức tính sát hơn.'
    );
  }

  const modeLabelMap: Record<AdvisoryMode, string> = {
    general: 'Kế hoạch cân đối ngân sách tháng',
    cut_expenses: 'Kế hoạch tối ưu & cắt giảm chi tiêu',
    emergency_fund: 'Kế hoạch xây dựng quỹ dự phòng',
    savings_goal: 'Kế hoạch tích lũy đạt mục tiêu',
    loan_check: 'Kế hoạch ngân sách & kiểm soát ngưỡng vay',
    debt_recovery: 'Kế hoạch khắc phục bội chi 30 ngày',
  };

  return {
    title: `${modeLabelMap[effectiveMode]} (${formatVnd(income)})`,
    summary: `Tính toán tự động theo quy tắc trên mức thu nhập ${formatVnd(income)}/tháng: dự kiến chi ${formatVnd(totalAllocatedExpenses)} và dành tiết kiệm/dự phòng ${formatVnd(recommendedSavings)} (${round1((recommendedSavings / income) * 100)}%).`,
    monthlyIncome: income,
    totalExpenses: totalAllocatedExpenses,
    recommendedMonthlySavings: recommendedSavings,
    emergencyFundTarget: metrics.emergencyTarget3Months,
    allocations,
    actionSteps,
    risksAndNotes,
    adjustmentGuidance:
      'Nếu thu nhập giảm hoặc phát sinh chi phí khẩn cấp, hãy giữ nguyên nhóm Thiết yếu, tạm giảm 30–50% nhóm Cá nhân & Linh hoạt trước khi đụng vào khoản Tiết kiệm & Dự phòng.',
    planDate: profile.recordDate,
  };
}

export function runRulesConsultation(params: {
  profile: FinancialProfile;
  snapshots?: ProfileSnapshot[];
  transactions?: TransactionItem[];
  userMessage?: string;
  advisoryMode?: AdvisoryMode;
  isReanalysis?: boolean;
}): RulesConsultationOutput {
  const userMessage = (params.userMessage || '').trim();

  if (userMessage && isInvestmentRestrictedQuery(userMessage)) {
    const metrics = calculateFinancialMetrics(
      params.profile,
      params.snapshots,
      params.transactions
    );
    return {
      needsMoreInfo: false,
      hasPlan: false,
      metrics,
      replyMarkdown: `### 1. Kết quả kiểm tra phạm vi tư vấn
- **Chế độ:** Công thức & Quy tắc tài chính cá nhân FINSMART (Không AI)
- **Thu nhập đang ghi nhận:** ${formatVnd(metrics.totalIncome)} | **Quỹ tiết kiệm tích lũy:** ${formatVnd(metrics.totalSavedAllTime)}

### 2. Nhận xét tình hình
FINSMART **không cung cấp tư vấn đầu tư**, không khuyến nghị mua bán chứng khoán, cổ phiếu, trái phiếu doanh nghiệp, tiền mã hóa (crypto), forex và không cam kết lợi nhuận.

### 3. Cảnh báo
Các sản phẩm đầu tư biến động mạnh có rủi ro mất vốn cao nếu bạn chưa có quỹ dự phòng an toàn cho ít nhất 3 tháng chi tiêu thiết yếu (${formatVnd(metrics.emergencyTarget3Months)}).

### 4. Đề xuất cải thiện
Hãy tập trung xây dựng nền tảng tài chính an toàn trước: cân đối thu chi dương mỗi tháng, hoàn thiện quỹ dự phòng và tích lũy theo mục tiêu rõ ràng.

### 5. Kế hoạch hành động cụ thể
- **Bước 1:** Cập nhật đầy đủ thu nhập và chi tiêu thực tế vào Hồ sơ tài chính.
- **Bước 2:** Duy trì tỷ lệ tiết kiệm tối thiểu 15–20% thu nhập hàng tháng để hoàn thành quỹ dự phòng.`,
    };
  }

  const parsedChat = parseVietnameseAmountFromText(userMessage);
  const metrics = calculateFinancialMetrics(
    params.profile,
    params.snapshots,
    params.transactions,
    parsedChat.incomeMentioned
  );

  // Missing core data check (must NOT fabricate data)
  if (metrics.totalIncome <= 0 && metrics.plannedExpenses <= 0 && metrics.actualMonthExpense <= 0) {
    return {
      needsMoreInfo: true,
      hasPlan: false,
      metrics,
      replyMarkdown: `### 1. Kết quả tính toán từ dữ liệu thực tế
- **Thu nhập tháng hiện có:** 0 đ (Chưa nhập)
- **Tổng chi tiêu khai báo & thực tế:** 0 đ (Chưa nhập)
- **Quỹ tiết kiệm tích lũy:** ${formatVnd(metrics.totalSavedAllTime)}

### 2. Nhận xét tình hình
Hệ thống Công thức & Quy tắc chỉ tính toán trên số liệu thực tế bạn cung cấp (không tự suy đoán). Hiện hồ sơ của bạn chưa có mức thu nhập và các khoản chi cơ bản nên chưa đủ cơ sở để lập bảng phân bổ chính xác.

### 3. Cảnh báo
Thiếu dữ liệu thu nhập và chi phí thiết yếu sẽ khiến việc ước tính số dư, tỷ lệ tiết kiệm và quỹ dự phòng không phản ánh đúng hoàn cảnh của bạn.

### 4. Đề xuất cải thiện
Bạn vui lòng bổ sung 3 thông tin sau vào **Hồ sơ tài chính cá nhân** (hoặc nhắn trực tiếp trong khung chat):
1. **Thu nhập / tiền sinh hoạt hàng tháng** của bạn là bao nhiêu?
2. **Các khoản chi chính mỗi tháng** (tiền trọ/nhà, ăn uống, đi lại, chi cá nhân)?
3. **Mục tiêu tiết kiệm** hoặc vấn đề bạn đang muốn xử lý ngay (nếu có)?

### 5. Kế hoạch hành động cụ thể
- **Ngay bây giờ:** Điền nhanh số liệu vào cột Hồ sơ bên cạnh, bấm **Lưu hồ sơ** rồi bấm **Phân tích và tư vấn** để nhận ngay bảng tính chi tiết.`,
    };
  }

  const effectiveMode = detectAdvisoryIntent(
    userMessage,
    params.advisoryMode ?? 'general',
    metrics
  );

  const plan = buildRuleBasedMonthlyPlan(params.profile, metrics, effectiveMode);

  // 1. Kết quả tính toán
  const calcLines: string[] = [
    `- **Tổng thu nhập tháng:** **${formatVnd(metrics.totalIncome)}** *(${metrics.incomeSourceNote})*`,
    `- **Tổng chi tiêu khai báo (hồ sơ):** **${formatVnd(metrics.plannedExpenses)}** (Thiết yếu: ${formatVnd(metrics.essentialPlanned)} · ${metrics.essentialSharePct}% | Linh hoạt: ${formatVnd(metrics.flexiblePlanned)} · ${metrics.flexibleSharePct}%)`,
  ];

  if (metrics.actualMonthExpense > 0 || metrics.actualMonthSavings > 0 || metrics.diagnostics.monthTxCount > 0) {
    calcLines.push(
      `- **Chi tiêu thực tế đã ghi tháng ${metrics.diagnostics.activeMonthKey}:** **${formatVnd(metrics.actualMonthExpense)}** (${metrics.diagnostics.plannedBudget > 0 ? `${metrics.diagnostics.spentPct}% hạn mức` : 'chưa đặt hạn mức'} · TB ${formatVnd(metrics.diagnostics.avgDailySpent)}/ngày)`
    );
    calcLines.push(
      `- **Tiết kiệm thực tế tháng này:** **${formatVnd(metrics.actualMonthSavings)}** (${metrics.actualMonthSavingsRatePct}% thu nhập) · **Tổng tích lũy:** **${formatVnd(metrics.totalSavedAllTime)}**`
    );
  } else {
    calcLines.push(
      `- **Quỹ tiết kiệm tích lũy hiện có:** **${formatVnd(metrics.totalSavedAllTime)}** *(Chưa có giao dịch thu chi tháng này trong sổ)*`
    );
  }

  calcLines.push(
    `- **Số dư dự kiến sau chi tiêu hồ sơ:** **${metrics.projectedBalance >= 0 ? '+' : ''}${formatVnd(metrics.projectedBalance)}** (Tỷ lệ dư/tiết kiệm dự kiến: **${metrics.projectedSavingsRatePct}%**)`
  );
  calcLines.push(
    `- **Quỹ dự phòng khuyến nghị:** Mốc 3 tháng = **${formatVnd(metrics.emergencyTarget3Months)}** (còn thiếu ${formatVnd(metrics.emergencyRemaining3Months)}) · Mốc 6 tháng = **${formatVnd(metrics.emergencyTarget6Months)}**`
  );

  if (metrics.goalTargetAmount > 0) {
    calcLines.push(
      `- **Mục tiêu tiết kiệm (${params.profile.financialGoal || 'Cá nhân'}):** Mục tiêu **${formatVnd(metrics.goalTargetAmount)}**, còn thiếu **${formatVnd(metrics.goalRemaining)}**${metrics.goalRequiredMonthly !== null ? ` (cần **${formatVnd(metrics.goalRequiredMonthly)}/tháng** ≈ **${formatVnd(metrics.goalRequiredWeekly ?? 0)}/tuần**)` : ''}`
    );
  }

  if (effectiveMode === 'loan_check' || parsedChat.loanMentioned) {
    calcLines.push(
      `- **Khả năng trả nợ an toàn tối đa:** **${formatVnd(metrics.safeMonthlyDebtLimit)}/tháng** *(tính theo giới hạn ≤ 20% thu nhập và ≤ 50% phần dư sau chi thiết yếu ${formatVnd(metrics.disposableAfterEssential)})*`
    );
    if (parsedChat.loanMentioned) {
      const months = parsedChat.loanMonths || 12;
      const estMonthlyInstallment = Math.round((parsedChat.loanMentioned * 1.12) / months);
      calcLines.push(
        `- **Ước tính nghĩa vụ trả góp cho khoản ${formatVnd(parsedChat.loanMentioned)} (${months} tháng):** khoảng **${formatVnd(estMonthlyInstallment)}/tháng** → ${estMonthlyInstallment <= metrics.safeMonthlyDebtLimit ? 'Nằm trong ngưỡng an toàn' : '**Vượt ngưỡng an toàn tài chính**'}`
      );
    }
  }

  // 2. Nhận xét tình hình
  const assessmentParts: string[] = [];
  if (params.isReanalysis) {
    assessmentParts.push('Đã cập nhật tính toán lại theo dữ liệu hồ sơ và thu chi mới nhất trên thiết bị.');
  }
  if (metrics.plannedExpenses === 0 && metrics.actualMonthExpense === 0) {
    assessmentParts.push(
      `Bạn đã có mức thu nhập ${formatVnd(metrics.totalIncome)}/tháng nhưng chưa khai báo từng khoản chi cụ thể. Bảng kế hoạch bên dưới phân bổ theo chuẩn tỷ lệ phù hợp với nhóm **${params.profile.roleType}**.`
    );
  } else if (metrics.projectedBalance < 0) {
    assessmentParts.push(
      `Tổng chi tiêu khai báo (${formatVnd(metrics.plannedExpenses)}) đang **lớn hơn thu nhập** (${formatVnd(metrics.totalIncome)}), gây thâm hụt **${formatVnd(Math.abs(metrics.projectedBalance))}/tháng**.`
    );
  } else if (metrics.projectedSavingsRatePct < 10) {
    assessmentParts.push(
      `Số dư dự kiến hiện đạt **${formatVnd(metrics.projectedBalance)}** (**${metrics.projectedSavingsRatePct}%** thu nhập), còn khá mỏng và dễ bị ảnh hưởng nếu có khoản phát sinh đột xuất.`
    );
  } else {
    assessmentParts.push(
      `Cấu trúc thu chi dự kiến đang cân đối dương **${formatVnd(metrics.projectedBalance)}/tháng** (**${metrics.projectedSavingsRatePct}%** thu nhập), tạo nền tảng tốt để duy trì quỹ dự phòng và mục tiêu tích lũy.`
    );
  }

  if (metrics.diagnostics.expenseChangeVsPrev !== null) {
    const diff = metrics.diagnostics.expenseChangeVsPrev;
    assessmentParts.push(
      `So với tháng trước, tổng chi tiêu thực tế đang **${diff >= 0 ? 'tăng' : 'giảm'} ${formatVnd(Math.abs(diff))}**.`
    );
  }

  // 3. Cảnh báo (nếu có)
  const warnings: string[] = [];
  if (metrics.projectedBalance < 0) {
    warnings.push(
      `**Cảnh báo bội chi hồ sơ:** Đang âm ${formatVnd(Math.abs(metrics.projectedBalance))}/tháng. Nếu kéo dài sẽ phải vay mượn hoặc dùng hết tiền dự phòng.`
    );
  }
  if (metrics.budgetOverrunAmount > 0) {
    warnings.push(
      `**Cảnh báo vượt ngân sách thực tế:** Đã chi ${formatVnd(metrics.actualMonthExpense)} / hạn mức ${formatVnd(metrics.plannedExpenses)} (vượt ${formatVnd(metrics.budgetOverrunAmount)}).`
    );
  } else if (metrics.diagnostics.paceStatus === 'fast_pace') {
    warnings.push(
      `**Cảnh báo nhịp chi nhanh:** Đã dùng ${metrics.diagnostics.spentPct}% ngân sách khi mới qua ${metrics.diagnostics.elapsedPct}% số ngày của tháng. Mức chi an toàn còn lại tối đa **${formatVnd(metrics.diagnostics.safeDailyRemaining)}/ngày**.`
    );
  }
  if (metrics.unplannedExpense > 0) {
    warnings.push(
      `**Cảnh báo khoản phát sinh:** Có ${metrics.diagnostics.unplannedCount} khoản chi ngoài hạn mức tổng cộng ${formatVnd(metrics.unplannedExpense)}.`
    );
  }
  if (metrics.essentialSharePct > 65) {
    warnings.push(
      `**Tỷ trọng chi thiết yếu cao (${metrics.essentialSharePct}%):** Vượt ngưỡng khuyến nghị 60%, làm thu hẹp phần tiền để dành.`
    );
  }
  if (metrics.diagnostics.savingsStatus === 'behind_target' && metrics.goalRequiredMonthly !== null) {
    warnings.push(
      `**Tiết kiệm chậm mục tiêu:** Tháng này mới bỏ quỹ ${formatVnd(metrics.actualMonthSavings)} so với yêu cầu ${formatVnd(metrics.goalRequiredMonthly)}/tháng (thiếu ${formatVnd(metrics.diagnostics.savingsShortfall)}).`
    );
  }
  if (
    effectiveMode === 'loan_check' &&
    parsedChat.loanMentioned &&
    Math.round((parsedChat.loanMentioned * 1.12) / (parsedChat.loanMonths || 12)) >
      metrics.safeMonthlyDebtLimit
  ) {
    warnings.push(
      `**Cảnh báo rủi ro vay:** Khoản trả góp ước tính vượt ngưỡng trả nợ an toàn (${formatVnd(metrics.safeMonthlyDebtLimit)}/tháng).`
    );
  }
  if (warnings.length === 0) {
    warnings.push(
      'Chưa phát hiện cảnh báo vượt ngân sách nghiêm trọng từ dữ liệu hiện có. Hãy tiếp tục ghi chép thu chi đều đặn để theo dõi sát.'
    );
  }

  // 4. Đề xuất cải thiện
  const improvements: string[] = [];
  const topFlexible = [...params.profile.expenses]
    .filter((e) => !e.isEssential && e.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (topFlexible.length > 0) {
    const top = topFlexible[0];
    const cut20 = Math.round((top.amount * 0.2) / 10_000) * 10_000;
    improvements.push(
      `Giảm 20% khoản linh hoạt lớn nhất (**${top.category}**: ${formatVnd(top.amount)}) để giải phóng thêm **${formatVnd(cut20)}/tháng**.`
    );
  } else {
    improvements.push(
      'Tách rõ khoản chi **Thiết yếu** và **Linh hoạt** trong hồ sơ để dễ xác định phần có thể siết giảm khi cần.'
    );
  }

  if (plan) {
    improvements.push(
      `Áp dụng cơ cấu ngân sách mới: tổng chi tối ưu **${formatVnd(plan.totalExpenses)}** và trích tiết kiệm/dự phòng **${formatVnd(plan.recommendedMonthlySavings)}/tháng**.`
    );
  }

  if (effectiveMode === 'loan_check') {
    improvements.push(
      metrics.safeMonthlyDebtLimit > 0
        ? `Chỉ vay khi tổng gốc + lãi hàng tháng không quá **${formatVnd(metrics.safeMonthlyDebtLimit)}** và ưu tiên tích lũy trước tối thiểu 30–50% giá trị món đồ.`
        : 'Hiện chưa có phần dư an toàn sau chi thiết yếu; nên tạm hoãn vay trả góp và tăng phần dư trước.'
    );
  }

  if (metrics.goalRequiredMonthly !== null && metrics.goalRequiredMonthly > Math.max(0, metrics.projectedBalance)) {
    const feasibleMonths =
      plan && plan.recommendedMonthlySavings > 0
        ? Math.ceil(metrics.goalRemaining / plan.recommendedMonthlySavings)
        : null;
    improvements.push(
      feasibleMonths
        ? `Với khả năng tiết kiệm tối ưu ${formatVnd(plan?.recommendedMonthlySavings ?? 0)}/tháng, lộ trình khả thi để đạt đủ ${formatVnd(metrics.goalTargetAmount)} là khoảng **${feasibleMonths} tháng**.`
        : 'Cân nhắc kéo dài thời hạn mục tiêu hoặc tăng nguồn thu phụ để tránh tạo áp lực quá lớn lên chi sinh hoạt.'
    );
  }

  // 5. Kế hoạch hành động cụ thể
  const actionLines = (plan?.actionSteps ?? []).map(
    (s) => `- **${s.timeframe} – ${s.title}:** ${s.detail}`
  );

  const replyMarkdown = `### 1. Kết quả tính toán từ dữ liệu thực tế
${calcLines.join('\n')}

### 2. Nhận xét tình hình
${assessmentParts.join(' ')}

### 3. Cảnh báo cần lưu ý
${warnings.map((w) => `- ${w}`).join('\n')}

### 4. Đề xuất cải thiện
${improvements.map((imp) => `- ${imp}`).join('\n')}

### 5. Kế hoạch hành động cụ thể
${actionLines.join('\n')}`;

  return {
    needsMoreInfo: false,
    replyMarkdown,
    hasPlan: Boolean(plan),
    plan,
    metrics,
  };
}
