import type {
  FinancialProfile,
  ProfileSnapshot,
  TransactionItem,
} from '../types.ts';

export interface CategoryVariance {
  category: string;
  planned: number;
  actual: number;
  overAmount: number;
  pct: number;
  isUnplanned: boolean;
}

export interface SnapshotDelta {
  latestDate: string;
  prevDate: string;
  incomeDiff: number;
  expenseDiff: number;
  balanceDiff: number;
}

export interface DiagnosticReminder {
  id: string;
  severity: 'danger' | 'warning' | 'positive' | 'info';
  title: string;
  detail: string;
  suggestion: string;
}

export interface FinancialDiagnostics {
  activeMonthKey: string;
  prevMonthKey: string;
  monthTxCount: number;
  prevMonthTxCount: number;
  monthIncome: number;
  monthExpense: number;
  monthSavings: number;
  unplannedExpense: number;
  unplannedCount: number;
  prevMonthIncome: number;
  prevMonthExpense: number;
  prevMonthSavings: number;
  expenseChangeVsPrev: number | null;
  savingsChangeVsPrev: number | null;
  plannedBudget: number;
  budgetOverrunAmount: number;
  spentPct: number;
  elapsedDays: number;
  daysInMonth: number;
  remainingDays: number;
  elapsedPct: number;
  avgDailySpent: number;
  remainingBudget: number;
  safeDailyRemaining: number;
  paceStatus: 'no_data' | 'over_budget' | 'fast_pace' | 'on_track';
  overrunCategories: CategoryVariance[];
  totalSavedAllTime: number;
  goalCompletionPct: number;
  goalRemaining: number;
  requiredMonthlySavings: number | null;
  savingsShortfall: number;
  savingsStatus:
    | 'no_target'
    | 'completed'
    | 'no_month_savings'
    | 'behind_target'
    | 'on_track'
    | 'in_progress';
  snapshotDelta: SnapshotDelta | null;
  missingDataNotes: string[];
  reminders: DiagnosticReminder[];
}

function formatVndSimple(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
}

