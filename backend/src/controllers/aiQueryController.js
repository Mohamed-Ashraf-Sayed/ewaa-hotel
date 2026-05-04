// Natural-language CRM assistant powered by Gemini.
// Defines a small set of READ-ONLY tools that respect each user's role-based
// access scope. The model picks tools and parameters; we execute them with
// Prisma — the model never gets raw DB access.

const { PrismaClient } = require('@prisma/client');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { getSubordinateIds } = require('../middleware/auth');

const prisma = new PrismaClient();

const ADMIN_ROLES = ['admin', 'general_manager', 'vice_gm'];

// ---- Access scope helpers ---------------------------------------------------
const buildClientScope = async (user) => {
  if (ADMIN_ROLES.includes(user.role)) return {};
  if (['credit_manager', 'credit_officer', 'contract_officer', 'reservations'].includes(user.role)) return {};
  if (user.role === 'assistant_sales' && user.managerId) {
    const teamIds = await getSubordinateIds(user.managerId);
    return { salesRepId: { in: [user.managerId, ...teamIds] } };
  }
  if (user.role === 'sales_director') {
    const subIds = await getSubordinateIds(user.id);
    return { salesRepId: { in: [user.id, ...subIds] } };
  }
  return { salesRepId: user.id };
};

// ---- Tool implementations ---------------------------------------------------
const trim = (str, max = 250) => (typeof str === 'string' && str.length > max ? str.slice(0, max) + '…' : str);

