import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  ChatMessage,
  FinancialPlan,
  FinancialProfile,
  PlanActionStep,
  PlanAllocation,
  TransactionItem,
} from '../types.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
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
2. KHÔNG tự bịa dữ liệu hoặc giả định hoàn cảnh người dùng. Chỉ tính toán trên đúng số liệu người dùng đã cung cấp trong hồ sơ tài chính hoặc trong tin nhắn.
3. KHI THIẾU THÔNG TIN: Nếu người dùng hỏi một bài toán cá nhân hóa nhưng chưa cung cấp mức thu nhập, khoản chi chính hoặc hoàn cảnh cụ thể (cả trong hồ sơ lẫn tin nhắn), hãy đặt \`needsMoreInfo: true\`, \`hasPlan: false\`, giải thích ngắn gọn phần nào còn thiếu và hỏi lại 2–4 câu hỏi cụ thể để người dùng bổ sung. Tuy nhiên, nếu người dùng đã nêu rõ số liệu trong tin nhắn (ví dụ "Tôi là sinh viên, có 4 triệu/tháng...") hoặc trong hồ sơ đã có số liệu, hãy phân tích ngay lập tức một cách chi tiết, thực tế!
4. CHÍNH XÁC SỐ HỌC: Khi lập bảng phân bổ ngân sách (\`allocations\`), tổng số tiền các hạng mục phải khớp với thu nhập hàng tháng (hoặc mức ngân sách đang phân tích), tổng tỷ lệ phần trăm xấp xỉ 100%, giải thích rõ lý do từng khoản.
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
  transactions: TransactionItem[] = []
): string {
  if (!transactions || transactions.length === 0) return '';

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter((t) => t.txDate.startsWith(currentMonthKey));

  const monthExpense = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthIncome = monthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthSavings = monthTx
    .filter((t) => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalSavedAllTime = transactions
    .filter((t) => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);

  const byCategory = new Map<string, number>();
  for (const t of monthTx) {
    if (t.type === 'expense') {
      byCategory.set(t.category, (byCategory.get(t.category) || 0) + t.amount);
    }
  }

  const categoryComparison = profile.expenses
    .filter((e) => e.amount > 0 || byCategory.has(e.category))
    .map((e) => {
      const actual = byCategory.get(e.category) || 0;
      return `  + ${e.category}: đã chi ${formatVnd(actual)} / hạn mức ${formatVnd(e.amount)}`;
    });

  for (const [cat, actual] of byCategory.entries()) {
    if (!profile.expenses.some((e) => e.category === cat)) {
      categoryComparison.push(`  + ${cat}: đã chi ${formatVnd(actual)} (ngoài hạn mức khai báo)`);
    }
  }

  return `

DỮ LIỆU THEO DÕI THU CHI THỰC TẾ TRONG SỔ GHI CHÉP (${currentMonthKey}):
- Số giao dịch đã ghi tháng này: ${monthTx.length} (tổng ${transactions.length} giao dịch đã lưu)
- Thực tế tháng này: Thu bổ sung ${formatVnd(monthIncome)}, Đã chi ${formatVnd(monthExpense)}, Bỏ quỹ tiết kiệm ${formatVnd(monthSavings)}
- Tổng đã bỏ quỹ tiết kiệm tích lũy: ${formatVnd(totalSavedAllTime)}${profile.targetAmount > 0 ? ` / mục tiêu ${formatVnd(profile.targetAmount)}` : ''}
${categoryComparison.length > 0 ? `- Đối chiếu từng hạng mục tháng này:\n${categoryComparison.join('\n')}` : ''}`;
}

export function formatProfileContext(
  profile: FinancialProfile,
  transactions: TransactionItem[] = []
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
  const trackingSummary = summarizeTrackingContext(profile, transactions);

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

function isQuotaOrRateError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
}

function isTransientServerError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('500');
}

async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    systemInstruction: string;
  }
) {
  const candidates: Array<{ model: string; thinkingLevel?: ThinkingLevel }> =
    Date.now() < hydrogenCooldownUntil
      ? [{ model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.LOW }]
      : [
          { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.MEDIUM },
          { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.LOW },
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
        if (candidate.model === 'gemini-4-hydrogen' && isQuotaOrRateError(error)) {
          hydrogenCooldownUntil = Date.now() + 5 * 60 * 1000;
          break;
        }
        if ((isTransientServerError(error) || isQuotaOrRateError(error)) && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 900));
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
  const trimmed = (rawText ?? '{}')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(trimmed || '{}');
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
  isReanalysis?: boolean;
}): Promise<AiConsultationResult> {
  const ai = getAiClient();
  const profileContext = formatProfileContext(params.profile, params.transactions);

  const userPrompt = params.isReanalysis
    ? `Người dùng vừa cập nhật hồ sơ tài chính và nhấn "Phân tích lại". Hãy đối chiếu lại thu nhập, chi tiêu, mục tiêu và vấn đề mới nhất của họ để đánh giá lại tình hình, điều chỉnh ngân sách và lập kế hoạch tài chính cập nhật.\n\n${profileContext}`
    : `Người dùng vừa điền hồ sơ tài chính và nhấn "Phân tích và tư vấn". Hãy kiểm tra dữ liệu hồ sơ dưới đây. Nếu thiếu dữ liệu cốt lõi (ví dụ thu nhập bằng 0 và chưa mô tả hoàn cảnh), hãy hỏi bổ sung. Nếu đã có đủ dữ liệu, hãy phân tích hoàn cảnh, nhận xét tình hình hiện tại, đề xuất giải pháp thực tế và lập kế hoạch tài chính cụ thể.\n\n${profileContext}`;

  const response = await generateWithFallback(ai, {
    contents: userPrompt,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const parsed = parseJsonResponse(response.text);

  const hasPlan = Boolean(parsed.hasPlan && parsed.plan);
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
  history: ChatMessage[];
  userMessage: string;
}): Promise<AiConsultationResult> {
  const ai = getAiClient();
  const profileContext = formatProfileContext(params.profile, params.transactions);

  const recentHistory = params.history.slice(-16).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const contextualSystem = `${SYSTEM_INSTRUCTION}

${profileContext}

LƯU Ý BỐI CẢNH HỘI THOẠI:
- Luôn ghi nhớ ngữ cảnh các tin nhắn trước đó trong phiên chat này.
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

  const hasPlan = Boolean(parsed.hasPlan && parsed.plan);
  return {
    needsMoreInfo: Boolean(parsed.needsMoreInfo),
    replyMarkdown:
      parsed.replyMarkdown ||
      'Xin lỗi, tôi chưa thể xử lý trọn vẹn yêu cầu này. Bạn có thể diễn đạt rõ hơn về thu nhập hoặc khoản chi cần tư vấn không?',
    hasPlan,
    plan: hasPlan ? normalizePlan(parsed.plan) : undefined,
  };
}
