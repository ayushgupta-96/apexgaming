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
function togglePassword(id, button) { const input = document.getElementById(id); if (!input) return; input.type = input.type === "password" ? "text" : "password"; if (button) button.textContent = input.type === "password" ? "◉" : "◌"; }
function safeJsonResponse(res) { return res.json().catch(() => ({ success: false, message: "Invalid server response" })); }

async function doLogin() {
  const u = document.getElementById("loginUsername")?.value.trim();
  const p = document.getElementById("loginPassword")?.value;
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
  const u = document.getElementById("regUsername")?.value.trim();
  const ph = document.getElementById("regPhone")?.value.trim();
  const email = document.getElementById("regEmail")?.value.trim() || null;
  const dob = document.getElementById("regDob")?.value;
  const st = document.getElementById("regState")?.value;
  const pwd = document.getElementById("regPassword")?.value;
  const confirmPwd = document.getElementById("regConfirmPassword")?.value;
  const age = document.getElementById("regAgeConfirm")?.checked;
  if (!u || !ph || !dob || !st || !pwd || !confirmPwd) { alert("Please complete all required registration fields."); return; }
  if (pwd.length < 8) { alert("Password must be at least 8 characters."); return; }
  if (pwd !== confirmPwd) { alert("Passwords do not match."); return; }
  if (!age) { alert("You must confirm that you are 18+ and legally eligible."); return; }
  try {
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, phoneNumber: ph, email, firstName: u, lastName: null, dateOfBirth: dob, state: st, password: pwd, ageConfirmed: true }) });
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
      [
        ["txtDepositBal", w.depositBalance], ["txtWinningsBal", w.winningsBalance], ["txtBonusBal", w.bonusBalance],
        ["txtWithdrawableBal", w.winningsBalance], ["walletDepositBalance", w.depositBalance], ["walletWinningsBalance", w.winningsBalance], ["walletBonusBalance", w.bonusBalance]
      ].forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = Number(value).toFixed(2); });
    }
  } catch (e) { console.error("Wallet error", e); }
}

