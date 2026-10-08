// Client Application Controller
let token = localStorage.getItem("rmg_token");
let currentUserId = localStorage.getItem("rmg_userId");
let stompClient = null;
let currentAviatorState = null;
let activeAviatorBet = null;
let currentColourState = null;
let selectedColourTarget = { type: null, value: null };
let currentLudoMatch = null;
let ludoStatePoll = null;
let wsReconnectTimer = null;
let gameStatePollTimer = null;
let aviatorBetStatusPollTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  if (token) onLoginSuccess();

  // Allow protected pages such as /admin.html to send the user through the
  // normal login modal and then return to the requested path.
  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "1" && !token) {
    requestAnimationFrame(() => openModal("loginModal"));
  }

  connectWebSocket();
  fetchInitialGameStates();
  startGameStatePolling();
  initAviatorCanvas();
  setupAviatorControls();
  setupMobileNavigation();
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
  document.querySelectorAll(".bottom-nav-btn").forEach(el => el.classList.toggle("active", el.dataset.tab === tabId));
  document.body.classList.toggle("game-mode", tabId === "aviator" || tabId === "colour");
  const target = document.getElementById("tab-" + tabId);
  if (target) target.style.display = "block";
  if (tabId === "wallet") fetchWallet();
  if (tabId === "aviator" || tabId === "colour") {
    fetchWallet();
    loadBetHistory(tabId === "aviator" ? "AVIATOR" : "COLOUR_PREDICTION");
    if (window.ApexGameUI && typeof window.ApexGameUI.resizeAviatorCanvas === "function") {
      requestAnimationFrame(() => window.ApexGameUI.resizeAviatorCanvas());
      setTimeout(() => window.ApexGameUI.resizeAviatorCanvas(), 120);
    }
  }
  if (tabId === "ludo" && currentLudoMatch) drawLudoBoard();
}
function goHome() {
  if (typeof window.switchTab === "function") {
    window.switchTab("home");
  } else {
    window.location.href = "/";
  }
}


function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add("active"); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove("active"); }

function togglePassword(id, button) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
  if (button) button.textContent = input.type === "password" ? "◉" : "◌";
}

function safeJsonResponse(res) {
  if (res.status === 401 || res.status === 403) {
    clearClientSession();
    return Promise.resolve({ success: false, message: "Your session has expired. Please log in again." });
  }
  return res.json().catch(() => ({ success: false, message: "Invalid server response" }));
}
function clearClientSession() {
  token = null;
  currentUserId = null;
  localStorage.removeItem("rmg_token");
  localStorage.removeItem("rmg_userId");
}
function renderHistoryPills(container, values, formatter) {
  if (!container) return;
  container.replaceChildren();
  (Array.isArray(values) ? values : []).slice(0, 20).forEach(value => {
    const pill = document.createElement("span");
    pill.className = "history-pill";
    pill.textContent = formatter(value);
    container.appendChild(pill);
  });
}

async function doLogin() {
  const u = document.getElementById("loginUsername").value.trim();
  const p = document.getElementById("loginPassword").value;
  if (!u || !p) { alert("Please enter username/phone and password."); return; }

  const login = async (totpCode = null) => {
    const body = { usernameOrPhone: u, password: p };
    if (totpCode) body.totpCode = totpCode;
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return safeJsonResponse(res);
  };

  try {
    let data = await login();

    if (data.success && data.data?.requires2fa) {
      const totp = prompt("Admin 2FA required. Enter your 6-digit authenticator code:");
      if (!totp || !/^\d{6}$/.test(totp.trim())) {
        alert("A valid 6-digit 2FA code is required.");
        return;
      }
      data = await login(totp);
    }

    if (data.success && data.data?.accessToken) {
      token = data.data.accessToken;
      currentUserId = data.data.userId;

      const loginParams = new URLSearchParams(window.location.search);
      const isAdminLogin = loginParams.get("admin") === "1" || loginParams.get("return") === "/admin.html";

      if (isAdminLogin) {
        localStorage.setItem("rmg_admin_token", token);
      } else {
        localStorage.setItem("rmg_token", token);
        localStorage.setItem("rmg_userId", currentUserId);
      }

      closeModal("loginModal");

      const returnTo = loginParams.get("return");
      if (isAdminLogin) {
        // Do not run the player-session UI flow with an admin token.
        // The admin console has its own session bootstrap and authorization checks.
        const adminTarget = returnTo && returnTo.startsWith("/") ? returnTo : "/admin.html";
        window.location.replace(adminTarget);
        return;
      }

      onLoginSuccess();

      if (returnTo && returnTo.startsWith("/")) {
        window.location.replace(returnTo);
        return;
      }

      alert("Logged in successfully!");
    } else {
      alert("Login failed: " + (data.message || "Unable to log in"));
    }
  } catch (err) {
    console.error(err);
    alert("Error connecting to server");
  }
}

