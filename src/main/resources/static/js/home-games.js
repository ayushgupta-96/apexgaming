const HOME_GAMES = [
  { name: 'Aviator', type: 'aviator', image: '/images/games/aviator.svg' },
  { name: 'Fruit 777', type: 'fruit', image: '/images/games/fruit-777.svg' },
  { name: 'Ludo', type: 'ludo', image: '/images/games/ludo.svg' },
  { name: 'Colour Prediction', type: 'colour', image: '/images/games/colour.svg' },
  { name: 'Mines', type: 'mines', image: '/images/games/mines.svg' }
];

function gameTarget(type) {
  if (type === 'aviator' || type === 'colour' || type === 'ludo') return type;
  return 'games';
}

function renderHomeGames() {
  const target = document.getElementById('categoryGames');
  if (!target) return;

  const fragment = document.createDocumentFragment();

  HOME_GAMES.forEach((game) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-card ' + game.type;
    button.setAttribute('aria-label', 'Open ' + game.name);
    button.addEventListener('click', () => {
      if (typeof switchTab === 'function') switchTab(gameTarget(game.type));
    });

    const image = document.createElement('img');
    image.className = 'catalog-image';
    image.src = game.image;
    image.alt = game.name;
    image.loading = 'lazy';
    image.width = 333;
    image.height = 450;
    image.decoding = 'async';

    const title = document.createElement('b');
    title.textContent = game.name;

    button.append(image, title);
    fragment.appendChild(button);
  });

  target.replaceChildren(fragment);
}

/*
 * The bottom navigation is intentionally left in index.html.
 * Keeping it declarative prevents another script from silently replacing
 * navigation controls and preserves the user's chosen mobile structure.
 */
document.addEventListener('DOMContentLoaded', renderHomeGames);
