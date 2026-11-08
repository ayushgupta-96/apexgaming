(() => {
  const HOME_GAMES = [
    { name: "Aviator", type: "aviator", category: "crash", description: "Crash game", image: "/images/games/aviator.svg", available: true },
    { name: "Colour Prediction", type: "colour", category: "prediction", description: "Predict & win", image: "/images/games/colour.svg", available: true },
    { name: "Ludo", type: "ludo", category: "board", description: "Classic board game", image: "/images/games/ludo.svg", available: true },
    { name: "Mines", type: "mines", category: "other", description: "Find the safe tiles", image: "/images/games/mines.svg", available: false },
    { name: "Fruit 777", type: "fruit", category: "other", description: "Fruit slots", image: "/images/games/fruit-777.svg", available: false }
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

  function createEmptyState(grid, emptyState, isEmpty) {
    if (emptyState) emptyState.hidden = !isEmpty;
    if (grid) grid.hidden = isEmpty;
  }

  function renderCards(grid, games, compact, emptyState) {
    if (!grid) return;
    const fragment = document.createDocumentFragment();
    games.forEach(game => fragment.appendChild(createGameCard(game, compact)));
    grid.replaceChildren(fragment);
    createEmptyState(grid, emptyState, games.length === 0);
    return games.length;
  }

  function updateCatalogueCount(count) {
    const output = document.getElementById("catalogueGameCount");
    if (output) output.textContent = count + (count === 1 ? " GAME" : " GAMES");
  }

  function bindCategoryFilters(scope, grid, compact, emptyState, searchInput) {
    if (!scope || !grid) return;
    let activeCategory = "all";
    let searchTerm = "";

    const apply = () => {
      const filtered = HOME_GAMES.filter(game => {
        const matchesCategory = activeCategory === "all" || game.category === activeCategory;
        const haystack = (game.name + " " + game.description + " " + game.category).toLowerCase();
        return matchesCategory && haystack.includes(searchTerm);
      });
      renderCards(grid, filtered, compact, emptyState);
      if (!compact) updateCatalogueCount(filtered.length);
    };

    scope.querySelectorAll("[data-game-category]").forEach(button => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.gameCategory || "all";
        scope.querySelectorAll("[data-game-category]").forEach(item => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        apply();
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        searchTerm = searchInput.value.trim().toLowerCase();
        apply();
      });
    }
    apply();
  }

  function initHomeGames() {
    const homeScope = document.querySelector(".mobile-home-shell");
    const catalogueScope = document.getElementById("mobile-games");
    const homeGrid = document.getElementById("categoryGames");
    const catalogueGrid = document.getElementById("gamesCatalogGrid");
    const catalogueSearch = document.getElementById("gameCatalogueSearch");
    const emptyState = document.getElementById("catalogueEmptyState");

    bindCategoryFilters(homeScope, homeGrid, true, null, null);
    bindCategoryFilters(catalogueScope, catalogueGrid, false, emptyState, catalogueSearch);
  }

  document.addEventListener("DOMContentLoaded", initHomeGames);
})();