async function doRegister() {
  const u = document.getElementById("regUsername").value.trim();
  const ph = document.getElementById("regPhone").value.trim();
  const email = document.getElementById("regEmail")?.value.trim() || null;
  const dob = document.getElementById("regDob").value;
  const pwd = document.getElementById("regPassword").value;
  const confirmPwd = document.getElementById("regConfirmPassword").value;
  const age = document.getElementById("regAgeConfirm").checked;

  if (!u || !ph || !dob || !pwd || !confirmPwd) { alert("Please complete all required registration fields."); return; }
  if (pwd.length < 8) { alert("Password must be at least 8 characters."); return; }
  if (pwd !== confirmPwd) { alert("Passwords do not match."); return; }
  if (!age) { alert("You must confirm that you are 18+ and legally eligible."); return; }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, phoneNumber: ph, email, firstName: u, lastName: null, dateOfBirth: dob, password: pwd, ageConfirmed: true })
    });
    const data = await safeJsonResponse(res);
    if (data.success) {
      token = data.data.accessToken; currentUserId = data.data.userId;
      localStorage.setItem("rmg_token", token); localStorage.setItem("rmg_userId", currentUserId);
      closeModal("registerModal"); onLoginSuccess(); alert("Registration successful! Welcome to Apex Gaming.");
    } else alert("Registration rejected: " + (data.message || "Unable to create account"));
  } catch (err) { console.error(err); alert("Network error during registration"); }
}

function onLoginSuccess() {
  const authButtons = document.getElementById("authButtons");
  const navWallets = document.getElementById("navWallets");
  if (authButtons) authButtons.style.display = "none";
  if (navWallets) navWallets.style.display = "flex";
  const topLogin = document.getElementById("headerLoginBtn");
  const topJoin = document.getElementById("headerJoinBtn");
  if (topLogin) topLogin.style.display = "none";
  if (topJoin) topJoin.style.display = "none";
  fetchWallet();
}

function logout() { localStorage.removeItem("rmg_token"); localStorage.removeItem("rmg_userId"); location.reload(); }

