const HOME_GAMES = [
  { name: 'Aviator', type: 'aviator', image: '/images/games/aviator.webp' },
  { name: 'Fruit 777', type: 'fruit', image: '/images/games/fruit.webp' },
  { name: 'Ludo', type: 'ludo', image: '/images/games/ludo.webp' },
  { name: 'Colour Prediction', type: 'colour', image: '/images/games/colour.webp' },
  { name: 'Mines', type: 'mines', image: '/images/games/mines.svg' }
];

function renderHomeGames() {
  const target = document.getElementById('categoryGames');
  if (!target) return;
  target.innerHTML = HOME_GAMES.map(game => `
    <button class="catalog-card ${game.type}" onclick="switchTab('${game.type === 'aviator' ? 'aviator' : game.type === 'colour' ? 'colour' : game.type === 'ludo' ? 'ludo' : game.type === 'fruit' ? 'games' : 'games'}')">
      <img class="catalog-image" src="${game.image}" alt="${game.name}" loading="eager" width="333" height="450">
      <b>${game.name}</b>
    </button>
  `).join('');
}

function setupPremiumBottomNav() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;

  nav.innerHTML = `
    <a class="bottom-nav-btn" href="/" data-tab="home" aria-label="Home">
      <span>⌂</span><small>Home</small>
    </a>
    <a class="bottom-nav-btn" href="/#games" onclick="event.preventDefault(); switchTab('games')" data-tab="games" aria-label="Games">
      <span>✦</span><small>Games</small>
    </a>
    <a class="bottom-nav-btn center-action play-action" href="/?play=aviator" data-tab="aviator" aria-label="Play">
      <span>▶</span><small>Play</small>
    </a>
    <a class="bottom-nav-btn" href="/deposit.html" data-tab="deposit" aria-label="Deposit">
      <span>₹</span><small>Deposit</small>
    </a>
    <a class="bottom-nav-btn" href="/wallet.html" data-tab="wallet" aria-label="Wallet">
      <span>◈</span><small>Wallet</small>
    </a>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  renderHomeGames();
  setupPremiumBottomNav();
});
