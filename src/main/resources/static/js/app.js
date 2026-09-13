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
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".bottom-nav-btn").forEach(el => el.classList.toggle("active", el.dataset.tab === tabId));
  const target = document.getElementById("tab-" + tabId);
  if (target) target.style.display = "block";
  const btn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.getAttribute("onclick").includes(tabId));
  if (btn) btn.classList.add("active");
  if (tabId === "wallet") fetchWallet();
  if (tabId === "ludo" && currentLudoMatch) drawLudoBoard();
}

function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add("active"); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove("active"); }

async function doLogin() {
  const u = document.getElementById("loginUsername").value;
  const p = document.getElementById("loginPassword").value;
  try {
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernameOrPhone: u, password: p }) });
    const data = await res.json();
    if (data.success) {
      token = data.data.accessToken; currentUserId = data.data.userId;
      localStorage.setItem("rmg_token", token); localStorage.setItem("rmg_userId", currentUserId);
      closeModal("loginModal"); onLoginSuccess(); alert("Logged in successfully!");
    } else alert("Login failed: " + data.message);
  } catch (err) { alert("Error connecting to server"); }
}

async function doRegister() {
  const u = document.getElementById("regUsername").value;
  const ph = document.getElementById("regPhone").value;
  const dob = document.getElementById("regDob").value;
  const st = document.getElementById("regState").value;
  const pwd = document.getElementById("regPassword").value;
  const age = document.getElementById("regAgeConfirm").checked;
  if (!age) { alert("You must confirm age verification (18+)"); return; }
  try {
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, phoneNumber: ph, firstName: u, dateOfBirth: dob, state: st, password: pwd, ageConfirmed: true }) });
    const data = await res.json();
    if (data.success) {
      token = data.data.accessToken; currentUserId = data.data.userId;
      localStorage.setItem("rmg_token", token); localStorage.setItem("rmg_userId", currentUserId);
      closeModal("registerModal"); onLoginSuccess(); alert("Registration successful! Account and double-entry ledger created.");
    } else alert("Registration rejected: " + data.message);
  } catch (err) { alert("Network error during registration"); }
}

function onLoginSuccess() { document.getElementById("authButtons").style.display = "none"; document.getElementById("navWallets").style.display = "flex"; fetchWallet(); }
function logout() { localStorage.removeItem("rmg_token"); localStorage.removeItem("rmg_userId"); location.reload(); }

async function fetchWallet() {
  if (!token) return;
  try {
    const res = await fetch("/api/wallet", { headers: { "Authorization": "Bearer " + token } });
    const data = await res.json();
    if (data.success) { const w = data.data; document.getElementById("txtDepositBal").textContent = Number(w.depositBalance).toFixed(2); document.getElementById("txtWinningsBal").textContent = Number(w.winningsBalance).toFixed(2); document.getElementById("txtBonusBal").textContent = Number(w.bonusBalance).toFixed(2); document.getElementById("txtWithdrawableBal").textContent = Number(w.winningsBalance).toFixed(2); }
  } catch (e) { console.error("Wallet error", e); }
}

async function initiateDeposit() {
  const amt = document.getElementById("depositAmountInput").value;
  try {
    const res = await fetch("/api/deposits", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }, body: JSON.stringify({ amount: amt, paymentMethod: "UPI" }) });
    const data = await res.json();
    if (data.success) { const dep = data.data; document.getElementById("dispDepRefCode").textContent = dep.referenceCode; document.getElementById("dispOfficialUpi").textContent = dep.officialUpiId; document.getElementById("dispOfficialAccount").textContent = dep.officialAccountNo + " (" + dep.officialBankName + ")"; document.getElementById("dispOfficialIfsc").textContent = dep.officialIfsc; document.getElementById("lnkWhatsApp").href = dep.whatsAppLink; document.getElementById("depositResultBox").style.display = "block"; } else alert("Deposit request error: " + data.message);
  } catch (e) { alert("Failed to create deposit request"); }
}