async function fetchWallet() {
  if (!token) return;
  try {
    const res = await fetch("/api/wallet", { headers: { "Authorization": "Bearer " + token } });
    const data = await safeJsonResponse(res);
    if (data.success) {
      const w = data.data;
      const deposit = document.getElementById("txtDepositBal");
      const winnings = document.getElementById("txtWinningsBal");
      const bonus = document.getElementById("txtBonusBal");
      const withdrawable = document.getElementById("txtWithdrawableBal");
      const walletDeposit = document.getElementById("walletDepositBalance");
      const walletWinnings = document.getElementById("walletWinningsBalance");
      const walletBonus = document.getElementById("walletBonusBalance");
      const walletTotal = document.getElementById("walletTotalBalance");
      const walletThird = document.getElementById("walletThirdBalance");
      const walletMainPercent = document.getElementById("walletMainPercent");
      const walletThirdPercent = document.getElementById("walletThirdPercent");
      const depositPageBalance = document.getElementById("depositPageBalance");
      const gameWalletValues = document.querySelectorAll(".apx-wallet-balance-value");
      if (deposit) deposit.textContent = Number(w.depositBalance).toFixed(2);
      const aviatorWallet = document.getElementById("aviatorWalletAmount");
      if (aviatorWallet) aviatorWallet.textContent = Number(w.depositBalance).toFixed(2);
      if (winnings) winnings.textContent = Number(w.winningsBalance).toFixed(2);
      if (bonus) bonus.textContent = Number(w.bonusBalance).toFixed(2);
      if (withdrawable) withdrawable.textContent = Number(w.winningsBalance).toFixed(2);
      if (walletDeposit) walletDeposit.textContent = Number(w.depositBalance).toFixed(2);
      if (walletWinnings) walletWinnings.textContent = Number(w.winningsBalance).toFixed(2);
      if (walletBonus) walletBonus.textContent = Number(w.bonusBalance).toFixed(2);
      if (walletTotal) walletTotal.textContent = Number(w.totalPlayableBalance ?? w.depositBalance ?? 0).toFixed(2);
      if (walletThird) walletThird.textContent = Number(w.winningsBalance ?? 0).toFixed(2);
      if (walletMainPercent) walletMainPercent.textContent = "100%";
      if (walletThirdPercent) walletThirdPercent.textContent = "0%";
      if (depositPageBalance) depositPageBalance.textContent = Number(w.totalPlayableBalance ?? w.depositBalance ?? 0).toFixed(2);
      const mainBalance = Number(w.depositBalance ?? 0);
      const withdrawalBalance = Number(w.totalWithdrawableBalance ?? w.winningsBalance ?? 0);
      const gameBalance = (mainBalance + withdrawalBalance).toFixed(2);
      gameWalletValues.forEach(node => { node.textContent = "₹" + gameBalance; });
    }
  } catch (e) { console.error("Wallet error", e); }
}

function formatBetSelection(selection) {
  const raw = String(selection || "BET");
  const parts = raw.split(":");
  if (parts.length < 2) return raw;
  const type = parts[0] === "NUMBER" ? "Number" : "Colour";
  return type + ": " + parts.slice(1).join(":");
}

function renderBetHistory(container, rows) {
  if (!container) return;
  container.replaceChildren();

  if (!Array.isArray(rows) || rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "apx-bet-history-empty";
    empty.textContent = "No bets placed yet.";
    container.appendChild(empty);
    return;
  }

  rows.forEach(item => {
    const row = document.createElement("article");
    row.className = "apx-bet-history-row " + String(item.status || "PLACED").toLowerCase();

    const main = document.createElement("div");
    main.className = "apx-bet-history-main";

    const game = document.createElement("strong");
    game.textContent = item.gameType === "AVIATOR" ? "Aviator" : "Colour Prediction";

    const selection = document.createElement("span");
    selection.textContent = formatBetSelection(item.selection);

    const round = document.createElement("small");
    round.textContent = String(item.roundUuid || "Round");

    main.append(game, selection, round);

    const right = document.createElement("div");
    right.className = "apx-bet-history-result";

    const status = document.createElement("span");
    status.className = "apx-bet-status";
    status.textContent = item.status === "WON" ? "WON" : item.status === "LOST" ? "LOST" : String(item.status || "PLACED");

    const amount = document.createElement("strong");
    const payout = Number(item.payoutAmount || 0);
    const stake = Number(item.amount || 0);
    if (item.status === "WON") {
      amount.textContent = "+₹" + payout.toFixed(2);
    } else {
      amount.textContent = "-₹" + stake.toFixed(2);
    }

    const meta = document.createElement("small");
    meta.textContent = item.status === "WON"
      ? "CASHED OUT"
      : item.status === "LOST" ? "LOST" : "BET PLACED";

    right.append(status, amount, meta);
    row.append(main, right);
    container.appendChild(row);
  });
}