function getPreviousMonthKey(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return '';
  let year = Number(match[1]);
  let month = Number(match[2]) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function computeFinancialDiagnostics(
  profile: FinancialProfile,
  snapshots: ProfileSnapshot[] = [],
  transactions: TransactionItem[] = [],
  targetMonthKey?: string
): FinancialDiagnostics {
  const currentMonthKey = getCurrentMonthKey();
  const activeMonthKey =
    targetMonthKey && /^\d{4}-\d{2}$/.test(targetMonthKey)
      ? targetMonthKey
      : currentMonthKey;
  const prevMonthKey = getPreviousMonthKey(activeMonthKey);

  const monthTx = transactions.filter((t) => t.txDate.startsWith(activeMonthKey));
  const prevTx = prevMonthKey
    ? transactions.filter((t) => t.txDate.startsWith(prevMonthKey))
    : [];

  let monthIncome = 0;
  let monthExpense = 0;
  let monthSavings = 0;
  let unplannedExpense = 0;
  let unplannedCount = 0;

  const declaredCategories = new Set(
    profile.expenses
      .filter((e) => (e.amount || 0) > 0)
      .map((e) => e.category.trim().toLowerCase())
  );

  const spentByCat = new Map<string, number>();

  for (const tx of monthTx) {
    if (tx.type === 'income') {
      monthIncome += tx.amount;
    } else if (tx.type === 'savings') {
      monthSavings += tx.amount;
    } else if (tx.type === 'expense') {
      monthExpense += tx.amount;
      spentByCat.set(tx.category, (spentByCat.get(tx.category) || 0) + tx.amount);

      const normalized = tx.category.trim().toLowerCase();
      const isExplicitUnplanned = normalized.includes('phát sinh') || normalized.includes('đột xuất');
      const isUndeclared = !declaredCategories.has(normalized);
      if (isExplicitUnplanned || isUndeclared) {
        unplannedExpense += tx.amount;
        unplannedCount += 1;
      }
    }
  }

  let prevMonthIncome = 0;
  let prevMonthExpense = 0;
  let prevMonthSavings = 0;
  for (const tx of prevTx) {
    if (tx.type === 'income') prevMonthIncome += tx.amount;
    else if (tx.type === 'expense') prevMonthExpense += tx.amount;
    else if (tx.type === 'savings') prevMonthSavings += tx.amount;
  }

  const expenseChangeVsPrev =
    prevTx.length > 0 && monthTx.length > 0 ? monthExpense - prevMonthExpense : null;
  const savingsChangeVsPrev =
    prevTx.length > 0 && monthTx.length > 0 ? monthSavings - prevMonthSavings : null;

  const plannedBudget = profile.expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const budgetOverrunAmount = plannedBudget > 0 ? Math.max(0, monthExpense - plannedBudget) : 0;

  const overrunCategories: CategoryVariance[] = [];
  for (const exp of profile.expenses) {
    const actual = spentByCat.get(exp.category) || 0;
    if (exp.amount > 0 && actual > exp.amount) {
      overrunCategories.push({
        category: exp.category,
        planned: exp.amount,
        actual,
        overAmount: actual - exp.amount,
        pct: Math.round((actual / exp.amount) * 100),
        isUnplanned: false,
      });
    }
  }
  for (const [cat, actual] of spentByCat.entries()) {
    const matched = profile.expenses.find((e) => e.category === cat);
    if ((!matched || matched.amount <= 0) && actual > 0) {
      overrunCategories.push({
        category: cat,
        planned: 0,
        actual,
        overAmount: actual,
        pct: 100,
        isUnplanned: true,
      });
    }
  }

  const match = /^(\d{4})-(\d{2})$/.exec(activeMonthKey);
  const daysInMonth = match
    ? new Date(Number(match[1]), Number(match[2]), 0).getDate()
    : 30;
  const isCurrentMonth = activeMonthKey === currentMonthKey;
  const todayDay = new Date().getDate();
  const elapsedDays = isCurrentMonth ? Math.max(1, todayDay) : daysInMonth;
  const remainingDays = isCurrentMonth ? Math.max(1, daysInMonth - todayDay + 1) : 1;
  const elapsedPct = Math.round((elapsedDays / daysInMonth) * 100);
  const spentPct = plannedBudget > 0 ? Math.round((monthExpense / plannedBudget) * 100) : 0;
  const avgDailySpent = monthExpense > 0 ? Math.round(monthExpense / elapsedDays) : 0;
  const remainingBudget = plannedBudget - monthExpense;
  const safeDailyRemaining =
    remainingBudget > 0 ? Math.round(remainingBudget / remainingDays) : 0;

  let paceStatus: FinancialDiagnostics['paceStatus'] = 'no_data';
  if (plannedBudget > 0 || monthExpense > 0) {
    if (plannedBudget > 0 && monthExpense > plannedBudget) {
      paceStatus = 'over_budget';
    } else if (plannedBudget > 0 && spentPct > elapsedPct + 12) {
      paceStatus = 'fast_pace';
    } else if (monthExpense > 0 || plannedBudget > 0) {
      paceStatus = 'on_track';
    }
  }

  const totalSavedAllTime = transactions
    .filter((t) => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);

  const goalRemaining =
    profile.targetAmount > 0 ? Math.max(0, profile.targetAmount - totalSavedAllTime) : 0;
  const goalCompletionPct =
    profile.targetAmount > 0
      ? Math.min(100, Math.round((totalSavedAllTime / profile.targetAmount) * 100))
      : 0;

  const requiredMonthlySavings =
    profile.targetAmount > 0 && profile.targetMonths > 0
      ? Math.ceil(profile.targetAmount / profile.targetMonths)
      : null;

  let savingsStatus: FinancialDiagnostics['savingsStatus'] = 'no_target';
  let savingsShortfall = 0;

  if (profile.targetAmount > 0) {
    if (totalSavedAllTime >= profile.targetAmount) {
      savingsStatus = 'completed';
    } else if (requiredMonthlySavings !== null) {
      if (monthSavings === 0) {
        savingsStatus = 'no_month_savings';
        savingsShortfall = requiredMonthlySavings;
      } else if (monthSavings < requiredMonthlySavings) {
        savingsStatus = 'behind_target';
        savingsShortfall = requiredMonthlySavings - monthSavings;
      } else {
        savingsStatus = 'on_track';
      }
    } else {
      savingsStatus = monthSavings === 0 ? 'no_month_savings' : 'in_progress';
    }
  }

  let snapshotDelta: SnapshotDelta | null = null;
  if (snapshots.length >= 2) {
    const sorted = [...snapshots].sort((a, b) => b.recordDate.localeCompare(a.recordDate));
    const latest = sorted[0];
    const prev = sorted[1];
    const latestExp = latest.expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const prevExp = prev.expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const latestBal = latest.monthlyIncome - latestExp;
    const prevBal = prev.monthlyIncome - prevExp;
    snapshotDelta = {
      latestDate: latest.recordDate,
      prevDate: prev.recordDate,
      incomeDiff: latest.monthlyIncome - prev.monthlyIncome,
      expenseDiff: latestExp - prevExp,
      balanceDiff: latestBal - prevBal,
    };
  }

  const missingDataNotes: string[] = [];
  if (profile.monthlyIncome <= 0) {
    missingDataNotes.push('Chưa nhập thu nhập hàng tháng trong hồ sơ.');
  }
  if (plannedBudget <= 0) {
    missingDataNotes.push('Chưa khai báo hạn mức các khoản chi cơ bản trong hồ sơ.');
  }
  if (monthTx.length === 0) {
    missingDataNotes.push(`Chưa ghi nhận giao dịch thu chi thực tế nào trong tháng ${activeMonthKey}.`);
  }
  if (profile.targetAmount <= 0) {
    missingDataNotes.push('Chưa đặt số tiền mục tiêu tiết kiệm trong hồ sơ.');
  }

  const reminders: DiagnosticReminder[] = [];

  if (plannedBudget > 0 && monthExpense > plannedBudget) {
    reminders.push({
      id: 'budget-overrun',
      severity: 'danger',
      title: `Chi tiêu thực tế đã vượt ngân sách ${formatVndSimple(budgetOverrunAmount)}`,
      detail: `Bạn đã chi ${formatVndSimple(monthExpense)} so với hạn mức hồ sơ ${formatVndSimple(plannedBudget)} (${spentPct}%).`,
      suggestion:
        overrunCategories.length > 0
          ? `Ưu tiên rà soát các mục vượt hoặc ngoài hạn mức: ${overrunCategories
              .slice(0, 3)
              .map((c) => `${c.category} (${formatVndSimple(c.actual)})`)
              .join(', ')}.`
          : 'Tạm dừng các khoản chi linh hoạt trong những ngày còn lại của tháng.',
    });
  } else if (plannedBudget > 0 && spentPct > elapsedPct + 12 && monthExpense > 0) {
    reminders.push({
      id: 'fast-pace',
      severity: 'warning',
      title: `Nhịp chi tiêu đang nhanh hơn tiến độ tháng (${spentPct}% ngân sách / ${elapsedPct}% số ngày)`,
      detail: `Trung bình mỗi ngày bạn đang chi ${formatVndSimple(avgDailySpent)}. Phần ngân sách còn lại là ${formatVndSimple(Math.max(0, remainingBudget))}.`,
      suggestion: `Giữ mức chi tối đa khoảng ${formatVndSimple(safeDailyRemaining)}/ngày trong ${remainingDays} ngày còn lại để không bị hụt cuối tháng.`,
    });
  }

  if (unplannedExpense > 0) {
    reminders.push({
      id: 'unplanned-expenses',
      severity: 'warning',
      title: `Có ${unplannedCount} khoản phát sinh ngoài hạn mức (${formatVndSimple(unplannedExpense)})`,
      detail: `Các khoản chưa có trong danh mục dự kiến của hồ sơ đang chiếm ${monthExpense > 0 ? Math.round((unplannedExpense / monthExpense) * 100) : 100}% tổng chi tháng.`,
      suggestion:
        'Nếu khoản này lặp lại hàng tháng, hãy thêm vào hồ sơ tài chính và nhờ chuyên gia phân tích lại để ngân sách sát thực tế hơn.',
    });
  }

  if (savingsStatus === 'behind_target' && requiredMonthlySavings !== null) {
    reminders.push({
      id: 'savings-behind',
      severity: 'warning',
      title: `Tiến độ tiết kiệm tháng này chưa đạt mốc mục tiêu (thiếu ${formatVndSimple(savingsShortfall)})`,
      detail: `Bạn đã bỏ quỹ ${formatVndSimple(monthSavings)} trong tháng so với mức cần đạt ${formatVndSimple(requiredMonthlySavings)}/tháng.`,
      suggestion:
        remainingBudget > 0
          ? `Có thể trích thêm từ phần chi dự phòng còn dư hoặc cắt bớt khoản linh hoạt để bù ${formatVndSimple(savingsShortfall)}.`
          : 'Hãy cập nhật lại số liệu với chuyên gia để kéo giãn kỳ hạn mục tiêu hoặc tối ưu lại chi tiêu.',
    });
  } else if (savingsStatus === 'no_month_savings' && profile.targetAmount > 0) {
    reminders.push({
      id: 'savings-none-month',
      severity: 'warning',
      title: 'Tháng này chưa ghi nhận khoản bỏ quỹ tiết kiệm nào',
      detail:
        requiredMonthlySavings !== null
          ? `Để kịp mục tiêu ${formatVndSimple(profile.targetAmount)} trong ${profile.targetMonths} tháng, bạn cần để dành khoảng ${formatVndSimple(requiredMonthlySavings)}/tháng.`
          : `Mục tiêu hiện tại là ${formatVndSimple(profile.targetAmount)} (đã tích lũy ${formatVndSimple(totalSavedAllTime)}).`,
      suggestion: 'Hãy trích ngay một khoản nhỏ ngay khi có thu nhập hoặc thu bổ sung thay vì đợi cuối tháng.',
    });
  } else if (savingsStatus === 'on_track' || savingsStatus === 'completed') {
    reminders.push({
      id: 'savings-good',
      severity: 'positive',
      title:
        savingsStatus === 'completed'
          ? 'Đã hoàn thành mục tiêu tiết kiệm đã đặt'
          : 'Tiến độ bỏ quỹ tiết kiệm đang bám sát mục tiêu',
      detail: `Đã bỏ quỹ ${formatVndSimple(monthSavings)} trong tháng này (tổng tích lũy ${formatVndSimple(totalSavedAllTime)}).`,
      suggestion: 'Tiếp tục duy trì nhịp tích lũy hiện tại và kiểm tra lại quỹ dự phòng nếu thu nhập thay đổi.',
    });
  }

  if (expenseChangeVsPrev !== null && prevMonthExpense > 0) {
    const pctDelta = Math.round((expenseChangeVsPrev / prevMonthExpense) * 100);
    if (expenseChangeVsPrev > 0) {
      reminders.push({
        id: 'mom-expense-up',
        severity: pctDelta >= 15 ? 'warning' : 'info',
        title: `Chi tiêu tháng này đang cao hơn tháng trước ${formatVndSimple(expenseChangeVsPrev)} (+${pctDelta}%)`,
        detail: `Tháng trước ghi nhận chi ${formatVndSimple(prevMonthExpense)}; tháng này đã ghi ${formatVndSimple(monthExpense)}.`,
        suggestion: 'Kiểm tra lại danh sách giao dịch gần đây để xác định khoản nào tăng đột biến.',
      });
    } else if (expenseChangeVsPrev < 0) {
      reminders.push({
        id: 'mom-expense-down',
        severity: 'positive',
        title: `Chi tiêu đang giảm ${formatVndSimple(Math.abs(expenseChangeVsPrev))} so với tháng trước`,
        detail: `Tháng trước chi ${formatVndSimple(prevMonthExpense)}, tháng này ghi nhận ${formatVndSimple(monthExpense)}.`,
        suggestion: 'Phần tiền chênh lệch tiết kiệm được nên chuyển thẳng vào quỹ tiết kiệm để tránh chi tiêu lại.',
      });
    }
  }

  if (reminders.length === 0 && missingDataNotes.length > 0) {
    reminders.push({
      id: 'missing-data-notice',
      severity: 'info',
      title: 'Cần bổ sung thêm dữ liệu thực tế để theo dõi sát sao hơn',
      detail: missingDataNotes.join(' '),
      suggestion: 'Điền hồ sơ tài chính và ghi chép thu chi hàng ngày để FINSMART đối chiếu chính xác, không suy đoán.',
    });
  }

  return {
    activeMonthKey,
    prevMonthKey,
    monthTxCount: monthTx.length,
    prevMonthTxCount: prevTx.length,
    monthIncome,
    monthExpense,
    monthSavings,
    unplannedExpense,
    unplannedCount,
    prevMonthIncome,
    prevMonthExpense,
    prevMonthSavings,
    expenseChangeVsPrev,
    savingsChangeVsPrev,
    plannedBudget,
    budgetOverrunAmount,
    spentPct,
    elapsedDays,
    daysInMonth,
    remainingDays,
    elapsedPct,
    avgDailySpent,
    remainingBudget,
    safeDailyRemaining,
    paceStatus,
    overrunCategories,
    totalSavedAllTime,
    goalCompletionPct,
    goalRemaining,
    requiredMonthlySavings,
    savingsShortfall,
    savingsStatus,
    snapshotDelta,
    missingDataNotes,
    reminders,
  };
}

export function buildFactBasedReanalysisPrompt(
  profile: FinancialProfile,
  diagnostics: FinancialDiagnostics
): string {
  const lines: string[] = [
    `Hãy phân tích lại sát sao tình hình tài chính thực tế của tôi trong kỳ ${diagnostics.activeMonthKey} dựa trên đúng dữ liệu đã lưu:`,
    `- Thu nhập khai báo hồ sơ: ${formatVndSimple(profile.monthlyIncome)}${diagnostics.monthIncome > 0 ? ` + thu bổ sung thực tế ${formatVndSimple(diagnostics.monthIncome)}` : ''}`,
    `- Tổng hạn mức chi tiêu theo hồ sơ: ${formatVndSimple(diagnostics.plannedBudget)} | Đã chi thực tế trong sổ: ${formatVndSimple(diagnostics.monthExpense)} (${diagnostics.spentPct}% hạn mức)`,
  ];

  if (diagnostics.unplannedExpense > 0) {
    lines.push(
      `- Khoản phát sinh ngoài hạn mức: ${diagnostics.unplannedCount} khoản với tổng ${formatVndSimple(diagnostics.unplannedExpense)}`
    );
  }
  if (diagnostics.overrunCategories.length > 0) {
    lines.push(
      `- Các hạng mục vượt hoặc ngoài hạn mức: ${diagnostics.overrunCategories
        .map((c) => `${c.category} (${formatVndSimple(c.actual)} / hạn mức ${formatVndSimple(c.planned)})`)
        .join('; ')}`
    );
  }
  if (diagnostics.expenseChangeVsPrev !== null) {
    lines.push(
      `- So với tháng trước (${diagnostics.prevMonthKey}): chi tiêu ${diagnostics.expenseChangeVsPrev >= 0 ? 'tăng' : 'giảm'} ${formatVndSimple(Math.abs(diagnostics.expenseChangeVsPrev))}`
    );
  }
  lines.push(
    `- Tiết kiệm tháng này: ${formatVndSimple(diagnostics.monthSavings)} | Tổng đã tích lũy: ${formatVndSimple(diagnostics.totalSavedAllTime)}${profile.targetAmount > 0 ? ` / mục tiêu ${formatVndSimple(profile.targetAmount)}` : ''}`
  );
  if (diagnostics.savingsStatus === 'behind_target' && diagnostics.requiredMonthlySavings !== null) {
    lines.push(
      `- Tiến độ tiết kiệm tháng này đang thiếu ${formatVndSimple(diagnostics.savingsShortfall)} so với mốc ${formatVndSimple(diagnostics.requiredMonthlySavings)}/tháng.`
    );
  }
  lines.push(
    'Dựa đúng trên các con số thực tế này (không suy đoán thêm), hãy nhận xét tình hình và đề xuất phương án điều chỉnh cụ thể cho những ngày còn lại của tháng.'
  );
  return lines.join('\n');
}