async function simulateWhatsAppSubmission() {
  const ref = document.getElementById("dispDepRefCode").textContent; const utr = document.getElementById("simUtrInput").value || "423456789012";
  try { const res = await fetch("/api/webhooks/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: "+919876500001", body: "Paid for " + ref + " UTR: " + utr, mediaUrl: "/uploads/whatsapp/screenshot_" + ref + ".jpg", mediaType: "IMAGE" }) }); const data = await res.json(); if (data.success) alert("WhatsApp payment proof received by webhook! Admin ticket created in queue."); } catch (e) { alert("Simulation webhook error"); }
}

async function requestWithdrawal() {
  const amt = document.getElementById("wdrAmountInput").value, type = document.getElementById("wdrTypeSelect").value, name = document.getElementById("wdrNameInput").value, vpa = document.getElementById("wdrVpaInput").value;
  try { const res = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }, body: JSON.stringify({ amount: amt, destinationType: type, accountHolderName: name, accountNumberOrVpa: vpa }) }); const data = await res.json(); if (data.success) { alert("Withdrawal request submitted! Funds locked via ledger pending manual payout."); fetchWallet(); } else alert("Withdrawal failed: " + data.message); } catch (e) { alert("Withdrawal error"); }
}

function connectWebSocket() {
  const socket = new SockJS("/ws"); stompClient = Stomp.over(socket); stompClient.debug = null;
  stompClient.connect({}, () => { stompClient.subscribe("/topic/games/aviator", msg => handleAviatorTick(JSON.parse(msg.body))); stompClient.subscribe("/topic/games/colour", msg => handleColourTick(JSON.parse(msg.body))); }, err => { console.warn("WebSocket disconnected, reconnecting in 3s...", err); setTimeout(connectWebSocket, 3000); });
}

