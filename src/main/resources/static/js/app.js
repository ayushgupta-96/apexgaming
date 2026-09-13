// Loads the original application controller, then applies the mobile-first
// home/games navigation without changing the existing game logic or APIs.
(function () {
  const core = document.createElement('script');
  core.src = '/js/app-core.js';
  core.onload = function () {
    // app-core registers its initialization on DOMContentLoaded. Because it is
    // loaded dynamically, initialize the same pieces explicitly after loading.
    if (localStorage.getItem('rmg_token') && typeof onLoginSuccess === 'function') {
      onLoginSuccess();
    }
    if (typeof connectWebSocket === 'function') connectWebSocket();
    if (typeof initAviatorCanvas === 'function') initAviatorCanvas();

    const originalSwitchTab = window.switchTab;

    function setActive(tab) {
      document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
    }

    function hideAllContent() {
      document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
      const home = document.getElementById('mobile-home');
      const games = document.getElementById('mobile-games');
      if (home) home.style.display = 'none';
      if (games) games.style.display = 'none';
    }

    function showPage(page) {
      hideAllContent();
      const target = document.getElementById(page === 'home' ? 'mobile-home' : 'mobile-games');
      if (target) target.style.display = 'block';
      setActive(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.switchTab = function (tabId) {
      if (tabId === 'home' || tabId === 'games') {
        showPage(tabId);
        return;
      }

      if (tabId === 'deposit') {
        originalSwitchTab('wallet');
        setActive('deposit');
        return;
      }

      originalSwitchTab(tabId);
      setActive(tabId === 'wallet' ? 'wallet' : tabId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    function setupNavigation() {
      const main = document.querySelector('main.container');
      if (!main || document.getElementById('mobile-home')) return;

      const home = document.createElement('section');
      home.id = 'mobile-home';
      home.className = 'mobile-page mobile-home';
      home.setAttribute('aria-label', 'Home');

      const games = document.createElement('section');
      games.id = 'mobile-games';
      games.className = 'mobile-page mobile-games';
      games.setAttribute('aria-label', 'Games');

      ['.announcement', '.hero-stats', '.promo-panel', '.reward-grid', '.money-actions'].forEach(selector => {
        const element = main.querySelector(selector);
        if (element) home.appendChild(element);
      });

      const gameSummary = main.querySelector('.game-summary-grid');
      if (gameSummary) games.appendChild(gameSummary);

      const oldTabs = main.querySelector('.tabs-header');
      if (oldTabs) oldTabs.remove();

      const firstTab = main.querySelector('.tab-content');
      if (firstTab) {
        main.insertBefore(home, firstTab);
        main.insertBefore(games, firstTab);
      } else {
        main.appendChild(home);
        main.appendChild(games);
      }

      const bottomNav = document.querySelector('.bottom-nav');
      if (bottomNav) {
        bottomNav.innerHTML = `
          <button class="bottom-nav-btn active" onclick="switchTab('home')" data-tab="home" aria-label="Home">
            <span>⌂</span>Home
          </button>
          <button class="bottom-nav-btn" onclick="switchTab('games')" data-tab="games" aria-label="Games">
            <span>G</span>Games
          </button>
          <button class="bottom-nav-btn center-action" onclick="switchTab('deposit')" data-tab="deposit" aria-label="Deposit">
            <span>Rs</span>Deposit
          </button>
          <button class="bottom-nav-btn" onclick="switchTab('wallet')" data-tab="wallet" aria-label="Wallet">
            <span>W</span>Wallet
          </button>
        `;
      }

      const style = document.createElement('style');
      style.textContent = `
        .mobile-page { width: 100%; }
        .mobile-games { display: none; }
        .tabs-header { display: none !important; }
        .bottom-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .bottom-nav-btn { min-width: 0; touch-action: manipulation; }
        @media (max-width: 700px) {
          main.container { padding-bottom: calc(var(--bottom-nav-height) + 32px); }
          .mobile-page { min-height: calc(100vh - var(--bottom-nav-height)); }
          .game-summary-grid { margin-top: 0; }
        }
      `;
      document.head.appendChild(style);

      showPage('home');
    }

    setupNavigation();
  };
  core.onerror = function () {
    console.error('Unable to load the core Apex Gaming controller.');
  };
  document.head.appendChild(core);
})();
