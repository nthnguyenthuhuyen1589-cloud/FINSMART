import type { FinancialPlan, FinancialProfile } from '../types.ts';

export function formatVnd(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('vi-VN').format(safe) + ' đ';
}

export function formatDateVi(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} · ${hh}:${min}`;
  } catch {
    return iso;
  }
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatRecordDateVi(dateStr?: string): string {
  if (!dateStr) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return formatDateVi(dateStr);
}

export function getYearKey(dateOrIso?: string): string {
  if (!dateOrIso) return '';
  const match = /^(\d{4})/.exec(dateOrIso.trim());
  if (match) return match[1];
  const d = new Date(dateOrIso);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getFullYear());
}

export function getMonthYearKey(dateOrIso?: string): string {
  if (!dateOrIso) return '';
  const match = /^(\d{4})-(\d{2})/.exec(dateOrIso.trim());
  if (match) return `${match[1]}-${match[2]}`;
  const d = new Date(dateOrIso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthYearVi(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  return `Tháng ${match[2]}/${match[1]}`;
}

function generateDeviceSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `fs-${crypto.randomUUID()}`;
  }
  return `fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let inMemoryFallbackSessionId: string | null = null;

export function getOrCreateSessionId(): string {
  const key = 'finsmart_session_id';
  try {
    let existing = window.localStorage.getItem(key);
    if (!existing || existing === 'default-workspace') {
      existing = generateDeviceSessionId();
      window.localStorage.setItem(key, existing);
    }
    return existing;
  } catch {
    if (!inMemoryFallbackSessionId) {
      inMemoryFallbackSessionId = generateDeviceSessionId();
    }
    return inMemoryFallbackSessionId;
  }
}

export function buildReportMarkdown(plan: FinancialPlan, profile?: FinancialProfile): string {
  const lines: string[] = [];
  lines.push(`# BÁO CÁO KẾ HOẠCH TÀI CHÍNH CÁ NHÂN – FINSMART`);
  lines.push(`**Tên kế hoạch:** ${plan.title}`);
  if (plan.planDate) {
    lines.push(`**Kỳ / Ngày ghi nhận:** ${formatRecordDateVi(plan.planDate)}`);
  }
  lines.push(`**Ngày lập báo cáo:** ${formatDateVi(plan.createdAt)}`);
  if (profile) {
    lines.push(
      `**Hồ sơ:** ${profile.fullName || 'Cá nhân'} · Nhóm: ${profile.roleType}`
    );
  }
  lines.push('');
  lines.push(`## 1. Tóm tắt đánh giá`);
  lines.push(plan.summary);
  lines.push('');
  lines.push(`## 2. Chỉ số tài chính tháng`);
  lines.push(`- **Thu nhập hàng tháng:** ${formatVnd(plan.monthlyIncome)}`);
  lines.push(`- **Tổng chi tiêu dự kiến:** ${formatVnd(plan.totalExpenses)}`);
  lines.push(`- **Tiết kiệm khuyến nghị/tháng:** ${formatVnd(plan.recommendedMonthlySavings)}`);
  lines.push(`- **Mục tiêu quỹ dự phòng cá nhân:** ${formatVnd(plan.emergencyFundTarget)}`);
  lines.push('');
  lines.push(`## 3. Phân bổ ngân sách chi tiết`);
  lines.push(`| Hạng mục | Nhóm | Số tiền / tháng | Tỷ lệ | Lý do phân bổ |`);
  lines.push(`| :--- | :--- | ---: | ---: | :--- |`);
  for (const item of plan.allocations) {
    lines.push(
      `| ${item.category} | ${item.group} | ${formatVnd(item.amount)} | ${item.percentage}% | ${item.rationale.replace(/\|/g, '/')} |`
    );
  }
  lines.push('');
  lines.push(`## 4. Lộ trình thực hiện theo tuần & tháng`);
  for (const step of plan.actionSteps) {
    lines.push(`- **${step.timeframe} – ${step.title}:** ${step.detail}`);
  }
  lines.push('');
  if (plan.risksAndNotes.length > 0) {
    lines.push(`## 5. Lưu ý quan trọng`);
    for (const note of plan.risksAndNotes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }
  if (plan.adjustmentGuidance) {
    lines.push(`## 6. Phương án điều chỉnh khi tình hình thay đổi`);
    lines.push(plan.adjustmentGuidance);
    lines.push('');
  }
  lines.push(`---`);
  lines.push(
    `*LƯU Ý: FINSMART chỉ cung cấp thông tin tham khảo và hỗ trợ quản lý tài chính cá nhân cơ bản. Nội dung tư vấn không phải tư vấn đầu tư, không phải khuyến nghị mua bán chứng khoán, tiền mã hóa hoặc các sản phẩm tài chính. Người dùng cần tự đánh giá trước khi đưa ra quyết định.*`
  );
  return lines.join('\n');
}