let canvas, ctx;
function initAviatorCanvas() { canvas = document.getElementById("aviatorCanvas"); if (!canvas) return; ctx = canvas.getContext("2d"); resizeCanvas(); window.addEventListener("resize", resizeCanvas); }
function resizeCanvas() { if (!canvas) return; canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
function handleAviatorTick(state) {
  currentAviatorState = state; const multDisplay = document.getElementById("aviatorMultiplier"), sub = document.getElementById("aviatorStatusSubtitle"), seedSpan = document.getElementById("aviatorSeedHash");
  if (seedSpan) seedSpan.textContent = state.serverSeedHash.substring(0, 24) + "...";
  if (state.status === "BETTING") { multDisplay.classList.remove("crashed"); multDisplay.textContent = state.countdownSeconds + "s"; sub.textContent = "NEXT ROUND STARTS IN..."; document.getElementById("btnAviatorBet").disabled = false; document.getElementById("btnAviatorCashout").style.display = "none"; document.getElementById("aviatorNoBetNotice").style.display = "block"; clearCanvas(); }
  else if (state.status === "FLYING") { multDisplay.classList.remove("crashed"); multDisplay.textContent = Number(state.currentMultiplier).toFixed(2) + "x"; sub.textContent = "PLANE IS IN FLIGHT!"; document.getElementById("btnAviatorBet").disabled = true; if (activeAviatorBet) { document.getElementById("btnAviatorCashout").style.display = "block"; document.getElementById("aviatorNoBetNotice").style.display = "none"; document.getElementById("cashoutAmountDisplay").textContent = (activeAviatorBet.amount * state.currentMultiplier).toFixed(2); } renderAviatorFlight(state.currentMultiplier); }
  else if (state.status === "CRASHED") { multDisplay.classList.add("crashed"); multDisplay.textContent = Number(state.crashMultiplier || state.currentMultiplier).toFixed(2) + "x"; sub.textContent = "FLEW AWAY!"; document.getElementById("btnAviatorCashout").style.display = "none"; document.getElementById("btnAviatorBet").disabled = true; activeAviatorBet = null; renderCrashExplosion(); }
  if (state.recentHistory) { const ribbon = document.getElementById("aviatorHistoryRibbon"); ribbon.innerHTML = state.recentHistory.map(m => { const cls = m < 2.0 ? "pill-low" : (m < 10.0 ? "pill-med" : "pill-high"); return `<span class="history-pill ${cls}">${Number(m).toFixed(2)}x</span>`; }).join(""); }
}
function renderAviatorFlight(mult) { if (!ctx || !canvas) return; ctx.clearRect(0,0,canvas.width,canvas.height); const w=canvas.width,h=canvas.height,progress=Math.min(1,(mult-1)/10),endX=w*0.1+progress*(w*0.75),endY=h*0.85-Math.pow(progress,1.2)*(h*0.65); ctx.beginPath(); ctx.moveTo(w*0.05,h*0.85); ctx.quadraticCurveTo(endX*0.6,h*0.85,endX,endY); ctx.strokeStyle="#f43f5e"; ctx.lineWidth=4; ctx.stroke(); ctx.fillStyle="#f59e0b"; ctx.beginPath(); ctx.arc(endX,endY,12,0,Math.PI*2); ctx.fill(); }
function renderCrashExplosion() { if (!ctx || !canvas) return; ctx.fillStyle="rgba(244, 63, 94, 0.25)"; ctx.fillRect(0,0,canvas.width,canvas.height); }
function clearCanvas() { if (!ctx || !canvas) return; ctx.clearRect(0,0,canvas.width,canvas.height); }

async function placeAviatorBet() {
  if (!token) { openModal("loginModal"); return; } const amt=document.getElementById("aviatorBetAmount").value, auto=document.getElementById("aviatorAutoCashout").value||null;
  try { const res=await fetch("/api/games/aviator/bet",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({roundUuid:currentAviatorState.roundUuid,amount:amt,autoCashoutMultiplier:auto})}); const data=await res.json(); if(data.success){activeAviatorBet={betUuid:data.data.bet.betUuid,amount:amt};document.getElementById("btnAviatorBet").disabled=true;fetchWallet();}else alert("Bet error: "+data.message);} catch(e){alert("Failed to place bet");}
}
async function cashoutAviator() { if(!activeAviatorBet)return; try{const res=await fetch("/api/games/aviator/cashout",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({betUuid:activeAviatorBet.betUuid})});const data=await res.json();if(data.success){alert("Cashed out ₹"+data.data.bet.payoutAmount+" at "+data.data.cashedOutMultiplier+"x!");activeAviatorBet=null;document.getElementById("btnAviatorCashout").style.display="none";fetchWallet();}else alert("Cashout error: "+data.message);}catch(e){alert("Cashout failed");} }

function handleColourTick(state) { currentColourState=state; document.getElementById("colourRoundUuid").textContent=state.roundUuid; const timer=document.getElementById("colourTimerBadge"); timer.textContent="00:"+(state.secondsRemaining<10?"0":"")+state.secondsRemaining; if(state.status==="LOCKED"){timer.className="badge badge-rejected";timer.textContent="LOCKED ("+state.secondsRemaining+"s)";}else if(state.status==="RESULT"){timer.className="badge badge-verified";timer.textContent="RESULT: "+state.winningNumber+" ("+state.winningColor+")";}else timer.className="badge badge-approved"; if(state.recentResults){document.getElementById("colourHistoryRibbon").innerHTML=state.recentResults.map(r=>{const cls=r.color.includes("GREEN")?"btn-green":(r.color.includes("RED")?"btn-red":"btn-violet");return `<span class="history-pill ${cls}" style="padding: 0.35rem 0.75rem; border-radius: 8px;">${r.number}</span>`;}).join("");} }
function openColourBetModal(type,val){if(!token){openModal("loginModal");return;}selectedColourTarget={type,value:val};document.getElementById("modalBetTarget").textContent=val;document.getElementById("modalBetMultiplier").textContent=type==="NUMBER"?"9.0x":(val==="VIOLET"?"4.5x":"2.0x");openModal("colourBetModal");}
async function confirmColourBet(){const amt=document.getElementById("colourModalAmount").value;try{const res=await fetch("/api/games/colour/bet",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({roundUuid:currentColourState.roundUuid,targetType:selectedColourTarget.type,targetValue:selectedColourTarget.value,amount:amt})});const data=await res.json();if(data.success){alert("Bet placed on "+selectedColourTarget.value+"!");closeModal("colourBetModal");fetchWallet();}else alert("Bet error: "+data.message);}catch(e){alert("Failed to submit bet");}}

