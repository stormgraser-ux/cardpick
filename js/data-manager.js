// DataManager — fetches JSON data, merges with localStorage, exposes API
const DataManager = (() => {
  let _data = null;
  let _transactions = null;
  let _loaded = false;

  // Sanitized defaults (used when Supabase unavailable — no real financial data)
  const DEFAULTS = {
    balances: {
      checking: { amount: 0, asOf: "", label: "Checking" },
      savings: { amount: 0, asOf: "", label: "Savings" },
      brokerage: { amount: 0, asOf: "", label: "Brokerage" },
      pending: []
    },
    monthlyBurn: {
      stormTotal: 0,
      breakdown: {}
    },
    rewards: { unredeemed: [] },
    bills: [],
    gfBoard: {
      month: "",
      obligations: [],
      totalFixed: 0
    },
    caps: {
      bofa_cr_quarterly: { spent: 0, limit: 0, resetNote: "" },
      custom_cash_monthly: { spent: 0, limit: 0, resetNote: "" },
      discover_quarterly: { spent: 0, limit: 0, resetNote: "" },
      amex_bce_yearly: { spent: 0, limit: 0, resetNote: "" }
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
      const [snapshot, txRows] = await Promise.all([
        window.RunwayDB.getLatestSnapshot().catch(() => null),
        window.RunwayDB.getTransactions().catch(() => null)
      ]);
      if (snapshot) _data = snapshot;
      if (txRows) _transactions = { transactions: txRows };
    } catch (e) {
      // Auth failed or offline — use defaults
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