async function loadBetHistory(gameType) {
  const container = document.getElementById(gameType === "AVIATOR" ? "aviatorBetHistory" : "colourBetHistory");
  if (!container || !token) return;

  container.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "apx-bet-history-empty";
  loading.textContent = "Loading bet history…";
  container.appendChild(loading);

  try {
    const res = await fetch("/api/games/bets/history?gameType=" + encodeURIComponent(gameType) + "&size=20", {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await safeJsonResponse(res);
    if (data.success) {
      const rows = Array.isArray(data.data) ? data.data : [];
      renderBetHistory(container, rows);

      if (gameType === "AVIATOR" && activeAviatorBet) {
        const current = rows.find(item => item.betUuid === activeAviatorBet.betUuid);
        if (current && (current.status === "WON" || current.status === "LOST" || current.status === "CANCELLED" || current.status === "REFUNDED")) {
          clearActiveAviatorBet();
        }
      }
    } else {
      renderBetHistory(container, []);
    }
  } catch (e) {
    console.error("Bet history error", e);
    container.replaceChildren();
    const error = document.createElement("div");
    error.className = "apx-bet-history-empty";
    error.textContent = "Bet history unavailable right now.";
    container.appendChild(error);
  }
}

async function initiateDeposit() {
  if (!token) { window.location.href = "/"; return; }
  const input = document.getElementById("depositAmountInput"); if (!input) return;
  const amt = input.value;
  try {
    const res = await fetch("/api/deposits", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }, body: JSON.stringify({ amount: amt, paymentMethod: "UPI" }) });
    const data = await safeJsonResponse(res);
    if (data.success) {
      const dep = data.data;
      if (typeof currentDepositId !== "undefined") currentDepositId = dep.depositId;
      { const el = document.getElementById("dispDepRefCode"); if (el) el.textContent = dep.referenceCode; }
      { const el = document.getElementById("depositResultBox"); if (el) el.style.display = "block"; }
      return dep.whatsAppLink;
    } else alert("Deposit request error: " + (data.message || "Unable to create request"));
  } catch (e) { alert("Failed to create deposit request"); }
}

async function requestWithdrawal() {
  if (!token) { window.location.href = "/"; return; }
  try {
    const res = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }, body: JSON.stringify({ amount: document.getElementById("wdrAmountInput")?.value, destinationType: document.getElementById("wdrTypeSelect")?.value, accountHolderName: document.getElementById("wdrNameInput")?.value, accountNumberOrVpa: document.getElementById("wdrVpaInput")?.value }) });
    const data = await safeJsonResponse(res);
    if (data.success) { alert("Withdrawal request submitted!"); fetchWallet(); } else alert("Withdrawal failed: " + (data.message || "Unknown error"));
  } catch (e) { alert("Withdrawal error"); }
}

function connectWebSocket() {
  if (typeof SockJS === "undefined" || typeof Stomp === "undefined") return;
  if (stompClient && stompClient.connected) return;

  const socket = new SockJS("/ws");
  stompClient = Stomp.over(socket);
  stompClient.debug = null;

  stompClient.connect({}, () => {
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
    stompClient.subscribe("/topic/games/aviator", msg => {
      try { handleAviatorTick(JSON.parse(msg.body)); } catch (e) { console.warn("Invalid Aviator state", e); }
    });
    stompClient.subscribe("/topic/games/colour", msg => {
      try { handleColourTick(JSON.parse(msg.body)); } catch (e) { console.warn("Invalid Colour state", e); }
    });
    fetchInitialGameStates();
  }, err => {
    console.warn("WebSocket disconnected", err);
    if (!wsReconnectTimer) {
      wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null;
        connectWebSocket();
      }, 2500);
    }
  });
}

