// Dashboard tab — balances, burn rate, runway gauge, rewards
const Dashboard = (() => {
  function $(id) { return document.getElementById(id); }

  function fmt(n) {
    return '$' + Math.round(n).toLocaleString();
  }

  function render() {
    const box = $("dashboard-content");
    box.textContent = '';

    const runway = DataManager.getRunway();
    const balances = DataManager.getBalances();
    const burn = DataManager.get('monthlyBurn');
    const rewards = DataManager.get('rewards');
    const meta = DataManager.getMeta();

    // Runway hero
    const hero = document.createElement("div");
    hero.className = "dash-hero";
    const months = document.createElement("div");
    months.className = "runway-months";
    months.textContent = runway.months;
    const label = document.createElement("div");
    label.className = "runway-label";
    label.textContent = "months of runway";
    const calc = document.createElement("div");
    calc.className = "runway-calc";
    calc.textContent = fmt(runway.total) + " liquid \u00F7 " + fmt(runway.burn) + "/mo burn";
    hero.appendChild(months);
    hero.appendChild(label);
    hero.appendChild(calc);
    box.appendChild(hero);

    // Balance cards — 2x2 grid
    const row1 = document.createElement("div");
    row1.className = "dash-row";

    const addStat = (parent, lbl, val, sub, full) => {
      const s = document.createElement("div");
      s.className = "dash-stat" + (full ? " full" : "");
      const l = document.createElement("div");
      l.className = "stat-label";
      l.textContent = lbl;
      const v = document.createElement("div");
      v.className = "stat-value";
      v.textContent = val;
      s.appendChild(l);
      s.appendChild(v);
      if (sub) {
        const sb = document.createElement("div");
        sb.className = "stat-sub";
        sb.textContent = sub;
        s.appendChild(sb);
      }
      parent.appendChild(s);
      return s;
    };

    addStat(row1, "Checking", fmt(balances.checking?.amount || 0), balances.checking?.label);
    addStat(row1, "Savings", fmt(balances.savings?.amount || 0), balances.savings?.label);
    box.appendChild(row1);

    const row2 = document.createElement("div");
    row2.className = "dash-row";
    addStat(row2, "Brokerage", fmt(balances.brokerage?.amount || 0), balances.brokerage?.label);

    if (balances.pending && balances.pending.length > 0) {
      const p = balances.pending[0];
      addStat(row2, "Pending", fmt(p.amount), p.label + " \u2022 " + p.status);
    } else {
      addStat(row2, "Pending", "$0", "None");
    }
    box.appendChild(row2);

    // Net liquid total
    const row3 = document.createElement("div");
    row3.className = "dash-row";
    addStat(row3, "Total Liquid", fmt(balances.totalWithPending), "All accounts + pending", true);
    box.appendChild(row3);

    // Monthly burn breakdown
    if (burn && burn.breakdown) {
      const burnCard = document.createElement("div");
      burnCard.className = "dash-stat full";
      burnCard.style.marginBottom = "10px";
      const burnLabel = document.createElement("div");
      burnLabel.className = "stat-label";
      burnLabel.textContent = "Monthly Burn \u2014 " + fmt(burn.stormTotal) + "/mo";
      burnCard.appendChild(burnLabel);

      Object.entries(burn.breakdown).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
        const row = document.createElement("div");
        row.className = "burn-row";
        const catSpan = document.createElement("span");
        catSpan.className = "burn-cat";
        catSpan.textContent = cat;
        const amtSpan = document.createElement("span");
        amtSpan.className = "burn-amt";
        amtSpan.textContent = fmt(amt);
        row.appendChild(catSpan);
        row.appendChild(amtSpan);
        burnCard.appendChild(row);
      });
      box.appendChild(burnCard);
    }

    // Unredeemed rewards
    if (rewards && rewards.unredeemed && rewards.unredeemed.length > 0) {
      const rwCard = document.createElement("div");
      rwCard.className = "dash-stat full";
      const totalCash = rewards.unredeemed
        .filter(r => r.amount)
        .reduce((s, r) => s + r.amount, 0);
      const rwLabel = document.createElement("div");
      rwLabel.className = "stat-label";
      rwLabel.textContent = "Unredeemed Rewards \u2014 " + fmt(totalCash) + " cash";
      rwCard.appendChild(rwLabel);

      rewards.unredeemed.forEach(r => {
        const row = document.createElement("div");
        row.className = "rewards-row";
        const cardName = document.createElement("span");
        cardName.className = "rw-card";
        cardName.textContent = r.card;
        const amtSpan = document.createElement("span");
        amtSpan.className = "rw-amt";
        amtSpan.textContent = r.amount ? "$" + r.amount.toFixed(2) : r.points.toLocaleString() + " pts";
        row.appendChild(cardName);
        row.appendChild(amtSpan);
        rwCard.appendChild(row);
      });
      box.appendChild(rwCard);
    }

    // Recent transactions
    const txns = DataManager.getTransactions();
    if (txns.length > 0) {
      const txCard = document.createElement("div");
      txCard.className = "dash-stat full";
      const txLabel = document.createElement("div");
      txLabel.className = "stat-label";
      txLabel.textContent = "Recent Transactions \u2014 " + txns.length + " this month";
      txCard.appendChild(txLabel);

      txns.slice(-10).reverse().forEach(tx => {
        const row = document.createElement("div");
        row.className = "burn-row";
        const left = document.createElement("span");
        left.className = "burn-cat";
        left.textContent = tx.merchant + " \u2022 " + tx.card;
        const right = document.createElement("span");
        right.className = "burn-amt";
        right.style.color = '#f87171';
        right.textContent = "-$" + (tx.amount || 0).toFixed(2);
        row.appendChild(left);
        row.appendChild(right);
        txCard.appendChild(row);
      });

      if (txns.length > 10) {
        const more = document.createElement("div");
        more.className = "freshness";
        more.textContent = "+" + (txns.length - 10) + " more";
        txCard.appendChild(more);
      }
      box.appendChild(txCard);
    }

    // Freshness indicator
    const fresh = document.createElement("div");
    fresh.className = "freshness";
    if (meta && meta.generated) {
      const gen = new Date(meta.generated);
      const age = Math.floor((Date.now() - gen.getTime()) / (1000 * 60 * 60 * 24));
      fresh.textContent = "Last updated: " + gen.toLocaleDateString() + (age > 7 ? " \u2022 Data may be stale" : "");
      if (age > 7) fresh.className += " stale";
    } else {
      fresh.textContent = "Using default data \u2022 Connect weekly digest to update automatically";
      fresh.className += " stale";
    }
    box.appendChild(fresh);
  }

  return { render };
})();
