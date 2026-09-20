// Client Application Controller
let token = localStorage.getItem("rmg_token");
let currentUserId = localStorage.getItem("rmg_userId");
let stompClient = null;
let currentAviatorState = null;
let activeAviatorBet = null;
let currentColourState = null;
let selectedColourTarget = { type: null, value: null };
let currentLudoMatch = null;

document.addEventListener("DOMContentLoaded", () => {
  if (token) onLoginSuccess();
  connectWebSocket();
  initAviatorCanvas();
  setupAviatorControls();
  setupMobileNavigation();
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
  document.querySelectorAll(".bottom-nav-btn").forEach(el => el.classList.toggle("active", el.dataset.tab === tabId));
  const target = document.getElementById("tab-" + tabId);
  if (target) target.style.display = "block";
  if (tabId === "wallet") fetchWallet();
  if (tabId === "ludo" && currentLudoMatch) drawLudoBoard();
}

function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add("active"); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove("active"); }

function togglePassword(id, button) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
  if (button) button.textContent = input.type === "password" ? "◉" : "◌";
}

function safeJsonResponse(res) { return res.json().catch(() => ({ success: false, message: "Invalid server response" })); }

async function doLogin() {
  const u = document.getElementById("loginUsername").value.trim();
  const p = document.getElementById("loginPassword").value;
  if (!u || !p) { alert("Please enter username/phone and password."); return; }
  try {
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernameOrPhone: u, password: p }) });
    const data = await safeJsonResponse(res);
    if (data.success) {
      if (data.data?.requires2fa) { alert("Two-factor authentication is required for this account."); return; }
      token = data.data.accessToken; currentUserId = data.data.userId;
      localStorage.setItem("rmg_token", token); localStorage.setItem("rmg_userId", currentUserId);
      closeModal("loginModal"); onLoginSuccess(); alert("Logged in successfully!");
    } else alert("Login failed: " + (data.message || "Unable to log in"));
  } catch (err) { console.error(err); alert("Error connecting to server"); }
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
      if (deposit) deposit.textContent = Number(w.depositBalance).toFixed(2);
      const aviatorWallet = document.getElementById("aviatorWalletAmount");
      if (aviatorWallet) aviatorWallet.textContent = Number(w.depositBalance).toFixed(2);
      if (winnings) winnings.textContent = Number(w.winningsBalance).toFixed(2);
      if (bonus) bonus.textContent = Number(w.bonusBalance).toFixed(2);
      if (withdrawable) withdrawable.textContent = Number(w.winningsBalance).toFixed(2);
      if (walletDeposit) walletDeposit.textContent = Number(w.depositBalance).toFixed(2);
      if (walletWinnings) walletWinnings.textContent = Number(w.winningsBalance).toFixed(2);
      if (walletBonus) walletBonus.textContent = Number(w.bonusBalance).toFixed(2);
    }
  } catch (e) { console.error("Wallet error", e); }
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
      { const el = document.getElementById("dispDepRefCode"); if (el) el.textContent = dep.referenceCode; }
      { const el = document.getElementById("dispOfficialUpi"); if (el) el.textContent = dep.officialUpiId; }
      { const el = document.getElementById("dispOfficialAccount"); if (el) el.textContent = dep.officialAccountNo + " (" + dep.officialBankName + ")"; }
      { const el = document.getElementById("dispOfficialIfsc"); if (el) el.textContent = dep.officialIfsc; }
      { const el = document.getElementById("lnkWhatsApp"); if (el) el.href = dep.whatsAppLink; }
      { const el = document.getElementById("depositResultBox"); if (el) el.style.display = "block"; }
      return dep.whatsAppLink;
    } else alert("Deposit request error: " + (data.message || "Unable to create request"));
  } catch (e) { alert("Failed to create deposit request"); }
}