async function fetchInitialGameStates() {
  try {
    const [aviatorRes, colourRes] = await Promise.all([
      fetch("/api/games/aviator/state"),
      fetch("/api/games/colour/state")
    ]);

    if (aviatorRes.ok) {
      const data = await aviatorRes.json().catch(() => null);
      if (data?.success && data.data) handleAviatorTick(data.data);
    }

    if (colourRes.ok) {
      const data = await colourRes.json().catch(() => null);
      if (data?.success && data.data) handleColourTick(data.data);
    }
  } catch (e) {
    console.warn("Initial game state unavailable", e);
  }
}
function startGameStatePolling() {
  if (gameStatePollTimer) return;
  gameStatePollTimer = setInterval(fetchInitialGameStates, 1000);
}



let canvas, ctx;

function initAviatorCanvas() {
  if (window.ApexGameUI && typeof window.ApexGameUI.initAviator === "function") {
    window.ApexGameUI.initAviator();
  }
}

function resizeCanvas() {
  if (window.ApexGameUI && typeof window.ApexGameUI.resizeAviatorCanvas === "function") {
    window.ApexGameUI.resizeAviatorCanvas();
  }
}

function handleAviatorTick(state) {
  if (!state) return;

  const previousRound = currentAviatorState?.roundUuid;
  currentAviatorState = state;

  // A crashed round can no longer be cashed out. Clear the stale button
  // immediately, including when the browser reconnects to a new round.
  if (state.status === "CRASHED" || (previousRound && previousRound !== state.roundUuid)) {
    activeAviatorBet = null;
    const cashout = document.getElementById("btnAviatorCashout");
    const notice = document.getElementById("aviatorNoBetNotice");
    if (cashout) cashout.style.display = "none";
    if (notice) notice.style.display = "block";
  }

  if (window.ApexGameUI && typeof window.ApexGameUI.renderAviator === "function") {
    window.ApexGameUI.renderAviator(state);
  }

  if (state.status === "CRASHED") {
    loadBetHistory("AVIATOR");
  }
}

function handleColourTick(state) {
  currentColourState = state;
  if (window.ApexGameUI && typeof window.ApexGameUI.renderColour === "function") {
    window.ApexGameUI.renderColour(state);
    if (state.status === "RESULT") loadBetHistory("COLOUR_PREDICTION");
    return;
  }
  const round = document.getElementById("colourRoundUuid");
  const timer = document.getElementById("colourTimerBadge");
  if (round) round.textContent = state.roundUuid || "-";
  if (timer) timer.textContent = String(state.secondsRemaining ?? 0).padStart(2, "0");
}

async function placeAviatorBet(){if(!token){openModal("loginModal");return;}if(!currentAviatorState)return;const amt=document.getElementById("aviatorBetAmount")?.value,auto=document.getElementById("aviatorAutoCashout")?.value||null;try{const res=await fetch("/api/games/aviator/bet",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({roundUuid:currentAviatorState.roundUuid,amount:amt,autoCashoutMultiplier:auto})});const data=await safeJsonResponse(res);if(data.success){
activeAviatorBet={betUuid:data.data.betUuid,amount:Number(amt),autoCashoutMultiplier:auto?Number(auto):null};
const cashout=document.getElementById("btnAviatorCashout");
const notice=document.getElementById("aviatorNoBetNotice");
const cashoutAmount=document.getElementById("cashoutAmountDisplay");
if(cashout){cashout.style.display="flex";}
if(notice){notice.style.display="none";}
if(cashoutAmount){cashoutAmount.textContent=Number(amt).toFixed(2);}
fetchWallet();
loadBetHistory("AVIATOR");
startAviatorBetStatusPolling();
}else alert("Bet error: "+(data.message||"Unknown error"));}catch(e){alert("Failed to place bet");}}
async function cashoutAviator(){
  if(!activeAviatorBet)return;
  if(!token){clearActiveAviatorBet();return;}
  try{
    const res=await fetch("/api/games/aviator/cashout",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
      body:JSON.stringify({betUuid:activeAviatorBet.betUuid})
    });
    const data=await safeJsonResponse(res);
    if(data.success){
      clearActiveAviatorBet();
      fetchWallet();
      loadBetHistory("AVIATOR");
      alert("Cashed out successfully!");
    }else{
      alert("Cashout error: "+(data.message||"Unknown error"));
    }
  }catch(e){
    console.error("Cashout error",e);
    alert("Cashout failed. Please try again.");
  }
}

