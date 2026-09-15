// Lightweight animated game-card effects.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.catalog-card').forEach(card => {
    card.classList.add('game-card-live');
  });

  const homeGame = document.getElementById('mobile-game-home');
  if (homeGame) homeGame.classList.add('games-visible');
});