async function createLudoMatch(){if(!token){openModal("loginModal");return;}const stake=document.getElementById("ludoStakeSelect").value;try{const res=await fetch("/api/games/ludo/rooms",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({stakeAmount:stake,maxPlayers:2})});const data=await res.json();if(data.success){currentLudoMatch=data.data;document.getElementById("ludoLobbySection").style.display="none";document.getElementById("ludoGameSection").style.display="block";document.getElementById("txtLudoMatchUuid").textContent=currentLudoMatch.matchUuid;document.getElementById("txtLudoPot").textContent=Number(currentLudoMatch.totalPot).toFixed(2);drawLudoBoard();stompClient.subscribe("/topic/games/ludo/"+currentLudoMatch.matchUuid,msg=>updateLudoGameState(JSON.parse(msg.body)));fetchWallet();}else alert("Ludo room error: "+data.message);}catch(e){alert("Error creating match");}}
async function rollLudoDice(){if(!currentLudoMatch)return;try{const res=await fetch("/api/games/ludo/rooms/"+currentLudoMatch.matchUuid+"/roll",{method:"POST",headers:{"Authorization":"Bearer "+token}});const data=await res.json();if(data.success){alert("You rolled a "+data.data.diceRoll+"!");renderPawnButtons(data.data.movableTokenIndices);}else alert("Roll error: "+data.message);}catch(e){alert("Failed to roll dice");}}
function renderPawnButtons(movable){const container=document.getElementById("ludoTokenButtons");container.innerHTML="";if(!movable||movable.length===0)return;movable.forEach(idx=>{const btn=document.createElement("button");btn.className="btn btn-primary";btn.textContent="Move Pawn #"+(idx+1);btn.onclick=()=>moveLudoPawn(idx);container.appendChild(btn);});}
async function moveLudoPawn(tokenIndex){try{const res=await fetch("/api/games/ludo/rooms/move",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({matchUuid:currentLudoMatch.matchUuid,tokenIndex})});const data=await res.json();if(data.success){document.getElementById("ludoTokenButtons").innerHTML="";updateLudoGameState(data.data);}}catch(e){alert("Error moving pawn");}}
function updateLudoGameState(state){document.getElementById("txtLudoTurnColor").textContent=state.currentTurnColor;document.getElementById("txtLudoPot").textContent=Number(state.totalPot).toFixed(2);drawLudoBoard(state.tokenPositions);if(state.status==="COMPLETED"){alert("Match finished! Winner: "+state.winnerColor+" (₹"+state.winnerPayout+")");fetchWallet();}}
function drawLudoBoard(positions){const canvas=document.getElementById("ludoCanvas");if(!canvas)return;const ctx=canvas.getContext("2d"),s=canvas.width;ctx.fillStyle="#1e293b";ctx.fillRect(0,0,s,s);ctx.fillStyle="#ef4444";ctx.fillRect(0,0,s*0.4,s*0.4);ctx.fillStyle="#10b981";ctx.fillRect(s*0.6,0,s*0.4,s*0.4);ctx.fillStyle="#eab308";ctx.fillRect(s*0.6,s*0.6,s*0.4,s*0.4);ctx.fillStyle="#3b82f6";ctx.fillRect(0,s*0.6,s*0.4,s*0.4);ctx.fillStyle="#f8fafc";ctx.beginPath();ctx.arc(s/2,s/2,s*0.1,0,Math.PI*2);ctx.fill();}

