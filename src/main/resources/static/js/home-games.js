const HOME_GAMES = [
  { name: 'Aviator', type: 'aviator', image: '/images/games/aviator.webp' },
  { name: 'Colour Prediction', type: 'colour', image: '/images/games/colour.svg' },
  { name: 'Ludo', type: 'ludo', image: '/images/games/ludo.svg' },
  { name: 'Mines', type: 'mines', image: '/images/games/mines.svg' },
  { name: 'Fruit 777', type: 'fruit', image: '/images/games/fruit.svg' }
];

function renderHomeGames() {
  const target = document.getElementById('categoryGames');
  if (!target) return;
  target.innerHTML = HOME_GAMES.map(game => `
    <button class="catalog-card ${game.type}" onclick="switchTab('${game.type === 'aviator' ? 'aviator' : game.type === 'colour' ? 'colour' : game.type === 'ludo' ? 'ludo' : 'games'}')">
      <img class="catalog-image" src="${game.image}" alt="${game.name}" loading="eager">
      <b>${game.name}</b>
    </button>
  `).join('');
}

function setupPremiumBottomNav() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;

  nav.innerHTML = `
    <button class="bottom-nav-btn" onclick="switchTab('home')" data-tab="home" aria-label="Home">
      <span>⌂</span><small>Home</small>
    </button>
    <button class="bottom-nav-btn" onclick="switchTab('games')" data-tab="games" aria-label="Games">
      <span>✦</span><small>Games</small>
    </button>
    <button class="bottom-nav-btn center-action play-action" onclick="switchTab('aviator')" data-tab="aviator" aria-label="Play">
      <span>▶</span><small>Play</small>
    </button>
    <button class="bottom-nav-btn" onclick="switchTab('deposit')" data-tab="deposit" aria-label="Deposit">
      <span>₹</span><small>Deposit</small>
    </button>
    <button class="bottom-nav-btn" onclick="switchTab('wallet')" data-tab="wallet" aria-label="Wallet">
      <span>◈</span><small>Wallet</small>
    </button>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  renderHomeGames();
  setupPremiumBottomNav();
});
