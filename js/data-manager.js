// DataManager — fetches JSON data, merges with localStorage, exposes API
const DataManager = (() => {
  let _data = null;
  let _transactions = null;
  let _loaded = false;

  // Hardcoded defaults (used when data.json unavailable)
  const DEFAULTS = {
    balances: {
      checking: { amount: 1472, asOf: "2026-04-06", label: "KeyBank Checking" },
      savings: { amount: 5154, asOf: "2026-04-06", label: "KeyBank Savings" },
      brokerage: { amount: 15000, asOf: "2026-04-06", label: "Tastytrade" },
      pending: [{ label: "Kendall Toyota check", amount: 11800, status: "clearing" }]
    },
    monthlyBurn: {
      stormTotal: 1442,
      breakdown: {
        "Housing": 866, "Groceries": 300, "Claude.AI": 130,
        "EWEB": 69, "Internet": 25, "Chewy": 20,
        "Subscriptions": 20, "Cloudflare": 1
      }
    },
    rewards: {
      unredeemed: [
        { card: "BofA Unlimited", amount: 239.10 },
        { card: "WF Active Cash", amount: 63.15 },
        { card: "Amex BCE", amount: 6.83 },
        { card: "Chase Amazon", points: 5242 },
        { card: "Citi Custom Cash", points: 2782 }
      ]
    },
    bills: [
      { name: "Conservice (Rent + Utils)", total: 1851, stormShare: 866, angelyShare: 986, dueDay: 1, paidVia: "BILT", autopay: true, category: "housing" },
      { name: "EWEB", total: 138, stormShare: 69, angelyShare: 69, dueDay: 15, paidVia: "Citi Double Cash", autopay: false, category: "utilities" },
      { name: "Quantum Fiber", total: 50, stormShare: 25, angelyShare: 25, dueDay: 20, paidVia: "KeyBank autopay", autopay: true, category: "utilities" },
      { name: "Claude.AI", total: 130, stormShare: 130, angelyShare: 0, dueDay: null, paidVia: "Amex BCE", autopay: true, category: "software" },
      { name: "Chewy (Mojo)", total: 66, stormShare: 20, angelyShare: 46, dueDay: null, paidVia: "Amex BCE", autopay: true, category: "pet" },
      { name: "Cloudflare", total: 1, stormShare: 1, angelyShare: 0, dueDay: null, paidVia: "Amex BCE", autopay: true, category: "software" }
    ],
    gfBoard: {
      month: "2026-04",
      obligations: [
        { item: "Rent (half)", amount: 838 },
        { item: "Garage", amount: 120 },
        { item: "Utilities (half)", amount: 28 },
        { item: "Internet (half)", amount: 25 },
        { item: "EWEB (half)", amount: 67 },
        { item: "Cat food (2wk)", amount: 30 }
      ],
      totalFixed: 1108
    },
    caps: {
      bofa_cr_quarterly: { spent: 790, limit: 2500, resetNote: "Resets Jan 1, Apr 1, Jul 1, Oct 1" },
      custom_cash_monthly: { spent: 0, limit: 500, resetNote: "Resets each billing cycle" },
      discover_quarterly: { spent: 0, limit: 1500, resetNote: "Resets each quarter. ACTIVATE at discover.com!" },
      amex_bce_yearly: { spent: 800, limit: 6000, resetNote: "Resets annually" }
    },
    digest: null
  };

  async function load() {
    if (_loaded) return;
    await _fetch();
    _loaded = true;
  }

  async function reload() {
    await _fetch();
  }

  async function _fetch() {
    try {
      const [dataRes, txRes] = await Promise.all([
        fetch('data/data.json', { cache: 'no-cache' }).catch(() => null),
        fetch('data/transactions.json', { cache: 'no-cache' }).catch(() => null)
      ]);
      if (dataRes && dataRes.ok) _data = await dataRes.json();
      if (txRes && txRes.ok) _transactions = await txRes.json();
    } catch (e) {
      // Offline or files missing — use defaults
    }
  }

  function get(key) {
    if (_data && _data[key] !== undefined) return _data[key];
    return DEFAULTS[key] || null;
  }

  function getTransactions() {
    return _transactions ? _transactions.transactions || [] : [];
  }

  function getMeta() {
    return _data ? _data.meta : null;
  }

  function getBalances() {
    const b = get('balances');
    const liquid = (b.checking?.amount || 0) + (b.savings?.amount || 0) + (b.brokerage?.amount || 0);
    const pendingTotal = (b.pending || []).reduce((s, p) => s + (p.amount || 0), 0);
    return { ...b, liquid, pendingTotal, totalWithPending: liquid + pendingTotal };
  }

  function getRunway() {
    const bal = getBalances();
    const burn = get('monthlyBurn');
    if (!burn || !burn.stormTotal) return { months: 0, liquid: bal.liquid, burn: 0 };
    return {
      months: Math.floor(bal.totalWithPending / burn.stormTotal),
      liquid: bal.liquid,
      pending: bal.pendingTotal,
      total: bal.totalWithPending,
      burn: burn.stormTotal
    };
  }

  function getCapSpend(id) {
    // localStorage override takes priority
    const local = localStorage.getItem("cap_" + id);
    if (local !== null) return parseFloat(local);
    const caps = get('caps');
    return caps && caps[id] ? caps[id].spent : 0;
  }

  function setCapSpend(id, v) {
    localStorage.setItem("cap_" + id, v.toString());
  }

  // GF Board localStorage
  function getBoardKey() {
    const d = new Date();
    return `gf_board_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function getBoardEntries() {
    return JSON.parse(localStorage.getItem(getBoardKey()) || '{"groceries":[],"payments":[]}');
  }

  function saveBoardEntries(entries) {
    localStorage.setItem(getBoardKey(), JSON.stringify(entries));
  }

  function isStale() {
    const meta = getMeta();
    if (!meta || !meta.generated) return true;
    const age = (Date.now() - new Date(meta.generated).getTime()) / (1000 * 60 * 60 * 24);
    return age > 8;
  }

  // Archive previous month's board and return fresh entries
  function archiveBoardIfNeeded() {
    const currentKey = getBoardKey();
    const stored = localStorage.getItem(currentKey);
    if (stored) return false; // Current month exists, no archive needed

    // Find previous month's key to check if there's data to archive
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const prevKey = `gf_board_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const prevData = localStorage.getItem(prevKey);

    if (prevData) {
      // Archive exists from previous month — mark it with a flag
      const parsed = JSON.parse(prevData);
      parsed._archived = true;
      localStorage.setItem(prevKey, JSON.stringify(parsed));
    }

    // Initialize fresh month
    localStorage.setItem(currentKey, JSON.stringify({ groceries: [], payments: [] }));
    return true;
  }

  return {
    load, reload, get, getMeta, getBalances, getRunway,
    getTransactions, getCapSpend, setCapSpend,
    getBoardEntries, saveBoardEntries, getBoardKey,
    isStale, archiveBoardIfNeeded,
    DEFAULTS
  };
})();
