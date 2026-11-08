(() => {
  const HOME_GAMES = [
    { name: "Aviator", type: "aviator", category: "crash", description: "Crash game", image: "/images/games/aviator.svg", available: true },
    { name: "Colour Prediction", type: "colour", category: "prediction", description: "Predict & win", image: "/images/games/colour.svg", available: true },
    { name: "Ludo", type: "ludo", category: "board", description: "Classic board game", image: "/images/games/ludo.svg", available: true },
    { name: "Mines", type: "mines", category: "other", description: "Find the safe tiles", image: "/images/games/mines.svg", available: false },
    { name: "Fruit 777", type: "fruit", category: "other", description: "Fruit slots", image: "/images/games/fruit-777.svg", available: false }
  ];

  const CATEGORY_LABELS = [
    ["all", "All"], ["crash", "Crash"], ["prediction", "Prediction"],
    ["board", "Board"], ["other", "Other"]
  ];

  function gameTarget(type) {
    return ["aviator", "colour", "ludo"].includes(type) ? type : null;
  }

  function createGameCard(game, compact) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "home-game-card" + (compact ? " home-game-card-compact" : "");
    card.disabled = !game.available;
    card.setAttribute("aria-label", game.available ? "Play " + game.name : game.name + ", coming soon");

    const art = document.createElement("span");
    art.className = "home-game-art home-game-art-" + game.type;
    const image = document.createElement("img");
    image.src = game.image;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    art.appendChild(image);

    const content = document.createElement("span");
    content.className = "home-game-content";
    const title = document.createElement("strong");
    title.textContent = game.name;
    const description = document.createElement("small");
    description.textContent = game.description;
    const action = document.createElement("span");
    action.className = game.available ? "home-game-action" : "home-game-coming";
    action.textContent = game.available ? "Play now  →" : "Coming soon";
    content.append(title, description, action);
    card.append(art, content);

    if (game.available) {
      card.addEventListener("click", () => {
        const target = gameTarget(game.type);
        if (target && typeof window.switchTab === "function") window.switchTab(target);
      });
    }
    return card;
  }

  function renderCards(grid, games, compact) {
    if (!grid) return;
    const fragment = document.createDocumentFragment();
    games.forEach(game => fragment.appendChild(createGameCard(game, compact)));
    grid.replaceChildren(fragment);
  }

  function initHomeGames() {
    const homeGrid = document.getElementById("categoryGames");
    const catalogueGrid = document.getElementById("gamesCatalogGrid");
    renderCards(homeGrid, HOME_GAMES, true);
    renderCards(catalogueGrid, HOME_GAMES, false);

    document.querySelectorAll("[data-game-category]").forEach(button => {
      button.addEventListener("click", () => {
        const category = button.dataset.gameCategory;
        document.querySelectorAll("[data-game-category]").forEach(item => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        const filtered = category === "all" ? HOME_GAMES : HOME_GAMES.filter(game => game.category === category);
        renderCards(homeGrid, filtered, true);
        renderCards(catalogueGrid, filtered, false);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initHomeGames);
})();