async function submitKycForm(){if(!token){openModal("loginModal");return;}const docType=document.getElementById("kycDocType").value,num=document.getElementById("kycDocNumber").value,front=document.getElementById("kycFrontUrl").value,selfie=document.getElementById("kycSelfieUrl").value;try{const res=await fetch("/api/users/kyc/upload",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({documentType:docType,documentNumber:num,documentFrontUrl:front,selfieUrl:selfie})});const data=await res.json();if(data.success)alert("KYC documents submitted successfully. Status: PENDING review by compliance.");else alert("KYC error: "+data.message);}catch(e){alert("Error submitting KYC");}}
async function updateLimits(){const dep=document.getElementById("limitDepositInput").value,loss=document.getElementById("limitLossInput").value;try{const res=await fetch("/api/users/limits",{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({dailyDepositLimit:dep,dailyLossLimit:loss})});const data=await res.json();if(data.success)alert("Responsible gaming limits updated!");}catch(e){alert("Error updating limits");}}
async function requestSelfExclusion(){if(!confirm("Are you sure? You will be blocked from depositing and placing bets for 24 hours."))return;try{const res=await fetch("/api/users/self-exclude",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({exclusionType:"COOL_OFF",durationHours:24,reason:"User break"})});const data=await res.json();if(data.success){alert("Account is now in 24-hour cool-off period. Logging out.");logout();}}catch(e){alert("Self-exclusion error");}}

// ----------------------------------------------------
// Mobile-first navigation enhancement
// ----------------------------------------------------
(function setupMobileNavigation() {
  function initialize() {
    const main = document.querySelector('main.container');
    if (!main || document.getElementById('mobile-home')) return;

    const home = document.createElement('section');
    home.id = 'mobile-home';
    home.className = 'mobile-page mobile-home';
    home.setAttribute('aria-label', 'Home');

    const games = document.createElement('section');
    games.id = 'mobile-games';
    games.className = 'mobile-page mobile-games';

    ['.announcement', '.hero-stats', '.promo-panel', '.reward-grid', '.money-actions'].forEach(selector => {
      const el = main.querySelector(selector);
      if (el) home.appendChild(el);
    });

    const gameSummary = main.querySelector('.game-summary-grid');
    if (gameSummary) games.appendChild(gameSummary);

    const oldTabs = main.querySelector('.tabs-header');
    if (oldTabs) oldTabs.remove();

    const firstTab = main.querySelector('.tab-content');
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
        <button class="bottom-nav-btn active" onclick="switchTab('home')" data-tab="home" aria-label="Home"><span>⌂</span>Home</button>
        <button class="bottom-nav-btn" onclick="switchTab('games')" data-tab="games" aria-label="Games"><span>G</span>Games</button>
        <button class="bottom-nav-btn center-action" onclick="switchTab('deposit')" data-tab="deposit" aria-label="Deposit"><span>Rs</span>Deposit</button>
        <button class="bottom-nav-btn" onclick="switchTab('wallet')" data-tab="wallet" aria-label="Wallet"><span>W</span>Wallet</button>`;
    }

    const originalSwitchTab = window.switchTab;
    function setActive(tab) { document.querySelectorAll('.bottom-nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab)); }
    function hideAll() { document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none'); home.style.display = 'none'; games.style.display = 'none'; }
    function showPage(page) { hideAll(); (page === 'home' ? home : games).style.display = 'block'; setActive(page); window.scrollTo({top:0, behavior:'smooth'}); }

    window.switchTab = function(tabId) {
      if (tabId === 'home' || tabId === 'games') { showPage(tabId); return; }
      if (tabId === 'deposit') { originalSwitchTab('wallet'); setActive('deposit'); return; }
      originalSwitchTab(tabId);
      setActive(tabId === 'wallet' ? 'wallet' : tabId);
      window.scrollTo({top:0, behavior:'smooth'});
    };

    const style = document.createElement('style');
    style.textContent = `
      .mobile-page { width: 100%; }
      .mobile-games { display: none; }
      .tabs-header { display: none !important; }
      .bottom-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .bottom-nav-btn { min-width: 0; touch-action: manipulation; }
      @media (max-width: 700px) {
        main.container { padding-bottom: calc(var(--bottom-nav-height) + 32px); }
        .mobile-page { min-height: calc(100vh - var(--bottom-nav-height)); }
        .game-summary-grid { margin-top: 0; }
      }
    `;
    document.head.appendChild(style);
    showPage('home');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
