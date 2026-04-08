// App — router, tab switching, pull-to-refresh, SW updates, stale badge
const App = (() => {
  const TAB_MAP = {
    pick:      { render: () => Pick.render() },
    dashboard: { render: () => Dashboard.render() },
    caps:      { render: () => Caps.render() },
    bills:     { render: () => Bills.render() },
    board:     { render: () => GFBoard.render() },
    cards:     { render: () => Cards.render() },
    digest:    { render: () => Digest.render() },
  };

  let activeTab = 'dashboard';

  function switchTab(tabId) {
    if (!TAB_MAP[tabId]) return;
    activeTab = tabId;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + tabId);
    if (page) page.classList.add('active');

    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    const navBtn = document.querySelector('.nav button[data-page="' + tabId + '"]');
    if (navBtn) navBtn.classList.add('active');

    document.querySelectorAll('.overflow-menu button').forEach(b => b.classList.remove('active'));
    const overBtn = document.querySelector('.overflow-menu button[data-page="' + tabId + '"]');
    if (overBtn) overBtn.classList.add('active');

    const menu = document.querySelector('.overflow-menu');
    if (menu) menu.classList.remove('open');

    TAB_MAP[tabId].render();
  }

  function getActiveTab() { return activeTab; }

  // ── Pull-to-refresh ──
  function initPullToRefresh() {
    let startY = 0;
    let pulling = false;
    const threshold = 80;
    const indicator = document.getElementById('pull-indicator');

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 10 && dy < threshold * 2) {
        indicator.style.transform = 'translateY(' + Math.min(dy * 0.4, 40) + 'px)';
        indicator.style.opacity = Math.min(dy / threshold, 1);
      }
    }, { passive: true });

    document.addEventListener('touchend', async () => {
      if (!pulling) return;
      pulling = false;
      const opacity = parseFloat(indicator.style.opacity) || 0;
      indicator.style.transform = '';
      indicator.style.opacity = '0';

      if (opacity >= 0.9) {
        indicator.textContent = 'Refreshing...';
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateY(30px)';
        await DataManager.reload();
        updateStaleBadge();
        if (TAB_MAP[activeTab]) TAB_MAP[activeTab].render();
        setTimeout(() => {
          indicator.textContent = 'Pull to refresh';
          indicator.style.opacity = '0';
          indicator.style.transform = '';
        }, 600);
      }
    });
  }

  // ── Stale data badge ──
  function updateStaleBadge() {
    const dashBtn = document.querySelector('.nav button[data-page="dashboard"]');
    if (!dashBtn) return;
    const existing = dashBtn.querySelector('.stale-dot');
    if (DataManager.isStale()) {
      if (!existing) {
        const dot = document.createElement('span');
        dot.className = 'stale-dot';
        dashBtn.style.position = 'relative';
        dashBtn.appendChild(dot);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  // ── SW update banner ──
  function initSWUpdate() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    });
  }

  function showUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) banner.classList.add('visible');
  }

  async function init() {
    await DataManager.load();

    // Nav buttons
    document.querySelectorAll('.nav > button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.page));
    });

    // Overflow
    const overflowBtn = document.getElementById('overflow-toggle');
    const overflowMenu = document.getElementById('overflow-menu');
    if (overflowBtn && overflowMenu) {
      overflowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overflowMenu.classList.toggle('open');
      });
      document.addEventListener('click', () => overflowMenu.classList.remove('open'));
      overflowMenu.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.page));
      });
    }

    // Update banner dismiss
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => window.location.reload());
    }

    // Init features
    initPullToRefresh();
    initSWUpdate();
    updateStaleBadge();

    switchTab('dashboard');
  }

  return { init, switchTab, getActiveTab, updateStaleBadge };
})();

document.addEventListener('DOMContentLoaded', App.init);
