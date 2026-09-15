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

document.addEventListener('DOMContentLoaded', renderHomeGames);