function clearActiveAviatorBet(){
  activeAviatorBet=null;
  if(aviatorBetStatusPollTimer){
    clearInterval(aviatorBetStatusPollTimer);
    aviatorBetStatusPollTimer=null;
  }
  const cashout=document.getElementById("btnAviatorCashout");
  const notice=document.getElementById("aviatorNoBetNotice");
  if(cashout) cashout.style.display="none";
  if(notice) notice.style.display="block";
}

function startAviatorBetStatusPolling(){
  if(aviatorBetStatusPollTimer) clearInterval(aviatorBetStatusPollTimer);
  aviatorBetStatusPollTimer=setInterval(()=>loadBetHistory("AVIATOR"),1000);
}
function openColourBetModal(type,val){if(!token){openModal("loginModal");return;}selectedColourTarget={type,value:val};document.getElementById("modalBetTarget").textContent=val;document.getElementById("modalBetMultiplier").textContent=type==="NUMBER"?"9.0x":(val==="VIOLET"?"4.5x":"2.0x");openModal("colourBetModal");}
async function confirmColourBet(){const amt=document.getElementById("colourModalAmount")?.value;try{const res=await fetch("/api/games/colour/bet",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({roundUuid:currentColourState.roundUuid,targetType:selectedColourTarget.type,targetValue:selectedColourTarget.value,amount:amt})});const data=await safeJsonResponse(res);if(data.success){alert("Bet placed!");closeModal("colourBetModal");fetchWallet();loadBetHistory("COLOUR_PREDICTION");}else alert("Bet error: "+(data.message||"Unknown error"));}catch(e){alert("Failed to submit bet");}}
async function createLudoMatch(){if(!token){openModal("loginModal");return;}const stake=document.getElementById("ludoStakeSelect")?.value;try{const res=await fetch("/api/games/ludo/rooms",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({stakeAmount:stake,maxPlayers:2})});const data=await safeJsonResponse(res);if(data.success){
  currentLudoMatch=data.data;
  document.getElementById("ludoLobbySection").style.display="none";
  document.getElementById("ludoGameSection").style.display="block";
  updateLudoGameState(data.data);
  fetchWallet();
  clearInterval(ludoStatePoll);
  ludoStatePoll=setInterval(async()=>{
    if(!currentLudoMatch?.matchUuid) return;
    try{
      const stateRes=await fetch("/api/games/ludo/rooms/"+encodeURIComponent(currentLudoMatch.matchUuid)+"/state",{headers:{"Authorization":"Bearer "+token}});
      const stateData=await safeJsonResponse(stateRes);
      if(stateData.success) updateLudoGameState(stateData.data);
    }catch(e){console.warn("Ludo state poll failed",e);}
  },2000);
}else alert("Ludo room error: "+(data.message||"Unknown error"));}catch(e){alert("Error creating match");}}
async function rollLudoDice(){if(!currentLudoMatch)return;try{const res=await fetch("/api/games/ludo/rooms/"+currentLudoMatch.matchUuid+"/roll",{method:"POST",headers:{"Authorization":"Bearer "+token}});const data=await safeJsonResponse(res);if(data.success){alert("You rolled a "+data.data.diceRoll+"!");renderPawnButtons(data.data.movableTokenIndices);}else alert("Roll error: "+(data.message||"Unknown error"));}catch(e){alert("Failed to roll dice");}}
function renderPawnButtons(movable){const container=document.getElementById("ludoTokenButtons");if(!container)return;container.innerHTML="";(movable||[]).forEach(idx=>{const btn=document.createElement("button");btn.className="btn btn-primary";btn.textContent="Move Pawn #"+(idx+1);btn.onclick=()=>moveLudoPawn(idx);container.appendChild(btn);});}
async function moveLudoPawn(tokenIndex){if(!currentLudoMatch)return;try{const res=await fetch("/api/games/ludo/rooms/move",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({matchUuid:currentLudoMatch.matchUuid,tokenIndex})});const data=await safeJsonResponse(res);if(data.success){const box=document.getElementById("ludoTokenButtons");if(box)box.innerHTML="";updateLudoGameState(data.data);}}catch(e){alert("Error moving pawn");}}
function updateLudoGameState(state){
  if(!state) return;
  currentLudoMatch = { ...(currentLudoMatch || {}), ...state };
  const turn=document.getElementById("txtLudoTurnColor");
  const pot=document.getElementById("txtLudoPot");
  const status=document.getElementById("ludoMatchStatusBadge");
  const roll=document.getElementById("btnLudoRoll");
  if(turn) turn.textContent=state.currentTurnColor || "-";
  if(pot) pot.textContent=Number(state.totalPot || 0).toFixed(2);
  if(status) status.textContent=String(state.status || "Lobby").replace("_"," ");
  if(roll) roll.disabled=state.status!=="IN_PROGRESS" || Number(state.currentTurnUserId)!==Number(currentUserId);
  drawLudoBoard(state.tokenPositions);
  if(state.status==="COMPLETED"){
    if(roll) roll.disabled=true;
    fetchWallet();
    clearInterval(ludoStatePoll);
    ludoStatePoll=null;
  }
}
function drawLudoBoard(){const canvas=document.getElementById("ludoCanvas");if(!canvas)return;const c=canvas.getContext("2d"),s=canvas.width;c.fillStyle="#1e293b";c.fillRect(0,0,s,s);c.fillStyle="#ef4444";c.fillRect(0,0,s*.4,s*.4);c.fillStyle="#10b981";c.fillRect(s*.6,0,s*.4,s*.4);c.fillStyle="#eab308";c.fillRect(s*.6,s*.6,s*.4,s*.4);c.fillStyle="#3b82f6";c.fillRect(0,s*.6,s*.4,s*.4);c.fillStyle="#f8fafc";c.beginPath();c.arc(s/2,s/2,s*.1,0,Math.PI*2);c.fill();}
async function updateLimits(){if(!token){openModal("loginModal");return;}const dep=document.getElementById("limitDepositInput")?.value,loss=document.getElementById("limitLossInput")?.value;try{const res=await fetch("/api/users/limits",{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({dailyDepositLimit:dep,dailyLossLimit:loss})});const data=await safeJsonResponse(res);if(data.success)alert("Responsible gaming limits updated!");else alert("Unable to update limits");}catch(e){alert("Error updating limits");}}
async function requestSelfExclusion(){if(!token){openModal("loginModal");return;}if(!confirm("Are you sure? You will be blocked from depositing and placing bets for 24 hours."))return;try{const res=await fetch("/api/users/self-exclude",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({exclusionType:"COOL_OFF",durationHours:24,reason:"User break"})});const data=await safeJsonResponse(res);if(data.success){alert("Account is now in 24-hour cool-off period. Logging out.");logout();}}catch(e){alert("Self-exclusion error");}}