const tools = {
  search_clients: async (args, user) => {
    const scope = await buildClientScope(user);
    const where = { ...scope, isActive: true };

    if (args.client_type) where.clientType = args.client_type;
    if (args.brand) where.brands = { contains: args.brand };
    if (args.min_annual_budget != null) where.annualBudget = { gte: Number(args.min_annual_budget) };
    if (args.city) where.address = { contains: args.city };
    if (args.search) {
      where.OR = [
        { companyName: { contains: args.search } },
        { contactPerson: { contains: args.search } },
        { phone: { contains: args.search } },
        { email: { contains: args.search } },
      ];
    }
    if (args.not_contacted_days) {
      const cutoff = new Date(Date.now() - Number(args.not_contacted_days) * 86400000);
      where.activities = { none: { createdAt: { gte: cutoff } } };
    }

    const take = Math.min(Number(args.limit) || 25, 100);
    const rows = await prisma.client.findMany({
      where,
      take,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, companyName: true, contactPerson: true, phone: true, email: true,
        clientType: true, brands: true, address: true, annualBudget: true,
        salesRep: { select: { id: true, name: true } },
        hotel: { select: { name: true } },
        _count: { select: { contracts: true, visits: true } },
      },
    });
    return { count: rows.length, items: rows };
  },

  search_contracts: async (args, user) => {
    const where = {};
    if (!ADMIN_ROLES.includes(user.role) && user.role !== 'contract_officer') {
      const scope = await buildClientScope(user);
      Object.assign(where, scope);
    }
    if (args.status) where.status = args.status;
    if (args.expiring_in_days) {
      const cutoff = new Date(Date.now() + Number(args.expiring_in_days) * 86400000);
      where.endDate = { lte: cutoff, gte: new Date() };
    }
    if (args.min_total_value != null) where.totalValue = { gte: Number(args.min_total_value) };
    if (args.client_name) where.client = { companyName: { contains: args.client_name } };
    if (args.hotel_name) where.hotel = { name: { contains: args.hotel_name } };

    const take = Math.min(Number(args.limit) || 25, 100);
    const rows = await prisma.contract.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, contractRef: true, status: true, totalValue: true, collectedAmount: true,
        startDate: true, endDate: true, roomsCount: true, ratePerRoom: true,
        client: { select: { id: true, companyName: true } },
        hotel: { select: { name: true } },
        salesRep: { select: { id: true, name: true } },
      },
    });
    return { count: rows.length, items: rows };
  },

  search_payments: async (args, user) => {
    const where = {};
    if (!ADMIN_ROLES.includes(user.role) && !['credit_manager', 'credit_officer', 'contract_officer'].includes(user.role)) {
      const ids = user.role === 'sales_director'
        ? [user.id, ...(await getSubordinateIds(user.id))]
        : user.role === 'assistant_sales' && user.managerId
          ? [user.managerId, ...(await getSubordinateIds(user.managerId))]
          : [user.id];
      where.OR = [
        { collectedBy: { in: ids } },
        { contract: { salesRepId: { in: ids } } },
      ];
    }
    if (args.status) where.status = args.status;
    if (args.payment_type) where.paymentType = args.payment_type;
    if (args.min_amount != null) where.amount = { gte: Number(args.min_amount) };
    if (args.from_date) where.paymentDate = { ...(where.paymentDate || {}), gte: new Date(args.from_date) };
    if (args.to_date) where.paymentDate = { ...(where.paymentDate || {}), lte: new Date(`${args.to_date}T23:59:59`) };

    const take = Math.min(Number(args.limit) || 25, 100);
    const rows = await prisma.payment.findMany({
      where, take, orderBy: { paymentDate: 'desc' },
      select: {
        id: true, amount: true, paymentDate: true, paymentType: true, status: true,
        client: { select: { id: true, companyName: true } },
        contract: { select: { contractRef: true } },
        collector: { select: { name: true } },
      },
    });
    const totalAmount = rows.reduce((s, r) => s + (r.amount || 0), 0);
    return { count: rows.length, totalAmount, items: rows };
  },

  search_visits: async (args, user) => {
    const scope = await buildClientScope(user);
    const where = scope.salesRepId ? { salesRepId: scope.salesRepId } : {};
    if (args.visit_type) where.visitType = args.visit_type;
    if (args.from_date) where.visitDate = { ...(where.visitDate || {}), gte: new Date(args.from_date) };
    if (args.to_date) where.visitDate = { ...(where.visitDate || {}), lte: new Date(`${args.to_date}T23:59:59`) };
    if (args.client_name) where.client = { companyName: { contains: args.client_name } };
    if (args.has_followup_due) {
      where.nextFollowUp = { lte: new Date(), not: null };
    }

    const take = Math.min(Number(args.limit) || 25, 100);
    const rows = await prisma.visit.findMany({
      where, take, orderBy: { visitDate: 'desc' },
      select: {
        id: true, visitDate: true, visitType: true, purpose: true, outcome: true, nextFollowUp: true,
        client: { select: { id: true, companyName: true, contactPerson: true } },
        salesRep: { select: { name: true } },
      },
    });
    return { count: rows.length, items: rows };
  },

  search_bookings: async (args, user) => {
    const where = {};
    if (!ADMIN_ROLES.includes(user.role) && user.role !== 'reservations') {
      const ids = user.role === 'sales_director'
        ? [user.id, ...(await getSubordinateIds(user.id))]
        : user.role === 'assistant_sales' && user.managerId
          ? [user.managerId, ...(await getSubordinateIds(user.managerId))]
          : [user.id];
      where.assignedRepId = { in: ids };
    }
    if (args.status) where.status = args.status;
    if (args.hotel_name) where.hotel = { name: { contains: args.hotel_name } };
    if (args.client_name) where.client = { companyName: { contains: args.client_name } };
    if (args.from_date) where.arrivalDate = { ...(where.arrivalDate || {}), gte: new Date(args.from_date) };
    if (args.to_date) where.arrivalDate = { ...(where.arrivalDate || {}), lte: new Date(`${args.to_date}T23:59:59`) };

    const take = Math.min(Number(args.limit) || 25, 100);
    const rows = await prisma.booking.findMany({
      where, take, orderBy: { arrivalDate: 'desc' },
      select: {
        id: true, operaConfirmationNo: true, guestName: true, status: true, source: true,
        arrivalDate: true, departureDate: true, nights: true, roomsCount: true, totalAmount: true,
        client: { select: { id: true, companyName: true } },
        hotel: { select: { name: true } },
        assignedRep: { select: { name: true } },
      },
    });
    return { count: rows.length, items: rows };
  },

  get_dashboard_summary: async (_args, user) => {
    const scope = await buildClientScope(user);
    const [clients, leads, activeClients, totalContracts, pendingContracts, approvedContracts, visitsThisMonth] = await Promise.all([
      prisma.client.count({ where: { ...scope, isActive: true } }),
      prisma.client.count({ where: { ...scope, isActive: true, clientType: 'lead' } }),
      prisma.client.count({ where: { ...scope, isActive: true, clientType: 'active' } }),
      prisma.contract.count({ where: scope.salesRepId ? { salesRepId: scope.salesRepId } : {} }),
      prisma.contract.count({ where: { status: 'pending', ...(scope.salesRepId ? { salesRepId: scope.salesRepId } : {}) } }),
      prisma.contract.count({ where: { status: 'approved', ...(scope.salesRepId ? { salesRepId: scope.salesRepId } : {}) } }),
      prisma.visit.count({
        where: {
          ...(scope.salesRepId ? { salesRepId: scope.salesRepId } : {}),
          visitDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);
    return {
      clients, leads, activeClients, totalContracts,
      pendingContracts, approvedContracts, visitsThisMonth,
    };
  },
};

// ---- Tool declarations for Gemini -------------------------------------------
const toolDeclarations = [
  {
    name: 'search_clients',
    description: 'List or search CLIENTS / COMPANIES / LEADS in the CRM. Returns rows of companies/leads. Use ONLY when the user asks specifically about clients, leads, companies, accounts, شركات, عملاء, محتملين. DO NOT use for visits, contracts, payments, or bookings.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        client_type: { type: SchemaType.STRING, description: 'Filter: active | lead | inactive', enum: ['active', 'lead', 'inactive'] },
        brand: { type: SchemaType.STRING, description: 'Filter by brand the client is interested in', enum: ['muhaidib_serviced', 'awa_hotels', 'grand_plaza'] },
        min_annual_budget: { type: SchemaType.NUMBER, description: 'Minimum annual budget in SAR' },
        city: { type: SchemaType.STRING, description: 'Filter by city or address keyword' },
        not_contacted_days: { type: SchemaType.NUMBER, description: 'Find clients not contacted (no activity) in the last N days' },
        search: { type: SchemaType.STRING, description: 'Free-text search on company name, contact person, phone, email' },
        limit: { type: SchemaType.NUMBER, description: 'Max rows to return (default 25, max 100)' },
      },
    },
  },
  {
    name: 'search_contracts',
    description: 'List or search CONTRACTS / DEALS / AGREEMENTS. Returns rows of signed/pending contracts with their value, dates, and status. Use ONLY when the user mentions contracts, deals, agreements, تجديد, عقود, اتفاقيات. Use expiring_in_days for "expiring soon" / "تنتهي خلال". DO NOT use for clients, visits, payments, or bookings.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: 'pending | sales_approved | credit_approved | contract_approved | approved | rejected' },
        expiring_in_days: { type: SchemaType.NUMBER, description: 'Contracts expiring in the next N days' },
        min_total_value: { type: SchemaType.NUMBER, description: 'Minimum total value in SAR' },
        client_name: { type: SchemaType.STRING, description: 'Partial match on client company name' },
        hotel_name: { type: SchemaType.STRING, description: 'Partial match on hotel name' },
        limit: { type: SchemaType.NUMBER, description: 'Max rows (default 25)' },
      },
    },
  },
  {
    name: 'search_payments',
    description: 'List or search PAYMENTS / COLLECTIONS / RECEIPTS. Returns money received from clients. Use ONLY for payments, collections, دفعات, مدفوعات, تحصيل, إيصالات. Use status="pending" for "awaiting approval" / "بانتظار الموافقة". DO NOT use for clients, contracts, visits, or bookings.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, enum: ['pending', 'approved', 'rejected'] },
        payment_type: { type: SchemaType.STRING, enum: ['cash', 'bank_transfer', 'check', 'online'] },
        min_amount: { type: SchemaType.NUMBER },
        from_date: { type: SchemaType.STRING, description: 'YYYY-MM-DD' },
        to_date: { type: SchemaType.STRING, description: 'YYYY-MM-DD' },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: 'search_visits',
    description: 'List or search VISITS / SALES MEETINGS / CALLS logged by sales reps when they meet with clients. Returns visit log entries. Use ONLY for visits, meetings, calls, زيارات, اجتماعات, مكالمات, متابعات. For "today\'s visits / النهاردة" pass from_date and to_date both = today (YYYY-MM-DD). DO NOT use for clients, contracts, payments, or bookings.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        visit_type: { type: SchemaType.STRING, enum: ['in_person', 'phone', 'online', 'site_visit'] },
        from_date: { type: SchemaType.STRING },
        to_date: { type: SchemaType.STRING },
        client_name: { type: SchemaType.STRING },
        has_followup_due: { type: SchemaType.BOOLEAN, description: 'true to find visits with overdue follow-ups' },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: 'search_bookings',
    description: 'List or search HOTEL BOOKINGS / GUEST RESERVATIONS in Opera. Returns guest stays at hotels with arrival/departure dates. Use ONLY for bookings, reservations, حجوزات. DO NOT use for clients, contracts, visits, or payments.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, enum: ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'] },
        hotel_name: { type: SchemaType.STRING },
        client_name: { type: SchemaType.STRING },
        from_date: { type: SchemaType.STRING, description: 'Arrival from YYYY-MM-DD' },
        to_date: { type: SchemaType.STRING, description: 'Arrival to YYYY-MM-DD' },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: 'get_dashboard_summary',
    description: 'Get OVERVIEW / KPI TOTALS only. Returns counts: total clients, leads, active clients, contracts, pending contracts, approved contracts, visits this month. Use ONLY for general overview questions like "أرقامي", "ملخص", "overview", "dashboard", "totals". DO NOT use when the user asks about a specific entity type (clients/contracts/visits/etc.) — use the dedicated search tool for that.',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
];

