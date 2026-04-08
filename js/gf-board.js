// GF Board tab — digital whiteboard tracking Angely's obligations + groceries + payments
const GFBoard = (() => {
  function fmt(n) { return '$' + Math.round(Math.abs(n)).toLocaleString(); }

  function render() {
    const box = document.getElementById("board-content");
    box.textContent = '';

    // Auto-archive previous month if we rolled over
    const archived = DataManager.archiveBoardIfNeeded();

    const boardData = DataManager.get('gfBoard');
    const entries = DataManager.getBoardEntries();
    const obligations = boardData ? boardData.obligations : [];
    const fixedTotal = boardData ? boardData.totalFixed : 0;

    // Calculate running balance
    const groceryTotal = (entries.groceries || []).reduce((s, g) => s + g.amount, 0);
    const paymentTotal = (entries.payments || []).reduce((s, p) => s + p.amount, 0);
    const balance = fixedTotal + groceryTotal - paymentTotal;

    // Balance hero
    const header = document.createElement("div");
    header.className = "board-header";
    const balEl = document.createElement("div");
    balEl.className = "board-balance " + (balance > 0 ? "owed" : balance < 0 ? "credit" : "settled");
    balEl.textContent = (balance > 0 ? "" : balance < 0 ? "-" : "") + "$" + Math.abs(Math.round(balance)).toLocaleString();
    const labelEl = document.createElement("div");
    labelEl.className = "board-label";
    labelEl.textContent = balance > 0 ? "Angely owes" : balance < 0 ? "Storm owes" : "Settled up";
    const monthEl = document.createElement("div");
    monthEl.className = "board-month";
    const now = new Date();
    monthEl.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    header.appendChild(balEl);
    header.appendChild(labelEl);
    header.appendChild(monthEl);
    box.appendChild(header);

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "board-actions";

    const grocBtn = document.createElement("div");
    grocBtn.className = "board-btn";
    const grocIcon = document.createElement("span");
    grocIcon.className = "btn-icon";
    grocIcon.textContent = "\uD83D\uDED2";
    grocBtn.appendChild(grocIcon);
    grocBtn.appendChild(document.createTextNode("+ Grocery"));
    grocBtn.addEventListener("click", () => openModal("grocery"));
    actions.appendChild(grocBtn);

    const payBtn = document.createElement("div");
    payBtn.className = "board-btn";
    const payIcon = document.createElement("span");
    payIcon.className = "btn-icon";
    payIcon.textContent = "\uD83D\uDCB5";
    payBtn.appendChild(payIcon);
    payBtn.appendChild(document.createTextNode("+ Payment"));
    payBtn.addEventListener("click", () => openModal("payment"));
    actions.appendChild(payBtn);

    box.appendChild(actions);

    // Fixed obligations
    const fixedSection = document.createElement("div");
    fixedSection.className = "board-section";
    const fixedLabel = document.createElement("div");
    fixedLabel.className = "section-label";
    fixedLabel.textContent = "Fixed Obligations \u2014 " + fmt(fixedTotal);
    fixedSection.appendChild(fixedLabel);

    obligations.forEach(ob => {
      const row = document.createElement("div");
      row.className = "board-row";
      const item = document.createElement("span");
      item.className = "item";
      item.textContent = ob.item;
      const amount = document.createElement("span");
      amount.className = "amount";
      amount.textContent = "$" + ob.amount;
      row.appendChild(item);
      row.appendChild(amount);
      fixedSection.appendChild(row);
    });
    box.appendChild(fixedSection);

    // Groceries
    if (entries.groceries && entries.groceries.length > 0) {
      const grocSection = document.createElement("div");
      grocSection.className = "board-section";
      const grocLabel = document.createElement("div");
      grocLabel.className = "section-label";
      grocLabel.textContent = "Groceries (her half) \u2014 " + fmt(groceryTotal);
      grocSection.appendChild(grocLabel);

      entries.groceries.slice().reverse().forEach((g, i) => {
        const row = document.createElement("div");
        row.className = "board-row";
        const item = document.createElement("span");
        item.className = "item";
        item.textContent = g.date + " \u2022 Receipt $" + (g.receiptTotal || g.amount * 2);
        const amount = document.createElement("span");
        amount.className = "amount";
        amount.textContent = "$" + g.amount;
        row.appendChild(item);
        row.appendChild(amount);

        // Long-press to delete
        let holdTimer;
        row.addEventListener("pointerdown", () => {
          holdTimer = setTimeout(() => {
            if (confirm("Remove this grocery entry?")) {
              const idx = entries.groceries.length - 1 - i;
              entries.groceries.splice(idx, 1);
              DataManager.saveBoardEntries(entries);
              render();
            }
          }, 600);
        });
        row.addEventListener("pointerup", () => clearTimeout(holdTimer));
        row.addEventListener("pointerleave", () => clearTimeout(holdTimer));

        grocSection.appendChild(row);
      });
      box.appendChild(grocSection);
    }

    // Payments
    if (entries.payments && entries.payments.length > 0) {
      const paySection = document.createElement("div");
      paySection.className = "board-section";
      const payLabel = document.createElement("div");
      payLabel.className = "section-label";
      payLabel.textContent = "Payments Received \u2014 " + fmt(paymentTotal);
      paySection.appendChild(payLabel);

      entries.payments.slice().reverse().forEach((p, i) => {
        const row = document.createElement("div");
        row.className = "board-row";
        const item = document.createElement("span");
        item.className = "item";
        item.textContent = p.date + " \u2022 " + (p.method || "Cash");
        const amount = document.createElement("span");
        amount.className = "amount payment";
        amount.textContent = "-$" + p.amount;
        row.appendChild(item);
        row.appendChild(amount);

        let holdTimer;
        row.addEventListener("pointerdown", () => {
          holdTimer = setTimeout(() => {
            if (confirm("Remove this payment entry?")) {
              const idx = entries.payments.length - 1 - i;
              entries.payments.splice(idx, 1);
              DataManager.saveBoardEntries(entries);
              render();
            }
          }, 600);
        });
        row.addEventListener("pointerup", () => clearTimeout(holdTimer));
        row.addEventListener("pointerleave", () => clearTimeout(holdTimer));

        paySection.appendChild(row);
      });
      box.appendChild(paySection);
    }
  }

  function openModal(type) {
    const modal = document.getElementById("board-modal");
    const title = document.getElementById("modal-title");
    const amountInput = document.getElementById("modal-amount");
    const methodField = document.getElementById("modal-method-field");
    const receiptField = document.getElementById("modal-receipt-field");
    const receiptInput = document.getElementById("modal-receipt");
    const confirmBtn = document.getElementById("modal-confirm");

    title.textContent = type === "grocery" ? "Add Grocery Trip" : "Record Payment";
    amountInput.value = '';
    methodField.style.display = type === "payment" ? "block" : "none";
    receiptField.style.display = type === "grocery" ? "block" : "none";
    if (receiptInput) receiptInput.value = '';
    modal.className = "board-modal open";

    // Focus amount after animation
    setTimeout(() => amountInput.focus(), 100);

    const handler = () => {
      const amount = parseFloat(amountInput.value);
      if (!amount || amount <= 0) return;
      const entries = DataManager.getBoardEntries();
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (type === "grocery") {
        const receiptTotal = parseFloat(receiptInput?.value) || amount * 2;
        entries.groceries.push({ date: today, amount: Math.round(receiptTotal / 2 * 100) / 100, receiptTotal: Math.round(receiptTotal) });
      } else {
        const method = document.getElementById("modal-method").value;
        entries.payments.push({ date: today, amount, method });
      }

      DataManager.saveBoardEntries(entries);
      modal.className = "board-modal";
      render();
      confirmBtn.removeEventListener("click", handler);
    };

    confirmBtn.addEventListener("click", handler);
    document.getElementById("modal-cancel").onclick = () => {
      modal.className = "board-modal";
      confirmBtn.removeEventListener("click", handler);
    };
  }

  return { render };
})();
