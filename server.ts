import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  addMessage,
  checkDbHealth,
  createConversation,
  createTransaction,
  createTransactionsBatch,
  deleteAllConversations,
  deleteAllTransactions,
  deleteConversation,
  deleteFinancialPlan,
  deleteProfileSnapshot,
  deleteTransaction,
  getConversation,
  getOrCreateProfile,
  listConversations,
  listFinancialPlans,
  listMessages,
  listProfileSnapshots,
  listTransactions,
  resetDeviceWorkspace,
  resetProfileAndSnapshots,
  saveFinancialPlan,
  updateConversationTitle,
  updateTransaction,
  upsertProfile,
} from './src/server/db.ts';
import {
  getAiProvidersAvailability,
  orchestrateChatReply,
  orchestrateConsultation,
} from './src/server/aiOrchestrator.ts';
import type {
  AdvisoryMode,
  FinancialProfile,
  ProfileSnapshot,
  TransactionItem,
  TransactionType,
} from './src/types.ts';

function getSessionId(req: express.Request): string {
  const fromQuery = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
  const fromHeader =
    typeof req.headers['x-finsmart-session'] === 'string'
      ? req.headers['x-finsmart-session'].trim()
      : '';
  const fromBody =
    req.body && typeof req.body.sessionId === 'string' ? req.body.sessionId.trim() : '';
  const candidate = fromBody || fromQuery || fromHeader || 'default-workspace';
  return candidate.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default-workspace';
}