async function initiateDeposit() {
  if (!token) { window.location.href = "/"; return; }
  const input = document.getElementById("depositAmountInput"); if (!input) return;
  try {
    const res = await fetch("/api/deposits", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }, body: JSON.stringify({ amount: input.value, paymentMethod: "UPI" }) });
    const data = await safeJsonResponse(res);
    if (data.success) {
      const dep = data.data;
      { const el = document.getElementById("dispDepRefCode"); if (el) el.textContent = dep.referenceCode; }
      { const el = document.getElementById("dispOfficialUpi"); if (el) el.textContent = dep.officialUpiId; }
      { const el = document.getElementById("dispOfficialAccount"); if (el) el.textContent = dep.officialAccountNo + " (" + dep.officialBankName + ")"; }
      { const el = document.getElementById("dispOfficialIfsc"); if (el) el.textContent = dep.officialIfsc; }
      { const el = document.getElementById("lnkWhatsApp"); if (el) el.href = dep.whatsAppLink; }
      { const el = document.getElementById("depositResultBox"); if (el) el.style.display = "block"; }
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
function initAviatorCanvas() { canvas = document.getElementById("aviatorCanvas"); if (!canvas) return; ctx = canvas.getContext("2d"); resizeCanvas(); window.addEventListener("resize", resizeCanvas); }
function resizeCanvas() { if (!canvas) return; canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
function handleAviatorTick(state) { currentAviatorState=state; const mult=document.getElementById("aviatorMultiplier"),sub=document.getElementById("aviatorStatusSubtitle"),seed=document.getElementById("aviatorSeedHash"); if(!mult||!sub)return; if(seed&&state.serverSeedHash)seed.textContent=state.serverSeedHash.substring(0,24)+"..."; if(state.status==="BETTING"){mult.classList.remove("crashed");mult.textContent=state.countdownSeconds+"s";sub.textContent="NEXT ROUND STARTS IN...";}else if(state.status==="FLYING"){mult.classList.remove("crashed");mult.textContent=Number(state.currentMultiplier).toFixed(2)+"x";sub.textContent="PLANE IS IN FLIGHT!";renderAviatorFlight(state.currentMultiplier);}else if(state.status==="CRASHED"){mult.classList.add("crashed");mult.textContent=Number(state.crashMultiplier||state.currentMultiplier).toFixed(2)+"x";sub.textContent="FLEW AWAY!";renderCrashExplosion();} const ribbon=document.getElementById("aviatorHistoryRibbon"); if(ribbon&&state.recentHistory) ribbon.innerHTML=state.recentHistory.map(m=>`<span class="history-pill">${Number(m).toFixed(2)}x</span>`).join(""); }
function renderAviatorFlight(mult){if(!ctx||!canvas)return;ctx.clearRect(0,0,canvas.width,canvas.height);const w=canvas.width,h=canvas.height,p=Math.min(1,(mult-1)/10),x=w*.1+p*w*.75,y=h*.85-Math.pow(p,1.2)*h*.65;ctx.beginPath();ctx.moveTo(w*.05,h*.85);ctx.quadraticCurveTo(x*.6,h*.85,x,y);ctx.strokeStyle="#f43f5e";ctx.lineWidth=4;ctx.stroke();ctx.fillStyle="#f59e0b";ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();}
function renderCrashExplosion(){if(!ctx||!canvas)return;ctx.fillStyle="rgba(244,63,95,.25)";ctx.fillRect(0,0,canvas.width,canvas.height)}
function clearCanvas(){if(ctx&&canvas)ctx.clearRect(0,0,canvas.width,canvas.height)}
async function placeAviatorBet(){if(!token){openModal("loginModal");return;}if(!currentAviatorState)return;const amt=document.getElementById("aviatorBetAmount")?.value,auto=document.getElementById("aviatorAutoCashout")?.value||null;try{const res=await fetch("/api/games/aviator/bet",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({roundUuid:currentAviatorState.roundUuid,amount:amt,autoCashoutMultiplier:auto})});const data=await safeJsonResponse(res);if(data.success){activeAviatorBet={betUuid:data.data.bet.betUuid,amount:Number(amt)};fetchWallet();}else alert("Bet error: "+(data.message||"Unknown error"));}catch(e){alert("Failed to place bet");}}
async function cashoutAviator(){if(!activeAviatorBet)return;try{const res=await fetch("/api/games/aviator/cashout",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({betUuid:activeAviatorBet.betUuid})});const data=await safeJsonResponse(res);if(data.success){alert("Cashed out successfully!");activeAviatorBet=null;fetchWallet();}else alert("Cashout error: "+(data.message||"Unknown error"));}catch(e){alert("Cashout failed");}}
function handleColourTick(state){currentColourState=state;const round=document.getElementById("colourRoundUuid"),timer=document.getElementById("colourTimerBadge");if(!round||!timer)return;round.textContent=state.roundUuid;timer.textContent="00:"+(state.secondsRemaining<10?"0":"")+state.secondsRemaining;if(state.status==="LOCKED"){timer.className="badge badge-rejected";timer.textContent="LOCKED ("+state.secondsRemaining+"s)";}else if(state.status==="RESULT"){timer.className="badge badge-verified";timer.textContent="RESULT: "+state.winningNumber+" ("+state.winningColor+")";}else timer.className="badge badge-approved";const ribbon=document.getElementById("colourHistoryRibbon");if(ribbon&&state.recentResults)ribbon.innerHTML=state.recentResults.map(r=>`<span class="history-pill">${r.number}</span>`).join("");}
function openColourBetModal(type,val){if(!token){openModal("loginModal");return;}selectedColourTarget={type,value:val};document.getElementById("modalBetTarget").textContent=val;document.getElementById("modalBetMultiplier").textContent=type==="NUMBER"?"9.0x":(val==="VIOLET"?"4.5x":"2.0x");openModal("colourBetModal");}
async function confirmColourBet(){const amt=document.getElementById("colourModalAmount")?.value;try{const res=await fetch("/api/games/colour/bet",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({roundUuid:currentColourState.roundUuid,targetType:selectedColourTarget.type,targetValue:selectedColourTarget.value,amount:amt})});const data=await safeJsonResponse(res);if(data.success){alert("Bet placed!");closeModal("colourBetModal");fetchWallet();}else alert("Bet error: "+(data.message||"Unknown error"));}catch(e){alert("Failed to submit bet");}}
async function createLudoMatch(){if(!token){openModal("loginModal");return;}const stake=document.getElementById("ludoStakeSelect")?.value;try{const res=await fetch("/api/games/ludo/rooms",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({stakeAmount:stake,maxPlayers:2})});const data=await safeJsonResponse(res);if(data.success){currentLudoMatch=data.data;document.getElementById("ludoLobbySection").style.display="none";document.getElementById("ludoGameSection").style.display="block";drawLudoBoard();fetchWallet();}else alert("Ludo room error: "+(data.message||"Unknown error"));}catch(e){alert("Error creating match");}}
async function rollLudoDice(){if(!currentLudoMatch)return;try{const res=await fetch("/api/games/ludo/rooms/"+currentLudoMatch.matchUuid+"/roll",{method:"POST",headers:{"Authorization":"Bearer "+token}});const data=await safeJsonResponse(res);if(data.success){alert("You rolled a "+data.data.diceRoll+"!");renderPawnButtons(data.data.movableTokenIndices);}else alert("Roll error: "+(data.message||"Unknown error"));}catch(e){alert("Failed to roll dice");}}
function renderPawnButtons(movable){const container=document.getElementById("ludoTokenButtons");if(!container)return;container.innerHTML="";(movable||[]).forEach(idx=>{const btn=document.createElement("button");btn.className="btn btn-primary";btn.textContent="Move Pawn #"+(idx+1);btn.onclick=()=>moveLudoPawn(idx);container.appendChild(btn);});}
async function moveLudoPawn(tokenIndex){if(!currentLudoMatch)return;try{const res=await fetch("/api/games/ludo/rooms/move",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({matchUuid:currentLudoMatch.matchUuid,tokenIndex})});const data=await safeJsonResponse(res);if(data.success){const box=document.getElementById("ludoTokenButtons");if(box)box.innerHTML="";updateLudoGameState(data.data);}}catch(e){alert("Error moving pawn");}}
function updateLudoGameState(state){const turn=document.getElementById("txtLudoTurnColor"),pot=document.getElementById("txtLudoPot");if(turn)turn.textContent=state.currentTurnColor;if(pot)pot.textContent=Number(state.totalPot).toFixed(2);drawLudoBoard(state.tokenPositions);if(state.status==="COMPLETED"){alert("Match finished!");fetchWallet();}}
function drawLudoBoard(){const canvas=document.getElementById("ludoCanvas");if(!canvas)return;const c=canvas.getContext("2d"),s=canvas.width;c.fillStyle="#1e293b";c.fillRect(0,0,s,s);c.fillStyle="#ef4444";c.fillRect(0,0,s*.4,s*.4);c.fillStyle="#10b981";c.fillRect(s*.6,0,s*.4,s*.4);c.fillStyle="#eab308";c.fillRect(s*.6,s*.6,s*.4,s*.4);c.fillStyle="#3b82f6";c.fillRect(0,s*.6,s*.4,s*.4);c.fillStyle="#f8fafc";c.beginPath();c.arc(s/2,s/2,s*.1,0,Math.PI*2);c.fill();}
async function submitKycForm(){if(!token){openModal("loginModal");return;}try{const res=await fetch("/api/users/kyc/upload",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({documentType:document.getElementById("kycDocType")?.value,documentNumber:document.getElementById("kycDocNumber")?.value,documentFrontUrl:document.getElementById("kycFrontUrl")?.value,selfieUrl:document.getElementById("kycSelfieUrl")?.value})});const data=await safeJsonResponse(res);if(data.success)alert("KYC submitted.");else alert("KYC error: "+(data.message||"Unknown error"));}catch(e){alert("Error submitting KYC");}}
async function updateLimits(){if(!token){openModal("loginModal");return;}try{const res=await fetch("/api/users/limits",{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({dailyDepositLimit:document.getElementById("limitDepositInput")?.value,dailyLossLimit:document.getElementById("limitLossInput")?.value})});const data=await safeJsonResponse(res);if(data.success)alert("Responsible gaming limits updated!");else alert("Unable to update limits");}catch(e){alert("Error updating limits");}}
async function requestSelfExclusion(){if(!token){openModal("loginModal");return;}if(!confirm("Are you sure? You will be blocked from depositing and placing bets for 24 hours."))return;try{const res=await fetch("/api/users/self-exclude",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({exclusionType:"COOL_OFF",durationHours:24,reason:"User break"})});const data=await safeJsonResponse(res);if(data.success){alert("Account is now in 24-hour cool-off period. Logging out.");logout();}}catch(e){alert("Self-exclusion error");}}