async function simulateWhatsAppSubmission() {
  const refEl = document.getElementById("dispDepRefCode"); if (!refEl) return;
  const utr = document.getElementById("simUtrInput")?.value || "423456789012";
  try {
    const res = await fetch("/api/webhooks/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: "+919876500001", body: "Paid for " + refEl.textContent + " UTR: " + utr, mediaUrl: "/uploads/whatsapp/screenshot_" + refEl.textContent + ".jpg", mediaType: "IMAGE" }) });
    const data = await safeJsonResponse(res);
    if (data.success) alert("Payment proof received by webhook."); else alert("Webhook rejected: " + (data.message || "Unknown error"));
  } catch (e) { alert("Simulation webhook error"); }
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
  const socket = new SockJS("/ws"); stompClient = Stomp.over(socket); stompClient.debug = null;
  stompClient.connect({}, () => { stompClient.subscribe("/topic/games/aviator", msg => handleAviatorTick(JSON.parse(msg.body))); stompClient.subscribe("/topic/games/colour", msg => handleColourTick(JSON.parse(msg.body))); }, err => { console.warn("WebSocket disconnected", err); });
}

let canvas, ctx;
function initAviatorCanvas() { canvas = document.getElementById("flightCanvas"); if (!canvas) return; ctx = canvas.getContext("2d"); resizeCanvas(); window.addEventListener("resize", resizeCanvas); }
function resizeCanvas() { if (!canvas) return; canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
function handleAviatorTick(state) { currentAviatorState=state; const mult=document.getElementById("multiplier-display"),sub=document.getElementById("aviatorStatusSubtitle"),seed=document.getElementById("aviatorSeedHash"); if(!mult||!sub)return; if(seed&&state.serverSeedHash)seed.textContent=state.serverSeedHash.substring(0,24)+"..."; if(state.status==="BETTING"){mult.classList.remove("crashed");mult.textContent=state.countdownSeconds+"s";sub.textContent="NEXT ROUND STARTS IN...";}else if(state.status==="FLYING"){mult.classList.remove("crashed");mult.textContent=Number(state.currentMultiplier).toFixed(2)+"x";sub.textContent="PLANE IS IN FLIGHT!";renderAviatorFlight(state.currentMultiplier);}else if(state.status==="CRASHED"){mult.classList.add("crashed");mult.textContent=Number(state.crashMultiplier||state.currentMultiplier).toFixed(2)+"x";sub.textContent="FLEW AWAY!";renderCrashExplosion();} const ribbon=document.getElementById("aviatorHistoryRibbon"); if(ribbon&&state.recentHistory) ribbon.innerHTML=state.recentHistory.map(m=>`<span class="history-pill">${Number(m).toFixed(2)}x</span>`).join(""); }
let aviatorAnimFrame = null;
let aviatorFlightMultiplier = 1;
let aviatorFlightStartedAt = null;
let aviatorFlewAway = false;

function initAviatorCanvas() {
  canvas = document.getElementById("flightCanvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  resizeCanvas();
  window.removeEventListener("resize", resizeCanvas);
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  if (!canvas || !canvas.parentElement) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function renderAviatorFlight(mult) {
  if (!ctx || !canvas || aviatorFlewAway) return;
  aviatorFlightMultiplier = Number(mult) || 1;
  if (!aviatorFlightStartedAt) aviatorFlightStartedAt = performance.now();
  if (!aviatorAnimFrame) aviatorAnimFrame = requestAnimationFrame(animateAviatorFlight);
}

function animateAviatorFlight(now) {
  if (!ctx || !canvas || aviatorFlewAway) {
    aviatorAnimFrame = null;
    return;
  }

  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  const elapsed = aviatorFlightStartedAt ? now - aviatorFlightStartedAt : 0;
  const timeProgress = Math.min(elapsed / 15000, 1);
  const multiplierProgress = Math.min(Math.max((aviatorFlightMultiplier - 1) / 20, 0), 1);
  const progress = Math.max(timeProgress * 0.35, multiplierProgress);

  const startX = w * 0.05;
  const startY = h * 0.90;
  const endX = lerp(startX, w * 0.85, progress);
  const endY = lerp(startY, h * 0.20, progress);
  const controlX = endX;
  const controlY = startY;

  ctx.clearRect(0, 0, w, h);

  // Soft graph/grid ambience.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = h * (0.15 + i * 0.15);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  // Filled flight area.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(controlX, controlY, endX, endY);
  ctx.lineTo(endX, startY);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, endY, 0, startY);
  gradient.addColorStop(0, "rgba(234,34,70,.35)");
  gradient.addColorStop(1, "rgba(234,34,70,0)");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  // Neon red curve.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(controlX, controlY, endX, endY);
  ctx.strokeStyle = "#ea2246";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#ea2246";
  ctx.stroke();
  ctx.restore();

  // Flight indicator.
  ctx.save();
  ctx.fillStyle = "#ea2246";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#ea2246";
  ctx.beginPath();
  ctx.arc(endX, endY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  aviatorAnimFrame = requestAnimationFrame(animateAviatorFlight);
}

function renderCrashExplosion() {
  if (!ctx || !canvas) return;
  if (aviatorAnimFrame) cancelAnimationFrame(aviatorAnimFrame);
  aviatorAnimFrame = null;
  aviatorFlewAway = true;

  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.fillStyle = "rgba(21,23,30,.6)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function clearCanvas() {
  if (aviatorAnimFrame) cancelAnimationFrame(aviatorAnimFrame);
  aviatorAnimFrame = null;
  aviatorFlightStartedAt = null;
  aviatorFlightMultiplier = 1;
  aviatorFlewAway = false;
  if (ctx && canvas) {
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    ctx.clearRect(0, 0, w, h);
  }
}

async function placeAviatorBet(){if(!token){openModal("loginModal");return;}if(!currentAviatorState)return;const amt=document.getElementById("aviatorBetAmount")?.value,auto=document.getElementById("aviatorAutoCashout")?.value||null;try{const res=await fetch("/api/games/aviator/bet",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({roundUuid:currentAviatorState.roundUuid,amount:amt,autoCashoutMultiplier:auto})});const data=await safeJsonResponse(res);if(data.success){
activeAviatorBet={betUuid:data.data.bet.betUuid,amount:Number(amt)};
const cashout=document.getElementById("btnAviatorCashout");
const notice=document.getElementById("aviatorNoBetNotice");
const cashoutAmount=document.getElementById("cashoutAmountDisplay");
if(cashout){cashout.style.display="flex";}
if(notice){notice.style.display="none";}
if(cashoutAmount){cashoutAmount.textContent=Number(amt).toFixed(2);}
fetchWallet();
}else alert("Bet error: "+(data.message||"Unknown error"));}catch(e){alert("Failed to place bet");}}
async function cashoutAviator(){if(!activeAviatorBet)return;try{const res=await fetch("/api/games/aviator/cashout",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({betUuid:activeAviatorBet.betUuid})});const data=await safeJsonResponse(res);if(data.success){
alert("Cashed out successfully!");
activeAviatorBet=null;
const cashout=document.getElementById("btnAviatorCashout");
const notice=document.getElementById("aviatorNoBetNotice");
if(cashout){cashout.style.display="none";}
if(notice){notice.style.display="block";}
fetchWallet();
}else alert("Cashout error: "+(data.message||"Unknown error"));}catch(e){alert("Cashout failed");}}
function handleColourTick(state){currentColourState=state;const round=document.getElementById("colourRoundUuid"),timer=document.getElementById("colourTimerBadge");if(!round||!timer)return;round.textContent=state.roundUuid;timer.textContent="00:"+(state.secondsRemaining<10?"0":"")+state.secondsRemaining;if(state.status==="LOCKED"){timer.className="badge badge-rejected";timer.textContent="LOCKED ("+state.secondsRemaining+"s)";}else if(state.status==="RESULT"){timer.className="badge badge-verified";timer.textContent="RESULT: "+state.winningNumber+" ("+state.winningColor+")";}else timer.className="badge badge-approved";const ribbon=document.getElementById("colourHistoryRibbon");if(ribbon&&state.recentResults)ribbon.innerHTML=state.recentResults.map(r=>`<span class="history-pill">${r.number}</span>`).join("");}
function openColourBetModal(type,val){if(!token){openModal("loginModal");return;}selectedColourTarget={type,value:val};document.getElementById("modalBetTarget").textContent=val;document.getElementById("modalBetMultiplier").textContent=type==="NUMBER"?"9.0x":(val==="VIOLET"?"4.5x":"2.0x");openModal("colourBetModal");}
async function confirmColourBet(){const amt=document.getElementById("colourModalAmount")?.value;try{const res=await fetch("/api/games/colour/bet",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({roundUuid:currentColourState.roundUuid,targetType:selectedColourTarget.type,targetValue:selectedColourTarget.value,amount:amt})});const data=await safeJsonResponse(res);if(data.success){alert("Bet placed!");closeModal("colourBetModal");fetchWallet();}else alert("Bet error: "+(data.message||"Unknown error"));}catch(e){alert("Failed to submit bet");}}
async function createLudoMatch(){if(!token){openModal("loginModal");return;}const stake=document.getElementById("ludoStakeSelect")?.value;try{const res=await fetch("/api/games/ludo/rooms",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({stakeAmount:stake,maxPlayers:2})});const data=await safeJsonResponse(res);if(data.success){currentLudoMatch=data.data;document.getElementById("ludoLobbySection").style.display="none";document.getElementById("ludoGameSection").style.display="block";drawLudoBoard();fetchWallet();}else alert("Ludo room error: "+(data.message||"Unknown error"));}catch(e){alert("Error creating match");}}
async function rollLudoDice(){if(!currentLudoMatch)return;try{const res=await fetch("/api/games/ludo/rooms/"+currentLudoMatch.matchUuid+"/roll",{method:"POST",headers:{"Authorization":"Bearer "+token}});const data=await safeJsonResponse(res);if(data.success){alert("You rolled a "+data.data.diceRoll+"!");renderPawnButtons(data.data.movableTokenIndices);}else alert("Roll error: "+(data.message||"Unknown error"));}catch(e){alert("Failed to roll dice");}}
function renderPawnButtons(movable){const container=document.getElementById("ludoTokenButtons");if(!container)return;container.innerHTML="";(movable||[]).forEach(idx=>{const btn=document.createElement("button");btn.className="btn btn-primary";btn.textContent="Move Pawn #"+(idx+1);btn.onclick=()=>moveLudoPawn(idx);container.appendChild(btn);});}
async function moveLudoPawn(tokenIndex){if(!currentLudoMatch)return;try{const res=await fetch("/api/games/ludo/rooms/move",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({matchUuid:currentLudoMatch.matchUuid,tokenIndex})});const data=await safeJsonResponse(res);if(data.success){const box=document.getElementById("ludoTokenButtons");if(box)box.innerHTML="";updateLudoGameState(data.data);}}catch(e){alert("Error moving pawn");}}
function updateLudoGameState(state){const turn=document.getElementById("txtLudoTurnColor"),pot=document.getElementById("txtLudoPot");if(turn)turn.textContent=state.currentTurnColor;if(pot)pot.textContent=Number(state.totalPot).toFixed(2);drawLudoBoard(state.tokenPositions);if(state.status==="COMPLETED"){alert("Match finished!");fetchWallet();}}
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
    {name:'Aviator',key:'aviator',image:'/images/games/aviator.webp'},
    {name:'Colour Prediction',key:'colour',image:'/images/games/colour-prediction.webp'},
    {name:'Ludo',key:'ludo',image:'/images/games/ludo.webp'},
    {name:'Mines',key:'mines',image:'/images/games/mines.webp'},
    {name:'Fruit 777',key:'fruit',image:'/images/games/fruit-777.webp'}
  ]
};

function showGameCategory() {
  const target = document.getElementById('categoryGames');
  if (target) target.innerHTML = catalog.popular.map(cardHTML).join('');
}

function setupMobileNavigation(){
  const home=document.querySelector('.mobile-home-shell'); const games=document.getElementById('mobile-games');
  if(!home||!games)return;
  const originalSwitchTab = window.switchTab;
  window.switchTab=function(tabId){
    if(tabId==='home'){document.querySelectorAll('.tab-content').forEach(el=>el.style.display='none');home.style.display='block';games.style.display='none';setNavActive('home');window.scrollTo(0,0);return;}
    if(tabId==='games'){document.querySelectorAll('.tab-content').forEach(el=>el.style.display='none');home.style.display='none';games.style.display='block';setNavActive('games');window.scrollTo(0,0);return;}
    if(tabId==='deposit'){window.location.href='/deposit.html';return;}
    if(tabId==='wallet'){window.location.href='/wallet.html';return;}
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
      const auto = document.getElementById("aviatorAutoCashout");
      if (auto) auto.focus();
    });
  });

  syncAmount();
}
