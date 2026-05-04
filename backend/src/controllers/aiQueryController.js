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

  get_my_targets: async (args, user) => {
    const where = { userId: user.id };
    const yearNow = new Date().getFullYear();
    const monthNow = new Date().getMonth() + 1;
    if (args.year) where.year = Number(args.year);
    else where.year = yearNow;
    if (args.period === 'monthly' && !args.month) where.month = monthNow;
    if (args.period) where.period = args.period;

    const targets = await prisma.salesTarget.findMany({
      where, orderBy: [{ year: 'desc' }, { month: 'desc' }, { quarter: 'desc' }],
      include: { setBy: { select: { name: true } } },
    });
    if (targets.length === 0) {
      return { count: 0, message: `No targets set for user ${user.name} for ${where.year}` };
    }
    // Compute progress for the most recent target
    const t = targets[0];
    const start = t.period === 'monthly'
      ? new Date(t.year, (t.month || 1) - 1, 1)
      : new Date(t.year, ((t.quarter || 1) - 1) * 3, 1);
    const end = t.period === 'monthly'
      ? new Date(t.year, t.month || 1, 0, 23, 59, 59)
      : new Date(t.year, (t.quarter || 1) * 3, 0, 23, 59, 59);
    const [contractsActual, visitsActual, revenueAgg, clientsActual] = await Promise.all([
      prisma.contract.count({ where: { salesRepId: user.id, createdAt: { gte: start, lte: end }, status: 'approved' } }),
      prisma.visit.count({ where: { salesRepId: user.id, visitDate: { gte: start, lte: end } } }),
      prisma.contract.aggregate({ where: { salesRepId: user.id, createdAt: { gte: start, lte: end }, status: 'approved' }, _sum: { totalValue: true } }),
      prisma.client.count({ where: { salesRepId: user.id, createdAt: { gte: start, lte: end } } }),
    ]);
    return {
      count: targets.length,
      currentTarget: {
        period: t.period, year: t.year, month: t.month, quarter: t.quarter,
        targetContracts: t.targetContracts, actualContracts: contractsActual,
        targetVisits: t.targetVisits, actualVisits: visitsActual,
        targetRevenue: t.targetRevenue, actualRevenue: revenueAgg._sum.totalValue || 0,
        targetClients: t.targetClients, actualClients: clientsActual,
        setBy: t.setBy?.name,
      },
      allTargets: targets,
    };
  },

  get_my_tasks: async (args, user) => {
    const where = { assigneeId: user.id };
    if (args.status) where.status = args.status;
    else where.status = { not: 'completed' }; // default: open tasks
    if (args.priority) where.priority = args.priority;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: Math.min(Number(args.limit) || 25, 100),
      select: {
        id: true, title: true, taskType: true, priority: true, status: true, dueDate: true,
        client: { select: { id: true, companyName: true } },
        createdBy: { select: { name: true } },
      },
    });
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;
    return { count: tasks.length, overdue, items: tasks };
  },

  get_my_reminders: async (args, user) => {
    const where = { userId: user.id, isCompleted: false };
    if (args.from_date) where.reminderDate = { ...(where.reminderDate || {}), gte: new Date(args.from_date) };
    if (args.to_date) where.reminderDate = { ...(where.reminderDate || {}), lte: new Date(`${args.to_date}T23:59:59`) };
    if (!args.from_date && !args.to_date) {
      // Default: next 7 days
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const week = new Date(); week.setDate(today.getDate() + 7); week.setHours(23, 59, 59);
      where.reminderDate = { gte: today, lte: week };
    }
    const reminders = await prisma.reminder.findMany({
      where, orderBy: { reminderDate: 'asc' },
      take: Math.min(Number(args.limit) || 25, 100),
      select: {
        id: true, title: true, description: true, reminderDate: true, reminderTime: true, type: true,
        client: { select: { id: true, companyName: true } },
      },
    });
    return { count: reminders.length, items: reminders };
  },

  get_my_commission: async (args, user) => {
    // Pull user with commission rate
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { commissionRate: true, name: true } });
    const rate = u?.commissionRate || 0;
    const yearNow = new Date().getFullYear();
    const monthNow = new Date().getMonth();
    let from, to, label;
    if (args.period === 'this_year' || args.year) {
      const y = Number(args.year) || yearNow;
      from = new Date(y, 0, 1); to = new Date(y, 11, 31, 23, 59, 59);
      label = `${y}`;
    } else if (args.period === 'last_month') {
      from = new Date(yearNow, monthNow - 1, 1);
      to = new Date(yearNow, monthNow, 0, 23, 59, 59);
      label = from.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } else {
      // default: this month
      from = new Date(yearNow, monthNow, 1);
      to = new Date(yearNow, monthNow + 1, 0, 23, 59, 59);
      label = from.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }
    // Sum approved payments on contracts owned by this rep within period
    const payments = await prisma.payment.findMany({
      where: {
        status: 'approved',
        paymentDate: { gte: from, lte: to },
        contract: { salesRepId: user.id },
      },
      select: { amount: true },
    });
    const collectedTotal = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const commissionEarned = Math.round((collectedTotal * rate) / 100 * 100) / 100;
    // Pending = approved-contract collectedAmount NOT yet covered + open contracts not approved
    return {
      period: label,
      commissionRate: rate,
      collectedAmount: collectedTotal,
      commissionEarned,
      paymentsCount: payments.length,
    };
  },

  search_users: async (args, user) => {
    // Access scope: admins/GM/VGM see all; sales_director sees their team; others restricted
    if (!ADMIN_ROLES.includes(user.role) && user.role !== 'sales_director') {
      return { count: 0, message: 'You do not have permission to list users.' };
    }
    const where = { isActive: true };
    if (user.role === 'sales_director') {
      const subs = await getSubordinateIds(user.id);
      where.id = { in: [user.id, ...subs] };
    }
    if (args.role) where.role = args.role;
    if (args.search) {
      where.OR = [
        { name: { contains: args.search } },
        { email: { contains: args.search } },
        { phone: { contains: args.search } },
      ];
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      take: Math.min(Number(args.limit) || 50, 200),
      select: {
        id: true, name: true, email: true, phone: true, role: true, commissionRate: true,
        manager: { select: { name: true } },
        hotels: { select: { hotel: { select: { name: true, group: true } } } },
        _count: { select: { assignedClients: true, contracts: true, visits: true } },
      },
    });
    return { count: users.length, items: users };
  },

  get_team_overview: async (args, user) => {
    if (!ADMIN_ROLES.includes(user.role) && user.role !== 'sales_director') {
      return { count: 0, message: 'You do not have permission to view team overview.' };
    }
    const teamWhere = { isActive: true, role: { in: ['sales_rep', 'sales_director', 'assistant_sales'] } };
    if (user.role === 'sales_director') {
      const subs = await getSubordinateIds(user.id);
      teamWhere.id = { in: [user.id, ...subs] };
    }
    const team = await prisma.user.findMany({
      where: teamWhere,
      orderBy: { name: 'asc' },
      take: Math.min(Number(args.limit) || 50, 200),
      select: {
        id: true, name: true, role: true, commissionRate: true,
        _count: { select: { assignedClients: true, contracts: true, visits: true } },
      },
    });
    return { count: team.length, items: team };
  },

  get_my_performance: async (_args, user) => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay()); weekStart.setHours(0, 0, 0, 0);
    const [
      myClients, myActiveClients, myLeads, myContracts, myApprovedContracts,
      myVisitsTotal, myVisitsThisMonth, myVisitsThisWeek,
    ] = await Promise.all([
      prisma.client.count({ where: { salesRepId: user.id, isActive: true } }),
      prisma.client.count({ where: { salesRepId: user.id, isActive: true, clientType: 'active' } }),
      prisma.client.count({ where: { salesRepId: user.id, isActive: true, clientType: 'lead' } }),
      prisma.contract.count({ where: { salesRepId: user.id } }),
      prisma.contract.count({ where: { salesRepId: user.id, status: 'approved' } }),
      prisma.visit.count({ where: { salesRepId: user.id } }),
      prisma.visit.count({ where: { salesRepId: user.id, visitDate: { gte: monthStart } } }),
      prisma.visit.count({ where: { salesRepId: user.id, visitDate: { gte: weekStart } } }),
    ]);
    return {
      myClients, myActiveClients, myLeads,
      myContracts, myApprovedContracts,
      myVisitsTotal, myVisitsThisMonth, myVisitsThisWeek,
    };
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
  {
    name: 'get_my_targets',
    description: 'Get the LOGGED-IN USER\'S sales targets (تارجت / هدف / target / quota) and how much they achieved so far. Use for questions like "ايه التارجت بتاعي؟", "كم وصلت من هدفي؟", "my targets".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        period: { type: SchemaType.STRING, enum: ['monthly', 'quarterly'], description: 'monthly or quarterly' },
        year: { type: SchemaType.NUMBER },
        month: { type: SchemaType.NUMBER, description: '1-12' },
      },
    },
  },
  {
    name: 'get_my_tasks',
    description: 'Get the LOGGED-IN USER\'S assigned tasks (مهام / tasks / to-do). Use for "ايه المهام عندي؟", "tasks I have", "ايه اللي علي".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, enum: ['new', 'in_progress', 'completed'], description: 'default: open tasks (not completed)' },
        priority: { type: SchemaType.STRING, enum: ['urgent', 'normal'] },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: 'get_my_reminders',
    description: 'Get the LOGGED-IN USER\'S calendar reminders (تذكيرات / reminders). Defaults to next 7 days. Use for "ايه التذكيرات عندي؟", "my reminders this week".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        from_date: { type: SchemaType.STRING, description: 'YYYY-MM-DD' },
        to_date: { type: SchemaType.STRING, description: 'YYYY-MM-DD' },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: 'get_my_commission',
    description: 'Calculate the LOGGED-IN USER\'S commission earned (عمولة / commission). Defaults to current month. Use for "كم عمولتي؟", "commission this month", "earnings".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        period: { type: SchemaType.STRING, enum: ['this_month', 'last_month', 'this_year'] },
        year: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: 'get_my_performance',
    description: 'Get the LOGGED-IN USER\'S personal stats: # of clients/leads/contracts/visits assigned to them. Use for "أدائي", "أرقامي الشخصية", "my personal stats", "كم عميل عندي؟".',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'search_users',
    description: 'List EMPLOYEES / USERS / TEAM MEMBERS (موظفين / فريق / السيلز / المناديب). Returns names, roles, contact info, and basic counts. Use for "قولي مين السيلز", "اعرض الموظفين", "show me the team", "list sales reps". Admins see all; sales directors see their team only.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        role: { type: SchemaType.STRING, description: 'Filter by role', enum: ['admin', 'general_manager', 'vice_gm', 'sales_director', 'assistant_sales', 'sales_rep', 'contract_officer', 'reservations', 'credit_manager', 'credit_officer'] },
        search: { type: SchemaType.STRING, description: 'Free-text search on name, email, phone' },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: 'get_team_overview',
    description: 'Get the SALES TEAM with each member\'s clients/contracts/visits counts (أداء الفريق / team performance). Returns aggregated counts per member. Use for "أداء فريقي", "team leaderboard", "اعرض السيلز وأرقامهم".',
    parameters: { type: SchemaType.OBJECT, properties: { limit: { type: SchemaType.NUMBER } } },
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

    const nowFmt = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Riyadh' });
    const systemInstruction = `You are a friendly Arabic-speaking assistant for Ewaa Hotels CRM. The user is ${req.user.name}. Today's date is ${today}. Current Riyadh time: ${nowFmt}.

For CRM data questions (clients, contracts, payments, visits, bookings), use the available tools. Pick the tool whose entity matches the question.

For non-CRM questions (time, general knowledge, casual chat, greetings), reply naturally using your own knowledge — DO NOT decline. The current time and date are above; use them when the user asks.

CRITICAL OUTPUT RULES:
- Reply ONLY with the final user-facing message. NEVER include your reasoning, thoughts, tool descriptions, or phrases like "I used the tool" / "The tool returned" / "I will inform the user".
- Reply in Arabic if the user wrote in Arabic, otherwise English.
- Be concise — 1-3 sentences plus a short list when listing rows.
- For "0 results" cases, say so plainly in one line.
- Format money "X,XXX ر.س". Format dates DD/MM/YYYY.
- Read-only: politely refuse to create/update/delete data.`;

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