const catalog={
  popular:[['Fortune Garuda 500','fortune'],['Lucky Jaguar 500','lucky'],['Fortune Gems 4','gems4'],['Phoenix Legend','phoenix'],['Fortune Gems 2','gems2'],['Fortune Gems 3','gems3'],['Cash Machine','cash'],['Double Diamonds','diamonds']],
  lottery:[['Wingo','wingo'],['K3','k3'],['5D','5d'],['Trx Wingo','trx'],['Moto Racing','moto']],
  mini:[['Aviator','aviator'],['Aviator Red','aviator-red'],['Cricket','cricket'],['Go Rush','gorush'],['Limbo','limbo'],['Mines','mines'],['Mines Classic','mines2'],['Limbo Space','limbo2']],
  slots:[['Phoenix Legend','phoenix'],['Double Diamonds','diamonds'],['Blessing of Shiva','shiva'],['Fruit 777','fruit'],['Cyber Viper','viper'],['Regal 777','regal'],['Classic 777','classic'],['Gold Rush','gold']],
  fishing:[['Jackpot Fishing','jackpot'],['Dracon Master','dracon'],['One Shot Fishing','oneshot'],['Happy Fishing','happy'],['Royal Fishing','royal'],['Mega Fishing','mega'],['Dragon Master','dragon'],['Bombing Fishing','bomb']]
};
function cardHTML(game){const click=game[1].includes("aviator")?"switchTab('aviator')":"switchTab('games')";return `<button class="catalog-card ${game[1]}" onclick="${click}"><div class="catalog-art"><span>${game[0].split(' ').slice(0,2).map(x=>x[0]).join('')}</span></div><b>${game[0]}</b></button>`;}