function cardHTML(game) {
  const actions = {
    aviator: "switchTab('aviator')",
    colour: "switchTab('colour')",
    ludo: "switchTab('ludo')",
    mines: "switchTab('games')",
    fruit: "switchTab('games')"
  };
  const action = actions[game.key] || "void(0)";
  return `<button class="catalog-card ${game.key}" onclick="${action}"><div class="catalog-art"><img src="${game.image}" alt="${game.name}"></div><b>${game.name}</b></button>`;
}

const catalog = {
  popular:[
    {name:'Aviator',key:'aviator',image:'/images/games/aviator.svg'},
    {name:'Colour Prediction',key:'colour',image:'/images/games/colour.svg'},
    {name:'Ludo',key:'ludo',image:'/images/games/ludo.svg'},
    {name:'Mines',key:'mines',image:'/images/games/mines.svg'},
    {name:'Fruit 777',key:'fruit',image:'/images/games/fruit-777.svg'}
  ]
};

function showGameCategory() {
  const target = document.getElementById('categoryGames');
  if (!target) return;
  target.replaceChildren();
  catalog.popular.forEach(game => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'catalog-card ' + game.key;
    card.setAttribute('aria-label', 'Open ' + game.name);
    card.addEventListener('click', () => switchTab(game.key === 'fruit' || game.key === 'mines' ? 'games' : game.key));
    const image = document.createElement('img');
    image.className = 'catalog-image';
    image.src = game.image;
    image.alt = game.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    const title = document.createElement('b');
    title.textContent = game.name;
    card.append(image, title);
    target.appendChild(card);
  });
}

