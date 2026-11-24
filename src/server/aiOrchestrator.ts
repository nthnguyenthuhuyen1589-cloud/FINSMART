import type {
  AdvisoryMode,
  AiProvidersAvailability,
  ChatMessage,
  FinancialPlan,
  FinancialProfile,
  ProfileSnapshot,
  ProviderStatusInfo,
  TransactionItem,
} from '../types.ts';
import { runRulesConsultation } from '../utils/RulesEngine.ts';
import { generateChatReply, generateInitialConsultation } from './gemini.ts';

export interface HybridConsultationOutcome {
  needsMoreInfo: boolean;
  replyMarkdown: string;
  hasPlan: boolean;
  plan?: Omit<FinancialPlan, 'id' | 'sessionId' | 'conversationId' | 'createdAt'>;
  providerStatus: ProviderStatusInfo;
}

const GEMINI_TIMEOUT_MS = 18_000;

function sanitizeGeminiKey(raw?: string): string {
  const val = (raw ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^GEMINI_API_KEY=/i, '')
    .trim();
  if (
    !val ||
    val === 'MY_GEMINI_API_KEY' ||
    val === 'YOUR_API_KEY' ||
    val === 'API_KEY_HERE'
  ) {
    return '';
  }
  return val;
}

export function getAiProvidersAvailability(): AiProvidersAvailability {
  const geminiConfigured = Boolean(sanitizeGeminiKey(process.env.GEMINI_API_KEY));
  return {
    geminiConfigured,
    anyAiConfigured: geminiConfigured,
    primaryProvider: geminiConfigured ? 'Gemini' : null,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function buildFallbackNotice(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('GEMINI_API_KEY_MISSING')) {
    return 'Chưa có API Key Gemini trên máy chủ, hệ thống đã tự động chuyển sang chế độ Công thức & Quy tắc.';
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'Gemini AI tạm thời hết hạn mức (quota), hệ thống đã tự động chuyển sang chế độ Công thức & Quy tắc.';
  }
  if (msg.includes('GEMINI_TIMEOUT')) {
    return 'Kết nối tới Gemini AI quá thời gian chờ, hệ thống đã tự động chuyển sang chế độ Công thức & Quy tắc.';
  }
  return 'Gemini AI tạm thời không khả dụng hoặc gặp lỗi kết nối, hệ thống đã tự động chuyển sang chế độ Công thức & Quy tắc.';
}

export async function orchestrateConsultation(params: {
  aiEnabled: boolean;
  profile: FinancialProfile;
  transactions: TransactionItem[];
  snapshots: ProfileSnapshot[];
  isReanalysis: boolean;
  advisoryMode: AdvisoryMode;
}): Promise<HybridConsultationOutcome> {
  const runRules = () =>
    runRulesConsultation({
      profile: params.profile,
      snapshots: params.snapshots,
      transactions: params.transactions,
      advisoryMode: params.advisoryMode,
      isReanalysis: params.isReanalysis,
    });

  // 1. Khi người dùng tắt AI -> chạy trực tiếp hệ thống Công thức & Quy tắc, không gọi AI
  if (!params.aiEnabled) {
    const out = runRules();
    return {
      needsMoreInfo: out.needsMoreInfo,
      replyMarkdown: out.replyMarkdown,
      hasPlan: out.hasPlan,
      plan: out.plan,
      providerStatus: {
        source: 'rules',
        provider: 'RulesEngine',
        aiEnabled: false,
        fallbackUsed: false,
        notice: 'Đang sử dụng chế độ Công thức & Quy tắc (AI đang tắt).',
      },
    };
  }

  // 2. Khi AI đang bật -> ưu tiên dùng Gemini AI như trước
  const hasGeminiKey = Boolean(sanitizeGeminiKey(process.env.GEMINI_API_KEY));
  if (hasGeminiKey) {
    try {
      const geminiRes = await withTimeout(
        generateInitialConsultation({
          profile: params.profile,
          transactions: params.transactions,
          snapshots: params.snapshots,
          isReanalysis: params.isReanalysis,
          advisoryMode: params.advisoryMode,
        }),
        GEMINI_TIMEOUT_MS
      );
      return {
        needsMoreInfo: geminiRes.needsMoreInfo,
        replyMarkdown: geminiRes.replyMarkdown,
        hasPlan: geminiRes.hasPlan,
        plan: geminiRes.plan,
        providerStatus: {
          source: 'ai',
          provider: 'Gemini',
          aiEnabled: true,
          fallbackUsed: false,
          notice: null,
        },
      };
    } catch (error) {
      console.warn(
        '[FINSMART Hybrid] Gemini consultation unavailable, falling back to RulesEngine:',
        error instanceof Error ? error.message : error
      );
      const out = runRules();
      return {
        needsMoreInfo: out.needsMoreInfo,
        replyMarkdown: out.replyMarkdown,
        hasPlan: out.hasPlan,
        plan: out.plan,
        providerStatus: {
          source: 'rules',
          provider: 'RulesEngine',
          aiEnabled: true,
          fallbackUsed: true,
          notice: buildFallbackNotice(error),
        },
      };
    }
  }

  // 3. Không có Gemini API Key -> tự động dùng RulesEngine
  const out = runRules();
  return {
    needsMoreInfo: out.needsMoreInfo,
    replyMarkdown: out.replyMarkdown,
    hasPlan: out.hasPlan,
    plan: out.plan,
    providerStatus: {
      source: 'rules',
      provider: 'RulesEngine',
      aiEnabled: true,
      fallbackUsed: true,
      notice:
        'Chưa có API Key Gemini trên máy chủ, hệ thống đã tự động chuyển sang chế độ Công thức & Quy tắc.',
    },
  };
}

export async function orchestrateChatReply(params: {
  aiEnabled: boolean;
  profile: FinancialProfile;
  transactions: TransactionItem[];
  snapshots: ProfileSnapshot[];
  history: Array<Pick<ChatMessage, 'role' | 'content'>>;
  userMessage: string;
  advisoryMode: AdvisoryMode;
}): Promise<HybridConsultationOutcome> {
  const runRules = () =>
    runRulesConsultation({
      profile: params.profile,
      snapshots: params.snapshots,
      transactions: params.transactions,
      userMessage: params.userMessage,
      advisoryMode: params.advisoryMode,
    });

  // 1. Khi người dùng tắt AI -> chạy trực tiếp hệ thống Công thức & Quy tắc, không gọi AI
  if (!params.aiEnabled) {
    const out = runRules();
    return {
      needsMoreInfo: out.needsMoreInfo,
      replyMarkdown: out.replyMarkdown,
      hasPlan: out.hasPlan,
      plan: out.plan,
      providerStatus: {
        source: 'rules',
        provider: 'RulesEngine',
        aiEnabled: false,
        fallbackUsed: false,
        notice: 'Đang sử dụng chế độ Công thức & Quy tắc (AI đang tắt).',
      },
    };
  }

  // 2. Khi AI đang bật -> ưu tiên dùng Gemini AI như trước
  const hasGeminiKey = Boolean(sanitizeGeminiKey(process.env.GEMINI_API_KEY));
  if (hasGeminiKey) {
    try {
      const geminiRes = await withTimeout(
        generateChatReply({
          profile: params.profile,
          transactions: params.transactions,
          snapshots: params.snapshots,
          history: params.history,
          userMessage: params.userMessage,
          advisoryMode: params.advisoryMode,
        }),
        GEMINI_TIMEOUT_MS
      );
      return {
        needsMoreInfo: geminiRes.needsMoreInfo,
        replyMarkdown: geminiRes.replyMarkdown,
        hasPlan: geminiRes.hasPlan,
        plan: geminiRes.plan,
        providerStatus: {
          source: 'ai',
          provider: 'Gemini',
          aiEnabled: true,
          fallbackUsed: false,
          notice: null,
        },
      };
    } catch (error) {
      console.warn(
        '[FINSMART Hybrid] Gemini chat unavailable, falling back to RulesEngine:',
        error instanceof Error ? error.message : error
      );
      const out = runRules();
      return {
        needsMoreInfo: out.needsMoreInfo,
        replyMarkdown: out.replyMarkdown,
        hasPlan: out.hasPlan,
        plan: out.plan,
        providerStatus: {
          source: 'rules',
          provider: 'RulesEngine',
          aiEnabled: true,
          fallbackUsed: true,
          notice: buildFallbackNotice(error),
        },
      };
    }
  }

  // 3. Không có Gemini API Key -> tự động dùng RulesEngine
  const out = runRules();
  return {
    needsMoreInfo: out.needsMoreInfo,
    replyMarkdown: out.replyMarkdown,
    hasPlan: out.hasPlan,
    plan: out.plan,
    providerStatus: {
      source: 'rules',
      provider: 'RulesEngine',
      aiEnabled: true,
      fallbackUsed: true,
      notice:
        'Chưa có API Key Gemini trên máy chủ, hệ thống đã tự động chuyển sang chế độ Công thức & Quy tắc.',
    },
  };
}