function setupMobileNavigation(){
  const home=document.querySelector('.mobile-home-shell');
  const games=document.getElementById('mobile-games');
  if(!home||!games)return;
  const originalSwitchTab=window.switchTab;
  window.switchTab=function(tabId){
    if(tabId==='home'){document.querySelectorAll('.tab-content').forEach(el=>el.style.display='none');home.style.display='block';games.style.display='none';setNavActive('home');window.scrollTo(0,0);return;}
    if(tabId==='games'){document.querySelectorAll('.tab-content').forEach(el=>el.style.display='none');home.style.display='none';games.style.display='block';setNavActive('games');window.scrollTo(0,0);return;}
    if(tabId==='deposit'){window.location.href='/deposit.html';return;}
    if(tabId==='wallet'){window.location.href='/wallet.html';return;}
    home.style.display='none';games.style.display='none';originalSwitchTab(tabId);setNavActive(tabId);window.scrollTo(0,0);
  };
  const target=document.getElementById('categoryGames');
  if(target)target.innerHTML=catalog.popular.map(cardHTML).join('');
  const large=document.getElementById('gamesCatalogLarge');
  if(large)large.innerHTML=[...catalog.lottery,...catalog.mini,...catalog.slots,...catalog.fishing].map(cardHTML).join('');
  setNavActive('home');
}
function setNavActive(tab){document.querySelectorAll('.bottom-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===tab));}
