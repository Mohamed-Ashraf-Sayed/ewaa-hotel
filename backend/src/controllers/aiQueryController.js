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
    description: 'Search clients (companies) in the CRM. Use this when the user asks for clients, leads, accounts, شركات, عملاء, محتملين.',
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
    description: 'Search contracts. Use for queries about contracts, deals, agreements, عقود, اتفاقيات.',
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
    description: 'Search payments / collections. Use for دفعات, تحصيل, مدفوعات, payments, collections.',
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
    description: 'Search visits/calls/meetings logged by sales reps. Use for زيارات, اجتماعات, متابعات, visits, meetings.',
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
    description: 'Search hotel bookings (Opera reservations). Use for حجوزات, bookings, reservations.',
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
    description: 'Get high-level totals: how many clients/leads/contracts/visits the user has. Use for "كم عميل عندي", "ايه أرقامي", "give me the totals".',
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
    const systemInstruction = `You are a helpful assistant for the Ewaa Hotels CRM. The current user is "${req.user.name}" with role "${req.user.role}". Today's date is ${today}.

Rules:
- Use the provided tools to answer questions about clients, contracts, payments, visits, and bookings.
- Always respond in the same language as the question (Arabic, English, or mixed).
- When you return rows, summarize concisely — don't dump raw JSON. Mention key facts: company name, key numbers, status.
- If a query is ambiguous, ask one clarifying question.
- Format currency amounts with " SAR" suffix and use thousand separators.
- Format dates as DD MMM YYYY.
- If the user asks for something the tools cannot do (e.g., create/update data), politely say it's read-only and suggest the right CRM page.`;

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      systemInstruction,
      tools: [{ functionDeclarations: toolDeclarations }],
    });

    const chat = model.startChat({
      history: Array.isArray(history) ? history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(h.content || '') }],
      })) : [],
    });

    let response = await chat.sendMessage(question);
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

    const text = response.response.text();
    res.json({ answer: trim(text, 4000), toolsUsed: usedTools });
  } catch (err) {
    console.error('AI query error:', err.message);
    res.status(500).json({ message: 'AI query failed', error: err.message });
  }
};

module.exports = { ask };
