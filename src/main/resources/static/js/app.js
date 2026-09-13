// Apex Gaming mobile navigation and page-flow enhancements.
// The original controller is preserved in app-original.js.
(function () {
  const originalScript = document.createElement('script');
  originalScript.src = '/js/app-original.js';
  originalScript.onload = function () {
    const originalSwitchTab = window.switchTab;

    function setVisible(el, visible, display = 'block') {
      if (el) el.style.display = visible ? display : 'none';
    }

    function setBottomActive(tab) {
      document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
    }

    function showPage(page) {
      const home = document.getElementById('tab-home');
      const games = document.getElementById('tab-games');
      const tabContents = document.querySelectorAll('.tab-content');

      tabContents.forEach(el => setVisible(el, false));
      setVisible(home, page === 'home');
      setVisible(games, page === 'games');

      if (page === 'home' || page === 'games') {
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      }

      setBottomActive(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.switchTab = function (tabId) {
      if (tabId === 'home' || tabId === 'games') {
        showPage(tabId);
        return;
      }

      if (tabId === 'deposit') {
        originalSwitchTab('wallet');
        setBottomActive('deposit');
        window.setTimeout(() => {
          const deposit = document.getElementById('depositAmountInput');
          if (deposit) deposit.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        return;
      }

      originalSwitchTab(tabId);
      setBottomActive(tabId === 'wallet' ? 'wallet' : 'games');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    function setupMobileStructure() {
      const main = document.querySelector('main.container');
      if (!main || document.getElementById('tab-home')) return;

      const home = document.createElement('section');
      home.id = 'tab-home';
      home.className = 'page-section page-home';
      home.setAttribute('aria-label', 'Home');

      const games = document.createElement('section');
      games.id = 'tab-games';
      games.className = 'page-section page-games';
      games.setAttribute('aria-label', 'Games');

      const firstTab = main.querySelector('.tab-content');
      const homeSelectors = ['.announcement', '.hero-stats', '.promo-panel', '.reward-grid', '.money-actions'];
      homeSelectors.forEach(selector => {
        const el = main.querySelector(selector);
        if (el) home.appendChild(el);
      });

      const gameSummary = main.querySelector('.game-summary-grid');
      if (gameSummary) games.appendChild(gameSummary);

      const tabsHeader = main.querySelector('.tabs-header');
      if (tabsHeader) tabsHeader.remove();

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
        .page-section { width: 100%; }
        .page-games { display: none; }
        .page-games .game-summary-grid { margin-top: 0; }
        .bottom-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .bottom-nav-btn { min-width: 0; touch-action: manipulation; }
        .bottom-nav-btn span { font-weight: 800; }
        @media (max-width: 700px) {
          main.container { padding-bottom: 110px; }
          .page-home, .page-games { min-height: calc(100vh - 80px); }
        }
      `;
      document.head.appendChild(style);

      showPage('home');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupMobileStructure, { once: true });
    } else {
      setupMobileStructure();
    }
  };
  document.head.appendChild(originalScript);
})();