function mapAiError(error: unknown): { status: number; message: string } {
  const status = (error as { status?: number })?.status;
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('GEMINI_API_KEY_MISSING')) {
    return {
      status: 500,
      message:
        'Hệ thống chưa được cấu hình GEMINI_API_KEY ở máy chủ. Vui lòng kiểm tra mục Settings > Secrets.',
    };
  }
  if (
    status === 401 ||
    status === 403 ||
    raw.includes('UNAUTHENTICATED') ||
    raw.includes('PERMISSION_DENIED') ||
    raw.includes('API_KEY_INVALID') ||
    raw.includes('API key not valid') ||
    raw.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
    raw.includes('401') ||
    raw.includes('403')
  ) {
    return {
      status: 502,
      message:
        'Không thể xác thực kết nối dịch vụ tư vấn (API Key chưa hợp lệ hoặc chưa mở quyền Generative Language API). Vui lòng kiểm tra và chọn lại GEMINI_API_KEY tại Settings > Secrets.',
    };
  }
  if (status === 400 || raw.includes('INVALID_ARGUMENT')) {
    return {
      status: 400,
      message:
        'Yêu cầu phân tích chưa hợp lệ với cấu hình mô hình hiện tại. Vui lòng thử diễn đạt ngắn gọn hơn hoặc thử lại.',
    };
  }
  if (status === 429 || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message:
        'Hệ thống tư vấn đang tạm thời quá tải lượt gọi. Vui lòng thử lại sau vài giây.',
    };
  }
  return {
    status: 500,
    message: 'Đã xảy ra lỗi khi kết nối chuyên gia tư vấn. Vui lòng thử lại.',
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    const dbOk = checkDbHealth();
    res.json({ status: dbOk ? 'ok' : 'degraded', db: dbOk });
  });

  // Check optional AI provider availability without exposing any secret keys
  app.get('/api/ai-status', (_req, res) => {
    res.json(getAiProvidersAvailability());
  });

  // Load entire workspace for session
  app.get('/api/workspace', (req, res) => {
    const sessionId = getSessionId(req);
    const profile = getOrCreateProfile(sessionId);
    const snapshots = listProfileSnapshots(sessionId);
    const conversations = listConversations(sessionId);
    const requestedConvId =
      typeof req.query.conversationId === 'string' ? req.query.conversationId.trim() : '';

    let activeConversationId: string | null = null;
    if (requestedConvId && conversations.some((c) => c.id === requestedConvId)) {
      activeConversationId = requestedConvId;
    } else if (conversations.length > 0) {
      activeConversationId = conversations[0].id;
    }

    const messages = activeConversationId ? listMessages(activeConversationId) : [];
    const plans = listFinancialPlans(sessionId);
    const transactions = listTransactions(sessionId);

    res.json({
      profile,
      snapshots,
      transactions,
      conversations,
      activeConversationId,
      messages,
      plans,
    });
  });

  // Reset entire workspace for current device session ONLY
  app.delete('/api/workspace', (req, res) => {
    const sessionId = getSessionId(req);
    const freshProfile = resetDeviceWorkspace(sessionId);
    res.json({
      reset: true,
      profile: freshProfile,
      snapshots: [],
      transactions: [],
      conversations: [],
      activeConversationId: null,
      messages: [],
      plans: [],
    });
  });

  // Update financial profile & persist snapshot for recordDate
  app.put('/api/profile', (req, res) => {
    const sessionId = getSessionId(req);
    const body = req.body as Partial<FinancialProfile>;
    const updated = upsertProfile({
      ...body,
      sessionId,
    });
    const snapshots = listProfileSnapshots(sessionId);
    res.json({ profile: updated, snapshots });
  });

  // Reset financial profile & all saved profile snapshots for current device session ONLY
  app.delete('/api/profile', (req, res) => {
    const sessionId = getSessionId(req);
    const freshProfile = resetProfileAndSnapshots(sessionId);
    res.json({ reset: true, profile: freshProfile, snapshots: [] });
  });

  // Delete a saved profile date snapshot
  app.delete('/api/snapshots/:id', (req, res) => {
    const sessionId = getSessionId(req);
    const deleted = deleteProfileSnapshot(req.params.id, sessionId);
    if (!deleted) {
      res.status(404).json({ error: 'Không tìm thấy mốc thời gian để xóa.' });
      return;
    }
    const snapshots = listProfileSnapshots(sessionId);
    res.json({ deleted: true, snapshots });
  });

  // Create daily transaction (expense / income / savings)
  app.post('/api/transactions', (req, res) => {
    const sessionId = getSessionId(req);
    const body = req.body as {
      txDate?: string;
      type?: TransactionType;
      category?: string;
      amount?: number;
      note?: string;
    };

    const amount = Math.round(Number(body?.amount) || 0);
    if (amount <= 0) {
      res.status(400).json({ error: 'Vui lòng nhập số tiền lớn hơn 0.' });
      return;
    }

    const type: TransactionType =
      body?.type === 'income' ? 'income' : body?.type === 'savings' ? 'savings' : 'expense';
    const category = typeof body?.category === 'string' && body.category.trim() ? body.category.trim() : 'Khoản khác';

    const transaction = createTransaction({
      sessionId,
      txDate: body?.txDate,
      type,
      category,
      amount,
      note: body?.note,
    });
    const transactions = listTransactions(sessionId);
    res.status(201).json({ transaction, transactions });
  });

  // Create multiple daily transactions in one request
  app.post('/api/transactions/batch', (req, res) => {
    const sessionId = getSessionId(req);
    const body = req.body as {
      items?: Array<{
        txDate?: string;
        type?: TransactionType;
        category?: string;
        amount?: number;
        note?: string;
      }>;
    };

    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const validItems = rawItems
      .map((item) => ({
        txDate: item.txDate,
        type: (item.type === 'income'
          ? 'income'
          : item.type === 'savings'
            ? 'savings'
            : 'expense') as TransactionType,
        category:
          typeof item.category === 'string' && item.category.trim()
            ? item.category.trim()
            : 'Khoản khác',
        amount: Math.round(Number(item.amount) || 0),
        note: item.note,
      }))
      .filter((item) => item.amount > 0);

    if (validItems.length === 0) {
      res.status(400).json({ error: 'Vui lòng nhập ít nhất 1 khoản có số tiền lớn hơn 0.' });
      return;
    }

    const created = createTransactionsBatch(sessionId, validItems);
    const transactions = listTransactions(sessionId);
    res.status(201).json({ created, transactions });
  });

  // Delete all transactions (or filter by ?type=income|expense|savings) for current device session ONLY
  app.delete('/api/transactions', (req, res) => {
    const sessionId = getSessionId(req);
    const rawType = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const filterType: TransactionType | undefined =
      rawType === 'income' || rawType === 'expense' || rawType === 'savings'
        ? rawType
        : undefined;
    const count = deleteAllTransactions(sessionId, filterType);
    const transactions = listTransactions(sessionId);
    res.json({ deleted: true, count, transactions });
  });

  // Update daily transaction (e.g. savings goal / fund entry)
  app.put('/api/transactions/:id', (req, res) => {
    const sessionId = getSessionId(req);
    const body = req.body as {
      txDate?: string;
      category?: string;
      amount?: number;
      note?: string;
    };

    if (body?.amount !== undefined && Math.round(Number(body.amount) || 0) <= 0) {
      res.status(400).json({ error: 'Vui lòng nhập số tiền lớn hơn 0.' });
      return;
    }

    const updated = updateTransaction(req.params.id, sessionId, body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Không tìm thấy giao dịch để cập nhật.' });
      return;
    }
    const transactions = listTransactions(sessionId);
    res.json({ transaction: updated, transactions });
  });

  // Delete daily transaction
  app.delete('/api/transactions/:id', (req, res) => {
    const sessionId = getSessionId(req);
    const deleted = deleteTransaction(req.params.id, sessionId);
    if (!deleted) {
      res.status(404).json({ error: 'Không tìm thấy giao dịch để xóa.' });
      return;
    }
    const transactions = listTransactions(sessionId);
    res.json({ deleted: true, transactions });
  });

  // Create new conversation
  app.post('/api/conversations', (req, res) => {
    const sessionId = getSessionId(req);
    const title =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : 'Phiên tư vấn mới';
    const conversation = createConversation(sessionId, title);
    res.status(201).json({ conversation });
  });

  // Get messages for a conversation
  app.get('/api/conversations/:id/messages', (req, res) => {
    const sessionId = getSessionId(req);
    const conv = getConversation(req.params.id);
    if (!conv || conv.sessionId !== sessionId) {
      res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' });
      return;
    }
    const messages = listMessages(conv.id);
    res.json({ conversation: conv, messages });
  });

  // Delete conversation
  app.delete('/api/conversations/:id', (req, res) => {
    const sessionId = getSessionId(req);
    const deleted = deleteConversation(req.params.id, sessionId);
    if (!deleted) {
      res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện để xóa.' });
      return;
    }
    res.json({ deleted: true });
  });

  // Delete all chat history for current device session
  app.delete('/api/chat-history', (req, res) => {
    const sessionId = getSessionId(req);
    const count = deleteAllConversations(sessionId);
    res.json({ deleted: true, count });
  });

  // Analyze financial profile & generate consultation + plan (Hybrid: Gemini AI -> RulesEngine)
  app.post('/api/consult', async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const {
        profile: profilePayload,
        conversationId,
        isReanalysis,
        advisoryMode,
        aiEnabled,
        clientTransactions,
        clientSnapshots,
      } = req.body as {
        profile?: Partial<FinancialProfile>;
        conversationId?: string | null;
        isReanalysis?: boolean;
        advisoryMode?: AdvisoryMode;
        aiEnabled?: boolean;
        clientTransactions?: TransactionItem[];
        clientSnapshots?: ProfileSnapshot[];
      };

      const savedProfile = profilePayload
        ? upsertProfile({ ...profilePayload, sessionId })
        : getOrCreateProfile(sessionId);

      let conv = conversationId ? getConversation(conversationId) : null;
      if (conv && conv.sessionId !== sessionId) {
        conv = null;
      }

      const totalExpenses = savedProfile.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const summaryPrompt = isReanalysis
        ? `Yêu cầu phân tích lại với hồ sơ cập nhật: Đối tượng ${savedProfile.roleType}, Thu nhập ${new Intl.NumberFormat('vi-VN').format(savedProfile.monthlyIncome)} đ/tháng, Tổng chi tiêu ${new Intl.NumberFormat('vi-VN').format(totalExpenses)} đ/tháng${savedProfile.financialGoal ? `, Mục tiêu: ${savedProfile.financialGoal}` : ''}.`
        : `Phân tích hồ sơ tài chính: Đối tượng ${savedProfile.roleType}, Thu nhập ${new Intl.NumberFormat('vi-VN').format(savedProfile.monthlyIncome)} đ/tháng, Tổng chi tiêu ${new Intl.NumberFormat('vi-VN').format(totalExpenses)} đ/tháng${savedProfile.financialGoal ? `, Mục tiêu: ${savedProfile.financialGoal}` : ''}${savedProfile.currentProblem ? `. Vấn đề: ${savedProfile.currentProblem}` : ''}.`;

      const dbTransactions = listTransactions(sessionId);
      const transactions =
        dbTransactions.length > 0
          ? dbTransactions
          : Array.isArray(clientTransactions)
            ? clientTransactions
            : [];
      const dbSnapshots = listProfileSnapshots(sessionId);
      const snapshots =
        dbSnapshots.length > 0
          ? dbSnapshots
          : Array.isArray(clientSnapshots)
            ? clientSnapshots
            : [];

      const outcome = await orchestrateConsultation({
        aiEnabled: aiEnabled !== false,
        profile: savedProfile,
        transactions,
        snapshots,
        isReanalysis: Boolean(isReanalysis),
        advisoryMode: advisoryMode ?? 'general',
      });

      if (!conv) {
        const titleBase = savedProfile.financialGoal
          ? `Kế hoạch: ${savedProfile.financialGoal.slice(0, 48)}`
          : savedProfile.monthlyIncome > 0
            ? `Tư vấn thu nhập ${new Intl.NumberFormat('vi-VN').format(savedProfile.monthlyIncome)}đ`
            : 'Phân tích tài chính cá nhân';
        conv = createConversation(sessionId, titleBase);
      }

      const userMsg = addMessage({
        conversationId: conv.id,
        role: 'user',
        content: summaryPrompt,
      });

      let savedPlan: ReturnType<typeof saveFinancialPlan> | null = null;
      if (outcome.hasPlan && outcome.plan) {
        savedPlan = saveFinancialPlan({
          sessionId,
          conversationId: conv.id,
          planDate: savedProfile.recordDate,
          source: outcome.providerStatus.source,
          provider: outcome.providerStatus.provider,
          ...outcome.plan,
        });
      }

      const assistantMsg = addMessage({
        conversationId: conv.id,
        role: 'assistant',
        content: outcome.replyMarkdown,
        needsMoreInfo: outcome.needsMoreInfo,
        planId: savedPlan?.id ?? null,
        source: outcome.providerStatus.source,
        provider: outcome.providerStatus.provider,
        fallbackNotice: outcome.providerStatus.notice,
      });

      if (savedPlan && conv.title === 'Phiên tư vấn mới') {
        updateConversationTitle(conv.id, savedPlan.title);
      }

      res.json({
        profile: savedProfile,
        snapshots: listProfileSnapshots(sessionId),
        conversation: getConversation(conv.id) ?? conv,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        plan: savedPlan,
        providerStatus: outcome.providerStatus,
      });
    } catch (error) {
      const mapped = mapAiError(error);
      console.error('Error in /api/consult:', error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Multi-turn hybrid consultation chat
  app.post('/api/chat', async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const {
        message,
        conversationId,
        advisoryMode,
        aiEnabled,
        clientHistory,
        clientProfile,
        clientTransactions,
        clientSnapshots,
      } = req.body as {
        message?: string;
        conversationId?: string | null;
        advisoryMode?: AdvisoryMode;
        aiEnabled?: boolean;
        clientHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
        clientProfile?: Partial<FinancialProfile>;
        clientTransactions?: TransactionItem[];
        clientSnapshots?: ProfileSnapshot[];
      };

      const trimmed = typeof message === 'string' ? message.trim() : '';
      if (!trimmed) {
        res.status(400).json({ error: 'Vui lòng nhập nội dung câu hỏi.' });
        return;
      }

      let profile = getOrCreateProfile(sessionId);
      const dbProfileEmpty =
        !profile.fullName?.trim() &&
        profile.monthlyIncome <= 0 &&
        !profile.expenses.some((e) => e.amount > 0) &&
        !profile.financialGoal?.trim();
      if (dbProfileEmpty && clientProfile) {
        profile = upsertProfile({ ...clientProfile, sessionId });
      }

      let conv = conversationId ? getConversation(conversationId) : null;
      if (conv && conv.sessionId !== sessionId) {
        conv = null;
      }

      const dbHistory = conv ? listMessages(conv.id) : [];
      const fallbackHistory = Array.isArray(clientHistory)
        ? clientHistory
            .filter((item) => item && typeof item.content === 'string' && item.content.trim())
            .slice(-10)
            .map((item) => ({
              role: (item.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
              content: item.content,
            }))
        : [];
      const effectiveHistory = dbHistory.length > 0 ? dbHistory : fallbackHistory;

      const dbTransactions = listTransactions(sessionId);
      const transactions =
        dbTransactions.length > 0
          ? dbTransactions
          : Array.isArray(clientTransactions)
            ? clientTransactions
            : [];
      const dbSnapshots = listProfileSnapshots(sessionId);
      const snapshots =
        dbSnapshots.length > 0
          ? dbSnapshots
          : Array.isArray(clientSnapshots)
            ? clientSnapshots
            : [];

      const outcome = await orchestrateChatReply({
        aiEnabled: aiEnabled !== false,
        profile,
        transactions,
        snapshots,
        history: effectiveHistory,
        userMessage: trimmed,
        advisoryMode: advisoryMode ?? 'general',
      });

      const autoTitle = trimmed.length > 52 ? `${trimmed.slice(0, 52)}...` : trimmed;
      if (!conv) {
        conv = createConversation(sessionId, autoTitle);
      } else if (dbHistory.length === 0 && conv.title === 'Phiên tư vấn mới') {
        updateConversationTitle(conv.id, autoTitle);
      }

      const userMsg = addMessage({
        conversationId: conv.id,
        role: 'user',
        content: trimmed,
      });

      let savedPlan: ReturnType<typeof saveFinancialPlan> | null = null;
      if (outcome.hasPlan && outcome.plan) {
        savedPlan = saveFinancialPlan({
          sessionId,
          conversationId: conv.id,
          planDate: profile.recordDate,
          source: outcome.providerStatus.source,
          provider: outcome.providerStatus.provider,
          ...outcome.plan,
        });
      }

      const assistantMsg = addMessage({
        conversationId: conv.id,
        role: 'assistant',
        content: outcome.replyMarkdown,
        needsMoreInfo: outcome.needsMoreInfo,
        planId: savedPlan?.id ?? null,
        source: outcome.providerStatus.source,
        provider: outcome.providerStatus.provider,
        fallbackNotice: outcome.providerStatus.notice,
      });

      res.json({
        conversation: getConversation(conv.id) ?? conv,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        plan: savedPlan,
        providerStatus: outcome.providerStatus,
      });
    } catch (error) {
      const mapped = mapAiError(error);
      console.error('Error in /api/chat:', error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // List saved financial plans
  app.get('/api/plans', (req, res) => {
    const sessionId = getSessionId(req);
    const plans = listFinancialPlans(sessionId);
    res.json({ plans });
  });

  // Direct plan generation in-place (supports both AI and Non-AI RulesEngine)
  app.post('/api/plans/generate', async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const {
        profile: profilePayload,
        aiEnabled,
        advisoryMode,
        clientTransactions,
        clientSnapshots,
      } = req.body as {
        profile?: Partial<FinancialProfile>;
        aiEnabled?: boolean;
        advisoryMode?: AdvisoryMode;
        clientTransactions?: TransactionItem[];
        clientSnapshots?: ProfileSnapshot[];
      };

      const savedProfile = profilePayload
        ? upsertProfile({ ...profilePayload, sessionId })
        : getOrCreateProfile(sessionId);

      const dbTransactions = listTransactions(sessionId);
      const transactions =
        dbTransactions.length > 0
          ? dbTransactions
          : Array.isArray(clientTransactions)
            ? clientTransactions
            : [];
      const dbSnapshots = listProfileSnapshots(sessionId);
      const snapshots =
        dbSnapshots.length > 0
          ? dbSnapshots
          : Array.isArray(clientSnapshots)
            ? clientSnapshots
            : [];

      const outcome = await orchestrateConsultation({
        aiEnabled: aiEnabled !== false,
        profile: savedProfile,
        transactions,
        snapshots,
        isReanalysis: false,
        advisoryMode: advisoryMode ?? 'general',
      });

      let savedPlan: ReturnType<typeof saveFinancialPlan> | null = null;
      if (outcome.hasPlan && outcome.plan) {
        savedPlan = saveFinancialPlan({
          sessionId,
          conversationId: 'direct-plan',
          planDate: savedProfile.recordDate,
          source: outcome.providerStatus.source,
          provider: outcome.providerStatus.provider,
          ...outcome.plan,
        });
      }

      const plans = listFinancialPlans(sessionId);
      res.json({
        plan: savedPlan,
        plans,
        needsMoreInfo: outcome.needsMoreInfo,
        replyMarkdown: outcome.replyMarkdown,
        providerStatus: outcome.providerStatus,
      });
    } catch (error) {
      const mapped = mapAiError(error);
      console.error('Error in /api/plans/generate:', error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Delete a financial plan
  app.delete('/api/plans/:id', (req, res) => {
    const sessionId = getSessionId(req);
    const deleted = deleteFinancialPlan(req.params.id, sessionId);
    if (!deleted) {
      res.status(404).json({ error: 'Không tìm thấy kế hoạch để xóa.' });
      return;
    }
    res.json({ deleted: true });
  });

  // Vite middleware in dev, static dist in production
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (!isProd || !fs.existsSync(distPath)) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FINSMART AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
