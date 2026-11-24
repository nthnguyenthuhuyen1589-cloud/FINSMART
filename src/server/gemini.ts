import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AdvisoryMode,
  ChatMessage,
  FinancialPlan,
  FinancialProfile,
  PlanActionStep,
  PlanAllocation,
  ProfileSnapshot,
  TransactionItem,
} from '../types.ts';
import { computeFinancialDiagnostics } from '../utils/financialDiagnostics.ts';

function getAiClient(): GoogleGenAI {
  const rawKey = (process.env.GEMINI_API_KEY ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^GEMINI_API_KEY=/i, '')
    .trim();
  if (
    !rawKey ||
    rawKey === 'MY_GEMINI_API_KEY' ||
    rawKey === 'YOUR_API_KEY' ||
    rawKey === 'API_KEY_HERE'
  ) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey: rawKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const SYSTEM_INSTRUCTION = `Bạn là **FINSMART – Chuyên gia tư vấn tài chính cá nhân** thân thiện, thực tế và đáng tin cậy tại Việt Nam, chuyên đồng hành cùng sinh viên, người mới đi làm và người muốn cải thiện khả năng quản lý tiền bạc cơ bản.

NHIỆM VỤ CHÍNH:
1. Tư vấn quản lý thu nhập: Phân tích mức thu nhập hiện tại, đề xuất cách phân bổ hợp lý (linh hoạt theo thu nhập thấp, trung bình hoặc không ổn định, không rập khuôn máy móc), cân đối thu – chi.
2. Tư vấn quản lý chi tiêu: Phân tích thói quen chi tiêu, chỉ ra khoản chi chưa hợp lý hoặc có thể tối ưu, gợi ý cắt giảm cụ thể, hướng dẫn lập ngân sách tháng.
3. Tư vấn tiết kiệm: Đề xuất mức tiết kiệm khả thi theo hoàn cảnh thực tế, lộ trình đạt mục tiêu, cách xây dựng quỹ dự phòng cá nhân (thường 3-6 tháng chi tiêu thiết yếu, bắt đầu từng bước nhỏ).
4. Tư vấn xử lý tình huống tài chính: Phân bổ thu nhập 4-5 triệu đồng/tháng, tiết kiệm khi là sinh viên, xử lý bội chi (chi vượt thu), kiểm soát chi phí phát sinh đột xuất, cân nhắc có nên vay tiêu dùng cá nhân hay không (phân tích rủi ro lãi suất và áp lực trả nợ), lập kế hoạch 6 tháng.
5. Lập kế hoạch tài chính cá nhân: Đánh giá tình hình hiện tại, xác định vấn đề trọng tâm, đề xuất mục tiêu, phân chia ngân sách cụ thể bằng VNĐ & %, lộ trình thực hiện theo tuần/tháng, và phương án điều chỉnh khi thu nhập/chi tiêu thay đổi.

NGUYÊN TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ):
1. Sử dụng 100% tiếng Việt tự nhiên, mạch lạc, dễ hiểu, giàu tính thực tế và đồng cảm như một chuyên gia tư vấn thực thụ.
2. KHÔNG tự bịa dữ liệu hoặc giả định hoàn cảnh người dùng. Chỉ tính toán và nhận xét dựa trên đúng số liệu người dùng đã cung cấp trong hồ sơ, các mốc thời gian đã lưu hoặc sổ thu chi thực tế. Nếu phần dữ liệu nào chưa có (ví dụ tháng trước chưa ghi giao dịch hoặc chưa đặt hạn mức), hãy nói rõ là chưa có dữ liệu đó, tuyệt đối không suy đoán.
3. THEO DÕI SÁT SAO & NHẮC NHỞ THỰC TẾ: Nếu dữ liệu thực tế cho thấy chi tiêu vượt ngân sách, nhịp chi nhanh hơn tiến độ tháng, xuất hiện nhiều khoản phát sinh ngoài hạn mức, biến động tăng mạnh so với tháng trước/mốc hồ sơ trước, hoặc tiến độ tiết kiệm chưa đạt mục tiêu, hãy chỉ thẳng con số chênh lệch và đưa ra gợi ý điều chỉnh cụ thể, khả thi ngay trong tháng.
4. KHI THIẾU THÔNG TIN: Nếu người dùng hỏi một bài toán cá nhân hóa nhưng chưa cung cấp mức thu nhập, khoản chi chính hoặc hoàn cảnh cụ thể (cả trong hồ sơ lẫn tin nhắn), hãy đặt \`needsMoreInfo: true\`, \`hasPlan: false\`, giải thích ngắn gọn phần nào còn thiếu và hỏi lại 2–4 câu hỏi cụ thể để người dùng bổ sung. Tuy nhiên, nếu người dùng đã nêu rõ số liệu trong tin nhắn (ví dụ "Tôi là sinh viên, có 4 triệu/tháng...") hoặc trong hồ sơ đã có số liệu, hãy phân tích ngay lập tức một cách chi tiết, thực tế!
5. CHÍNH XÁC SỐ HỌC: Khi lập bảng phân bổ ngân sách (\`allocations\`), tổng số tiền các hạng mục phải khớp với thu nhập hàng tháng (hoặc mức ngân sách đang phân tích), tổng tỷ lệ phần trăm xấp xỉ 100%, giải thích rõ lý do từng khoản.
5. GIỚI HẠN TUÂN THỦ AN TOÀN (TUYỆT ĐỐI):
   - KHÔNG phải tư vấn đầu tư.
   - TUYỆT ĐỐI KHÔNG cam kết hay hứa hẹn mức lợi nhuận.
   - TUYỆT ĐỐI KHÔNG khuyến nghị mua bán chứng khoán, cổ phiếu, trái phiếu doanh nghiệp, tiền mã hóa (crypto), forex hoặc bất kỳ sản phẩm đầu tư tài chính cụ thể nào.
   - Nếu người dùng hỏi về đầu tư cổ phiếu/coin/làm giàu nhanh, hãy từ chối lịch sự, giải thích rằng FINSMART chỉ hỗ trợ quản lý tài chính cá nhân cơ bản (thu chi, tiết kiệm, quỹ dự phòng) và khuyên họ tập trung vào nền tảng tài chính an toàn trước.

ĐỊNH DẠNG ĐẦU RA JSON:
- \`needsMoreInfo\`: true nếu thiếu dữ liệu cốt lõi và đang hỏi lại người dùng; false nếu đã đủ dữ liệu để tư vấn.
- \`replyMarkdown\`: Nội dung tư vấn chi tiết bằng tiếng Việt (Markdown rõ ràng: tiêu đề ngắn, gạch đầu dòng, con số in đậm, giải thích lý do thực tế).
- \`hasPlan\`: true khi bạn vừa tạo hoặc cập nhật một kế hoạch tài chính / bảng phân bổ ngân sách cụ thể với số liệu rõ ràng; false nếu chỉ đang hỏi thêm thông tin hoặc giải đáp lý thuyết ngắn không có bảng phân bổ mới.
- \`plan\`: Bắt buộc điền đầy đủ khi \`hasPlan\` là true.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    needsMoreInfo: {
      type: Type.BOOLEAN,
      description: 'True nếu thiếu dữ liệu cốt lõi và cần hỏi bổ sung người dùng.',
    },
    replyMarkdown: {
      type: Type.STRING,
      description: 'Câu trả lời tư vấn chi tiết bằng tiếng Việt định dạng Markdown.',
    },
    hasPlan: {
      type: Type.BOOLEAN,
      description: 'True nếu câu trả lời có kèm theo kế hoạch tài chính / bảng phân bổ ngân sách cụ thể.',
    },
    plan: {
      type: Type.OBJECT,
      description: 'Chi tiết kế hoạch tài chính nếu hasPlan là true.',
      properties: {
        title: { type: Type.STRING, description: 'Tên ngắn gọn của kế hoạch tài chính.' },
        summary: { type: Type.STRING, description: 'Tóm tắt đánh giá hiện trạng và mục tiêu chính.' },
        monthlyIncome: { type: Type.NUMBER, description: 'Thu nhập hàng tháng dùng để lập kế hoạch (VNĐ).' },
        totalExpenses: { type: Type.NUMBER, description: 'Tổng chi tiêu dự kiến hàng tháng sau tối ưu (VNĐ).' },
        recommendedMonthlySavings: { type: Type.NUMBER, description: 'Số tiền khuyến nghị tiết kiệm mỗi tháng (VNĐ).' },
        emergencyFundTarget: { type: Type.NUMBER, description: 'Mục tiêu quỹ dự phòng cá nhân khuyến nghị (VNĐ).' },
        allocations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              group: {
                type: Type.STRING,
                enum: ['Thiết yếu', 'Cá nhân & Linh hoạt', 'Tiết kiệm & Dự phòng'],
              },
              amount: { type: Type.NUMBER },
              percentage: { type: Type.NUMBER },
              rationale: { type: Type.STRING },
            },
            required: ['category', 'group', 'amount', 'percentage', 'rationale'],
          },
        },
        actionSteps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timeframe: { type: Type.STRING, description: 'Ví dụ: Tuần 1, Tháng 1, Tháng 2-3, Tháng 4-6' },
              title: { type: Type.STRING },
              detail: { type: Type.STRING },
            },
            required: ['timeframe', 'title', 'detail'],
          },
        },
        risksAndNotes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        adjustmentGuidance: {
          type: Type.STRING,
          description: 'Phương án điều chỉnh khi thu nhập hoặc chi tiêu phát sinh thay đổi.',
        },
      },
      required: [
        'title',
        'summary',
        'monthlyIncome',
        'totalExpenses',
        'recommendedMonthlySavings',
        'emergencyFundTarget',
        'allocations',
        'actionSteps',
        'risksAndNotes',
        'adjustmentGuidance',
      ],
    },
  },
  required: ['needsMoreInfo', 'replyMarkdown', 'hasPlan'],
};

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
}

function summarizeTrackingContext(
  profile: FinancialProfile,
  snapshots: ProfileSnapshot[] = [],
  transactions: TransactionItem[] = []
): string {
  const diag = computeFinancialDiagnostics(profile, snapshots, transactions);
  const lines: string[] = [];

  if (transactions.length > 0) {
    lines.push(
      `DỮ LIỆU THEO DÕI THU CHI THỰC TẾ TRONG SỔ GHI CHÉP (${diag.activeMonthKey}, ngày ${diag.elapsedDays}/${diag.daysInMonth}):`
    );
    lines.push(
      `- Số giao dịch tháng này: ${diag.monthTxCount} (tổng ${transactions.length} giao dịch đã lưu)`
    );
    lines.push(
      `- Thực tế tháng này: Thu bổ sung ${formatVnd(diag.monthIncome)}, Đã chi ${formatVnd(diag.monthExpense)} (${diag.plannedBudget > 0 ? `${diag.spentPct}% hạn mức` : 'chưa đặt hạn mức'}), Bỏ quỹ tiết kiệm ${formatVnd(diag.monthSavings)}`
    );
    if (diag.unplannedExpense > 0) {
      lines.push(
        `- Các khoản phát sinh ngoài hạn mức khai báo: ${diag.unplannedCount} khoản, tổng ${formatVnd(diag.unplannedExpense)}`
      );
    }
    if (diag.plannedBudget > 0) {
      lines.push(
        diag.budgetOverrunAmount > 0
          ? `- CẢNH BÁO VƯỢT NGÂN SÁCH: Đã vượt hạn mức ${formatVnd(diag.budgetOverrunAmount)}`
          : `- Hạn mức còn lại trong tháng: ${formatVnd(diag.remainingBudget)} (chi tối đa an toàn ${formatVnd(diag.safeDailyRemaining)}/ngày cho ${diag.remainingDays} ngày còn lại)`
      );
    }
    if (diag.overrunCategories.length > 0) {
      lines.push(
        `- Hạng mục vượt hoặc ngoài hạn mức:\n${diag.overrunCategories
          .map(
            (c) =>
              `  + ${c.category}: đã chi ${formatVnd(c.actual)}${c.planned > 0 ? ` / hạn mức ${formatVnd(c.planned)} (vượt ${formatVnd(c.overAmount)})` : ' (ngoài hạn mức khai báo)'}`
          )
          .join('\n')}`
      );
    }
    if (diag.prevMonthTxCount > 0) {
      lines.push(
        `- So sánh với tháng trước (${diag.prevMonthKey}): Chi tiêu tháng trước ${formatVnd(diag.prevMonthExpense)}, Tiết kiệm tháng trước ${formatVnd(diag.prevMonthSavings)}${diag.expenseChangeVsPrev !== null ? ` (chi tiêu thay đổi ${diag.expenseChangeVsPrev >= 0 ? '+' : ''}${formatVnd(diag.expenseChangeVsPrev)})` : ''}`
      );
    } else {
      lines.push(`- So sánh tháng trước (${diag.prevMonthKey}): Chưa có giao dịch tháng trước để đối chiếu.`);
    }
    lines.push(
      `- Tổng quỹ tiết kiệm tích lũy: ${formatVnd(diag.totalSavedAllTime)}${profile.targetAmount > 0 ? ` / mục tiêu ${formatVnd(profile.targetAmount)} (${diag.goalCompletionPct}%)` : ''}`
    );
    if (diag.savingsStatus === 'behind_target' && diag.requiredMonthlySavings !== null) {
      lines.push(
        `- CẢNH BÁO TIẾT KIỆM CHẬM TIẾN ĐỘ: Tháng này mới bỏ quỹ ${formatVnd(diag.monthSavings)} / yêu cầu ${formatVnd(diag.requiredMonthlySavings)}/tháng (thiếu ${formatVnd(diag.savingsShortfall)}).`
      );
    }
  } else {
    lines.push('DỮ LIỆU THEO DÕI THU CHI THỰC TẾ: Người dùng chưa ghi nhận giao dịch thu chi hoặc tiết kiệm nào trong sổ.');
  }

  if (diag.snapshotDelta) {
    lines.push(
      `BIẾN ĐỘNG GIỮA CÁC MỐC HỒ SƠ (${diag.snapshotDelta.prevDate} -> ${diag.snapshotDelta.latestDate}): Thu nhập ${diag.snapshotDelta.incomeDiff >= 0 ? '+' : ''}${formatVnd(diag.snapshotDelta.incomeDiff)}, Chi khai báo ${diag.snapshotDelta.expenseDiff >= 0 ? '+' : ''}${formatVnd(diag.snapshotDelta.expenseDiff)}, Chênh lệch dư ${diag.snapshotDelta.balanceDiff >= 0 ? '+' : ''}${formatVnd(diag.snapshotDelta.balanceDiff)}.`
    );
  }

  if (diag.missingDataNotes.length > 0) {
    lines.push(`DỮ LIỆU CÒN THIẾU (KHÔNG ĐƯỢC TỰ SUY ĐOÁN): ${diag.missingDataNotes.join(' ')}`);
  }

  return `\n\n${lines.join('\n')}`;
}

export function formatProfileContext(
  profile: FinancialProfile,
  transactions: TransactionItem[] = [],
  snapshots: ProfileSnapshot[] = []
): string {
  const totalExpenses = profile.expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  const expenseLines =
    profile.expenses.length > 0
      ? profile.expenses
          .map(
            (e) =>
              `- ${e.category}: ${formatVnd(e.amount)} (${e.isEssential ? 'Thiết yếu' : 'Linh hoạt'})`
          )
          .join('\n')
      : '- Chưa nhập khoản chi tiêu cụ thể';

  const hasAnyNumbers = profile.monthlyIncome > 0 || totalExpenses > 0 || profile.targetAmount > 0;
  const trackingSummary = summarizeTrackingContext(profile, snapshots, transactions);

  return `HỒ SƠ TÀI CHÍNH HIỆN TẠI CỦA NGƯỜI DÙNG (CHỈ DÙNG DỮ LIỆU THỰC TẾ DƯỚI ĐÂY, KHÔNG SUY DIỄN THÊM):
- Ngày / kỳ ghi nhận: ${profile.recordDate || 'Hôm nay'}
- Tên / Xưng hô: ${profile.fullName || 'Chưa cung cấp'}
- Nhóm đối tượng: ${profile.roleType}
- Thu nhập / tiền sinh hoạt hàng tháng: ${profile.monthlyIncome > 0 ? formatVnd(profile.monthlyIncome) : 'Chưa cung cấp (0 đ)'}
- Các khoản chi tiêu cơ bản khai báo (${formatVnd(totalExpenses)}/tháng):
${expenseLines}
- Chênh lệch thu - chi hiện tại (nếu có thu nhập): ${profile.monthlyIncome > 0 ? formatVnd(profile.monthlyIncome - totalExpenses) : 'Chưa xác định'}
- Mục tiêu tài chính: ${profile.financialGoal || 'Chưa cung cấp'}
- Số tiền mục tiêu: ${profile.targetAmount > 0 ? formatVnd(profile.targetAmount) : 'Chưa xác định'} (${profile.targetMonths > 0 ? `trong ${profile.targetMonths} tháng` : 'thời hạn linh hoạt'})
- Vấn đề đang gặp phải: ${profile.currentProblem || 'Chưa mô tả'}
- Trạng thái dữ liệu hồ sơ: ${hasAnyNumbers ? 'Đã có một phần/đầy đủ số liệu' : 'Hồ sơ hiện chưa có số liệu thu chi'}${trackingSummary}`;
}

export interface AiConsultationResult {
  needsMoreInfo: boolean;
  replyMarkdown: string;
  hasPlan: boolean;
  plan?: Omit<FinancialPlan, 'id' | 'sessionId' | 'conversationId' | 'createdAt'>;
  conversationTitle?: string;
}

let hydrogenCooldownUntil = 0;

function isAuthOrKeyError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')
  );
}

function isQuotaOrRateError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
}

function isTransientServerError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('500');
}

const ADVISORY_MODE_GUIDANCE: Record<AdvisoryMode, string> = {
  general:
    'Tư vấn tổng quát cân đối thu – chi – tiết kiệm dựa trên đúng số liệu thực tế, trình bày súc tích, rõ ràng, thực tế.',
  cut_expenses:
    'CHUYÊN ĐỀ CẮT GIẢM CHI TIÊU: Soi kỹ từng khoản chi linh hoạt và chi thực tế trong sổ ghi chép, chỉ ra 2–3 khoản có thể cắt giảm ngay 15–30% kèm số tiền tiết kiệm được mỗi tháng.',
  emergency_fund:
    'CHUYÊN ĐỀ QUỸ DỰ PHÒNG: Tính chính xác mức quỹ dự phòng 3 tháng và 6 tháng chi tiêu thiết yếu, chia cột mốc nhỏ (mốc 1 triệu, mốc 1 tháng, mốc 3 tháng) và mức trích theo tuần/tháng.',
  savings_goal:
    'CHUYÊN ĐỀ MỤC TIÊU TIẾT KIỆM: Tính toán tốc độ tích lũy mỗi ngày/tuần/tháng để đạt mục tiêu, đề xuất phương án rút ngắn thời gian hoặc điều chỉnh kỳ hạn khả thi.',
  loan_check:
    'CHUYÊN ĐỀ ĐÁNH GIÁ VAY / TRẢ GÓP: Phân tích kỹ áp lực trả góp hàng tháng so với phần thu nhập dư sau chi thiết yếu (ngưỡng an toàn <= 20–25%), chỉ rõ tổng chi phí lãi và gợi ý tích lũy trước nếu rủi ro cao.',
  debt_recovery:
    'CHUYÊN ĐỀ GỠ RỐI BỘI CHI: Xử lý khẩn cấp tình trạng chi vượt thu, lập danh sách cắt giảm tạm thời trong 30–60 ngày tới, xử lý khoản phát sinh và đưa dòng tiền về trạng thái dương.',
};

async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    systemInstruction: string;
  }
) {
  const candidates: Array<{ model: string; thinkingLevel?: ThinkingLevel }> =
    Date.now() < hydrogenCooldownUntil
      ? [{ model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL }]
      : [
          { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
          { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
        ];

  let lastError: unknown;

  for (const candidate of candidates) {
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        return await ai.models.generateContent({
          model: candidate.model,
          contents: params.contents as Parameters<typeof ai.models.generateContent>[0]['contents'],
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            ...(candidate.thinkingLevel
              ? { thinkingConfig: { thinkingLevel: candidate.thinkingLevel } }
              : {}),
          },
        });
      } catch (error) {
        lastError = error;
        if (isAuthOrKeyError(error)) {
          throw error;
        }
        if (candidate.model === 'gemini-4-hydrogen' && isQuotaOrRateError(error)) {
          hydrogenCooldownUntil = Date.now() + 5 * 60 * 1000;
          break;
        }
        if ((isTransientServerError(error) || isQuotaOrRateError(error)) && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }
        break;
      }
    }
  }

  throw lastError;
}

function parseJsonResponse(rawText: string | undefined): {
  needsMoreInfo?: boolean;
  replyMarkdown?: string;
  hasPlan?: boolean;
  plan?: Record<string, unknown>;
} {
  const cleaned = (rawText ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) return {};

  try {
    return JSON.parse(cleaned);
  } catch {
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
      } catch {
        // Fallback safely to markdown text if model output wasn't valid JSON
      }
    }
    return {
      needsMoreInfo: false,
      replyMarkdown: cleaned,
      hasPlan: false,
    };
  }
}

function normalizePlan(
  rawPlan: Record<string, unknown> | undefined
): AiConsultationResult['plan'] | undefined {
  if (!rawPlan) return undefined;
  const allocationsRaw = Array.isArray(rawPlan.allocations) ? rawPlan.allocations : [];
  const allocations: PlanAllocation[] = allocationsRaw.map((item) => {
    const row = item as Record<string, unknown>;
    const rawGroup = String(row.group || 'Thiết yếu');
    const group: PlanAllocation['group'] =
      rawGroup === 'Tiết kiệm & Dự phòng'
        ? 'Tiết kiệm & Dự phòng'
        : rawGroup === 'Cá nhân & Linh hoạt'
          ? 'Cá nhân & Linh hoạt'
          : 'Thiết yếu';
    return {
      category: String(row.category || 'Khoản mục'),
      group,
      amount: Math.max(0, Math.round(Number(row.amount) || 0)),
      percentage: Math.max(0, Math.round((Number(row.percentage) || 0) * 10) / 10),
      rationale: String(row.rationale || ''),
    };
  });

  const stepsRaw = Array.isArray(rawPlan.actionSteps) ? rawPlan.actionSteps : [];
  const actionSteps: PlanActionStep[] = stepsRaw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      timeframe: String(row.timeframe || 'Trong tháng'),
      title: String(row.title || 'Hành động'),
      detail: String(row.detail || ''),
    };
  });

  const risksRaw = Array.isArray(rawPlan.risksAndNotes) ? rawPlan.risksAndNotes : [];

  return {
    title: String(rawPlan.title || 'Kế hoạch tài chính cá nhân'),
    summary: String(rawPlan.summary || ''),
    monthlyIncome: Math.max(0, Math.round(Number(rawPlan.monthlyIncome) || 0)),
    totalExpenses: Math.max(0, Math.round(Number(rawPlan.totalExpenses) || 0)),
    recommendedMonthlySavings: Math.max(0, Math.round(Number(rawPlan.recommendedMonthlySavings) || 0)),
    emergencyFundTarget: Math.max(0, Math.round(Number(rawPlan.emergencyFundTarget) || 0)),
    allocations,
    actionSteps,
    risksAndNotes: risksRaw.map((r) => String(r)),
    adjustmentGuidance: String(rawPlan.adjustmentGuidance || ''),
  };
}

export async function generateInitialConsultation(params: {
  profile: FinancialProfile;
  transactions?: TransactionItem[];
  snapshots?: ProfileSnapshot[];
  isReanalysis?: boolean;
  advisoryMode?: AdvisoryMode;
}): Promise<AiConsultationResult> {
  const ai = getAiClient();
  const profileContext = formatProfileContext(
    params.profile,
    params.transactions,
    params.snapshots
  );
  const modeGuidance =
    ADVISORY_MODE_GUIDANCE[params.advisoryMode ?? 'general'] ?? ADVISORY_MODE_GUIDANCE.general;

  const userPrompt = params.isReanalysis
    ? `Người dùng vừa cập nhật hồ sơ tài chính và nhấn "Phân tích lại". Hãy đối chiếu lại thu nhập, chi tiêu, biến động qua các mốc/tháng, khoản phát sinh ngoài hạn mức và tiến độ tiết kiệm thực tế để đánh giá lại tình hình, cảnh báo rõ điểm vượt ngân sách hoặc chậm mục tiêu (nếu có) và lập kế hoạch tài chính cập nhật.\n\nTRỌNG TÂM TƯ VẤN: ${modeGuidance}\n\n${profileContext}`
    : `Người dùng vừa điền hồ sơ tài chính và nhấn "Phân tích và tư vấn". Hãy kiểm tra dữ liệu hồ sơ và dữ liệu theo dõi thực tế dưới đây. Nếu thiếu dữ liệu cốt lõi (ví dụ thu nhập bằng 0 và chưa mô tả hoàn cảnh), hãy hỏi bổ sung. Nếu đã có đủ dữ liệu, hãy phân tích hoàn cảnh, nhận xét tình hình hiện tại, đề xuất giải pháp thực tế và lập kế hoạch tài chính cụ thể.\n\nTRỌNG TÂM TƯ VẤN: ${modeGuidance}\n\n${profileContext}`;

  const response = await generateWithFallback(ai, {
    contents: userPrompt,
    systemInstruction: `${SYSTEM_INSTRUCTION}\n\nƯU TIÊN TỐC ĐỘ & SÚC TÍCH: Trả lời trực diện, rõ số liệu, tối đa khoảng 350–450 từ cho replyMarkdown để người dùng đọc nhanh và dễ áp dụng.`,
  });

  const parsed = parseJsonResponse(response.text);

  const hasPlan = Boolean(parsed.hasPlan && parsed.plan && typeof parsed.plan === 'object');
  return {
    needsMoreInfo: Boolean(parsed.needsMoreInfo),
    replyMarkdown:
      parsed.replyMarkdown ||
      'Tôi đã tiếp nhận thông tin của bạn. Hãy cho tôi biết thêm về thu nhập và chi tiêu hàng tháng để tư vấn chi tiết hơn.',
    hasPlan,
    plan: hasPlan ? normalizePlan(parsed.plan) : undefined,
  };
}

export async function generateChatReply(params: {
  profile: FinancialProfile;
  transactions?: TransactionItem[];
  snapshots?: ProfileSnapshot[];
  history: Array<Pick<ChatMessage, 'role' | 'content'>>;
  userMessage: string;
  advisoryMode?: AdvisoryMode;
}): Promise<AiConsultationResult> {
  const ai = getAiClient();
  const profileContext = formatProfileContext(
    params.profile,
    params.transactions,
    params.snapshots
  );
  const modeGuidance =
    ADVISORY_MODE_GUIDANCE[params.advisoryMode ?? 'general'] ?? ADVISORY_MODE_GUIDANCE.general;

  const recentHistory = params.history.slice(-10).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const contextualSystem = `${SYSTEM_INSTRUCTION}

TRỌNG TÂM TƯ VẤN HIỆN TẠI: ${modeGuidance}

${profileContext}

LƯU Ý BỐI CẢNH HỘI THOẠI:
- Luôn ghi nhớ ngữ cảnh các tin nhắn trước đó trong phiên chat này.
- Trả lời súc tích, thực tế, dễ áp dụng ngay (khoảng 250–400 từ cho replyMarkdown nếu không cần bảng dài).
- Nếu người dùng đưa ra số liệu mới trong tin nhắn chat (ví dụ: thu nhập thay đổi, chi phát sinh đột xuất, kịch bản giả định), hãy phân tích dựa trên số liệu mới đó và tạo/cập nhật \`plan\` (\`hasPlan: true\`) nếu phù hợp.`;

  const contents = [
    ...recentHistory,
    {
      role: 'user',
      parts: [{ text: params.userMessage }],
    },
  ];

  const response = await generateWithFallback(ai, {
    contents,
    systemInstruction: contextualSystem,
  });

  const parsed = parseJsonResponse(response.text);

  const hasPlan = Boolean(parsed.hasPlan && parsed.plan && typeof parsed.plan === 'object');
  return {
    needsMoreInfo: Boolean(parsed.needsMoreInfo),
    replyMarkdown:
      parsed.replyMarkdown ||
      'Xin lỗi, tôi chưa thể xử lý trọn vẹn yêu cầu này. Bạn có thể diễn đạt rõ hơn về thu nhập hoặc khoản chi cần tư vấn không?',
    hasPlan,
    plan: hasPlan ? normalizePlan(parsed.plan) : undefined,
  };
}