// ---- Main handler -----------------------------------------------------------
const ask = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        message: 'AI assistant is not configured. Set GEMINI_API_KEY in .env.',
      });
    }

    const { question, history } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ message: 'question required' });

    const genAI = new GoogleGenerativeAI(apiKey);
    const today = new Date().toISOString().split('T')[0];
    // Arabic Unicode block 0x0600-0x06FF + Arabic Presentation Forms 0xFB50-0xFDFF + 0xFE70-0xFEFF
    const hasArabic = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(question);
    const originalQuestion = question;
    let workingQuestion = question;

    // Two-step: when the question is Arabic, translate to English first so tool
    // selection stays reliable. The final reply is still rendered in Arabic.
    if (hasArabic) {
      try {
        const translator = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const tx = await translator.generateContent(
          `Translate this CRM-related question from Arabic to clear English. Keep names of companies/people unchanged. When the user mentions time periods, translate to explicit number of days (e.g. "أسبوعين" = "14 days", "شهر" = "30 days"). Reply with the English translation only, no explanation.\n\nArabic: "${question}"\nEnglish:`
        );
        const enText = (tx.response.text() || '').trim().replace(/^["']|["']$/g, '');
        if (enText) workingQuestion = `[Original Arabic question: ${question}]\n[English translation: ${enText}]\n\nAnswer the question. Reply in Arabic.`;
      } catch (_) { /* fall back to original */ }
    }

    const systemInstruction = `You are a read-only CRM assistant for Ewaa Hotels. The user is ${req.user.name}. Today is ${today}. Use the available tools to answer data questions about clients/contracts/payments/visits/bookings. Pick the tool whose entity matches the user's question. Reply in Arabic if the user asked in Arabic, otherwise in English.`;

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
      systemInstruction,
      tools: [{ functionDeclarations: toolDeclarations }],
    });

    const chat = model.startChat({
      history: Array.isArray(history) ? history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(h.content || '') }],
      })) : [],
    });

    let response = await chat.sendMessage(workingQuestion);
    const usedTools = [];

    // Tool-execution loop (limit iterations to prevent runaway)
    for (let i = 0; i < 5; i++) {
      const calls = response.response.functionCalls();
      if (!calls || calls.length === 0) break;

      const toolResults = [];
      for (const call of calls) {
        const fn = tools[call.name];
        if (!fn) {
          toolResults.push({ functionResponse: { name: call.name, response: { error: 'Unknown tool' } } });
          continue;
        }
        try {
          const result = await fn(call.args || {}, req.user);
          usedTools.push({ name: call.name, args: call.args });
          toolResults.push({ functionResponse: { name: call.name, response: { result } } });
        } catch (e) {
          toolResults.push({ functionResponse: { name: call.name, response: { error: e.message } } });
        }
      }
      response = await chat.sendMessage(toolResults);
    }

    let text = '';
    try { text = response.response.text(); } catch (_) { /* model returned only tool calls without final text */ }
    if (!text) {
      // Fall back: render a simple summary from the last tool result if any
      const last = usedTools[usedTools.length - 1];
      text = last
        ? `(تم تنفيذ ${last.name})`
        : 'عذراً، لم أتمكن من فهم السؤال. حاول إعادة صياغته.';
    }
    res.json({ answer: trim(text, 4000), toolsUsed: usedTools });
  } catch (err) {
    console.error('AI query error:', err.message);
    res.status(500).json({ message: 'AI query failed', error: err.message });
  }
};

module.exports = { ask };