function setupMobileNavigation(){
  const home=document.querySelector('.mobile-home-shell'); const games=document.getElementById('mobile-games');
  if(!home||!games)return;
  const originalSwitchTab = window.switchTab;
  window.switchTab=function(tabId){
    if(tabId==='home'){document.body.classList.remove('game-mode');document.querySelectorAll('.tab-content').forEach(el=>el.style.display='none');home.style.display='block';games.style.display='none';setNavActive('home');window.scrollTo(0,0);return;}
    if(tabId==='games'){document.body.classList.remove('game-mode');document.querySelectorAll('.tab-content').forEach(el=>el.style.display='none');home.style.display='none';games.style.display='block';setNavActive('games');window.scrollTo(0,0);return;}
    if(tabId==='deposit'){document.body.classList.remove('game-mode');window.location.href='/deposit.html';return;}
    if(tabId==='wallet'){document.body.classList.remove('game-mode');window.location.href='/wallet.html';return;}
    home.style.display='none';games.style.display='none';originalSwitchTab(tabId);setNavActive(tabId);window.scrollTo(0,0);
  };
  showGameCategory();
  setNavActive('home');
}
function setNavActive(tab){document.querySelectorAll('.bottom-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===tab));}


function setupAviatorControls() {
  const amount = document.getElementById("aviatorBetAmount");
  const display = document.getElementById("aviatorBetAmountDisplay");
  const actionAmount = document.getElementById("aviatorBetActionAmount");
  if (!amount || !display || !actionAmount) return;

  const syncAmount = () => {
    let value = Number(amount.value || 50);
    value = Math.min(50000, Math.max(10, Math.round(value / 10) * 10));
    amount.value = value;
    display.textContent = value;
    actionAmount.textContent = value;
    document.querySelectorAll("[data-aviator-preset]").forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.aviatorPreset) === value);
    });
  };

  document.getElementById("aviatorBetMinus")?.addEventListener("click", () => {
    amount.value = Number(amount.value || 50) - 10;
    syncAmount();
  });
  document.getElementById("aviatorBetPlus")?.addEventListener("click", () => {
    amount.value = Number(amount.value || 50) + 10;
    syncAmount();
  });
  amount.addEventListener("input", syncAmount);

  document.querySelectorAll("[data-aviator-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      amount.value = Number(btn.dataset.aviatorPreset);
      syncAmount();
    });
  });

  document.querySelectorAll("[data-aviator-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-aviator-mode]").forEach(item => item.classList.remove("active"));
      btn.classList.add("active");
      const autoField = document.getElementById("aviatorAutoField");
      const auto = document.getElementById("aviatorAutoCashout");
      const isAuto = btn.dataset.aviatorMode === "auto";
      if (autoField) autoField.classList.toggle("visible", isAuto);
      if (auto && isAuto) auto.focus();
    });
  });

  syncAmount();
}
