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

/* =========================================================
   Aviator — Senior-Dev Vector Aircraft Flight Engine
   ========================================================= */
let canvas, ctx;

let aviatorStatus = "CONNECTING"; // BETTING | FLYING | CRASHED | CONNECTING
let targetMultiplier = 1.0;
let displayedMultiplier = 1.0;
let flightStartTimestamp = 0;
let lastFrameTime = performance.now();
let aviatorAnimFrame = null;
let canvasW = 600;
let canvasH = 340;
let dpr = 1;

// Plane dynamic physics & telemetry
const plane = {
  x: 50,
  y: 280,
  angle: -0.15,
  scale: 1,
  exhaustThrust: 1,
  propellerAngle: 0,
  flewAwayVelocityX: 0,
  flewAwayVelocityY: 0,
  flewAwayAlpha: 1,
  crashedAt: 0
};

// Particles (smoke puffs, sparks, speed streaks, shockwaves)
let smokePuffs = [];
let sparks = [];
let windStreaks = [];
let shockwaves = [];

function initAviatorCanvas() {
  canvas = document.getElementById("flightCanvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");

  // Initialize wind speed streaks
  windStreaks = [];
  for (let i = 0; i < 20; i++) {
    windStreaks.push({
      x: Math.random() * (canvasW || 600),
      y: Math.random() * (canvasH || 340),
      len: 18 + Math.random() * 35,
      speed: 3 + Math.random() * 5,
      alpha: 0.12 + Math.random() * 0.22
    });
  }

  resizeCanvas();
  window.removeEventListener("resize", resizeCanvas);
  window.addEventListener("resize", resizeCanvas);

  if (window.ResizeObserver && canvas.parentElement) {
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(canvas.parentElement);
  }

  window.resizeAviatorCanvas = resizeCanvas;

  if (!aviatorAnimFrame) {
    lastFrameTime = performance.now();
    aviatorAnimFrame = requestAnimationFrame(animateAviatorFrame);
  }
}

function resizeCanvas() {
  if (!canvas || !canvas.parentElement) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  dpr = window.devicePixelRatio || 1;
  canvasW = rect.width;
  canvasH = rect.height;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";

  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function handleAviatorTick(state) {
  currentAviatorState = state;
  const multEl = document.getElementById("multiplier-display");
  const subEl = document.getElementById("aviatorStatusSubtitle");
  const seedEl = document.getElementById("aviatorSeedHash");

  if (seedEl && state.serverSeedHash) {
    seedEl.textContent = "Seed: " + state.serverSeedHash.substring(0, 24) + "...";
  }

  const prevStatus = aviatorStatus;
  aviatorStatus = state.status || "CONNECTING";

  if (state.status === "BETTING") {
    if (multEl) {
      multEl.classList.remove("crashed");
      multEl.textContent = (state.countdownSeconds != null ? state.countdownSeconds : "5") + "s";
    }
    if (subEl) {
      subEl.className = "display-status-text";
      subEl.textContent = "WAITING FOR NEXT ROUND...";
    }
    targetMultiplier = 1.0;
    displayedMultiplier = 1.0;
    plane.flewAwayAlpha = 1;
    plane.crashedAt = 0;

    // Reset uncached bets if round ended
    if (prevStatus === "CRASHED" && activeAviatorBet) {
      activeAviatorBet = null;
      const cashout = document.getElementById("btnAviatorCashout");
      const notice = document.getElementById("aviatorNoBetNotice");
      if (cashout) cashout.style.display = "none";
      if (notice) notice.style.display = "block";
    }
  } else if (state.status === "FLYING") {
    if (multEl) multEl.classList.remove("crashed");
    if (subEl) {
      subEl.className = "display-status-text flying";
      subEl.textContent = "PLANE IS IN FLIGHT!";
    }
    targetMultiplier = Number(state.currentMultiplier) || 1.0;
    if (prevStatus !== "FLYING") {
      flightStartTimestamp = performance.now();
      displayedMultiplier = 1.0;
      plane.flewAwayAlpha = 1;
      plane.crashedAt = 0;
    }
  } else if (state.status === "CRASHED") {
    const crashVal = Number(state.crashMultiplier || state.currentMultiplier || 1.0);
    targetMultiplier = crashVal;
    displayedMultiplier = crashVal;
    if (multEl) {
      multEl.classList.add("crashed");
      multEl.textContent = crashVal.toFixed(2) + "x";
    }
    if (subEl) {
      subEl.className = "display-status-text crashed";
      subEl.textContent = "FLEW AWAY!";
    }

    if (prevStatus !== "CRASHED") {
      plane.crashedAt = performance.now();
      // Shockwave burst
      shockwaves.push({
        x: plane.x,
        y: plane.y,
        radius: 12,
        maxRadius: Math.min(canvasW, canvasH) * 0.45,
        alpha: 0.95
      });
      // Spark explosion
      for (let i = 0; i < 24; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 8;
        sparks.push({
          x: plane.x,
          y: plane.y,
          vx: Math.cos(ang) * spd + 2,
          vy: Math.sin(ang) * spd - 2,
          size: 2 + Math.random() * 3,
          alpha: 1,
          decay: 0.02 + Math.random() * 0.03,
          color: Math.random() > 0.4 ? "#facc15" : "#ff2a55"
        });
      }
    }
  }

  // Update history ribbon
  const ribbon = document.getElementById("aviatorHistoryRibbon");
  if (ribbon && state.recentHistory && state.recentHistory.length) {
    ribbon.innerHTML = state.recentHistory.map(m => {
      const val = Number(m) || 1;
      const tier = val >= 10 ? "tier-high" : (val >= 2 ? "tier-mid" : "tier-low");
      return `<span class="history-pill ${tier}">${val.toFixed(2)}x</span>`;
    }).join("");
  }

  if (!aviatorAnimFrame) {
    lastFrameTime = performance.now();
    aviatorAnimFrame = requestAnimationFrame(animateAviatorFrame);
  }
}

/* ─── Vector Plane Drawing ─── */
function drawAviatorPlane(ctx, x, y, angle, scale, thrust, propAngle, status) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // 1. Jet Exhaust Flame (Rear engine thruster)
  if (status === "FLYING" || status === "CRASHED" || status === "BETTING") {
    ctx.save();
    const flameBaseX = -26;
    const thrustPower = status === "CRASHED" ? 1.85 : (status === "BETTING" ? 0.35 : thrust);
    const flameLen = (18 + Math.sin(performance.now() * 0.035) * 5) * thrustPower;
    const flameW = 5 + thrustPower * 2.5;

    // Outer flame glow
    ctx.beginPath();
    ctx.moveTo(flameBaseX, -flameW * 0.8);
    ctx.quadraticCurveTo(flameBaseX - flameLen * 0.6, -flameW, flameBaseX - flameLen, 0);
    ctx.quadraticCurveTo(flameBaseX - flameLen * 0.6, flameW, flameBaseX, flameW * 0.8);
    ctx.closePath();
    const outGrad = ctx.createLinearGradient(flameBaseX, 0, flameBaseX - flameLen, 0);
    outGrad.addColorStop(0, "rgba(255, 60, 40, 0.85)");
    outGrad.addColorStop(0.5, "rgba(249, 115, 22, 0.6)");
    outGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = outGrad;
    ctx.fill();

    // Inner hot core flame (yellow/white)
    ctx.beginPath();
    ctx.moveTo(flameBaseX, -flameW * 0.45);
    ctx.quadraticCurveTo(flameBaseX - flameLen * 0.4, -flameW * 0.5, flameBaseX - flameLen * 0.65, 0);
    ctx.quadraticCurveTo(flameBaseX - flameLen * 0.4, flameW * 0.5, flameBaseX, flameW * 0.45);
    ctx.closePath();
    const inGrad = ctx.createLinearGradient(flameBaseX, 0, flameBaseX - flameLen * 0.65, 0);
    inGrad.addColorStop(0, "#ffffff");
    inGrad.addColorStop(0.4, "#fef08a");
    inGrad.addColorStop(1, "rgba(249, 115, 22, 0)");
    ctx.fillStyle = inGrad;
    ctx.fill();
    ctx.restore();
  }

  // 2. Far Wing (peeking over the top)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-2, -5);
  ctx.lineTo(-8, -19);
  ctx.lineTo(-14, -18);
  ctx.lineTo(-10, -5);
  ctx.closePath();
  ctx.fillStyle = "#991b1b";
  ctx.fill();
  ctx.restore();

  // 3. Tail Vertical Stabilizer (Fin)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-18, -3);
  ctx.lineTo(-26, -18);
  ctx.lineTo(-33, -17);
  ctx.lineTo(-24, -1);
  ctx.closePath();
  const tailGrad = ctx.createLinearGradient(-33, -18, -18, 0);
  tailGrad.addColorStop(0, "#dc2626");
  tailGrad.addColorStop(1, "#b91c1c");
  ctx.fillStyle = tailGrad;
  ctx.fill();

  // Tail white racing stripe
  ctx.beginPath();
  ctx.moveTo(-25, -16);
  ctx.lineTo(-28, -15.5);
  ctx.lineTo(-23, -2);
  ctx.lineTo(-20, -2);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fill();

  // Tail horizontal elevator
  ctx.beginPath();
  ctx.moveTo(-22, -1);
  ctx.lineTo(-30, 4);
  ctx.lineTo(-33, 3);
  ctx.lineTo(-25, 0);
  ctx.closePath();
  ctx.fillStyle = "#7f1d1d";
  ctx.fill();
  ctx.restore();

  // 4. Main Fuselage
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(27, 0);
  ctx.bezierCurveTo(24, -6, 12, -8, 2, -7);
  ctx.bezierCurveTo(-10, -7, -18, -4, -26, -2);
  ctx.lineTo(-26, 1);
  ctx.bezierCurveTo(-18, 4, -8, 7, 4, 6);
  ctx.bezierCurveTo(16, 5, 24, 3, 27, 0);
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(0, -8, 0, 7);
  bodyGrad.addColorStop(0, "#ff4466");
  bodyGrad.addColorStop(0.35, "#e11d48");
  bodyGrad.addColorStop(0.8, "#be123c");
  bodyGrad.addColorStop(1, "#881337");
  ctx.fillStyle = bodyGrad;
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(225, 29, 72, 0.4)";
  ctx.fill();
  ctx.shadowBlur = 0;

  // Specular reflection line along fuselage
  ctx.beginPath();
  ctx.moveTo(22, -2);
  ctx.quadraticCurveTo(8, -6, -18, -3);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // 5. Cockpit Canopy Glass
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(18, -2.5);
  ctx.bezierCurveTo(14, -7.5, 6, -7.5, 1, -3);
  ctx.closePath();
  const glassGrad = ctx.createLinearGradient(1, -7, 18, -2);
  glassGrad.addColorStop(0, "#38bdf8");
  glassGrad.addColorStop(0.6, "#0284c7");
  glassGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = glassGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Glass specular gloss glint
  ctx.beginPath();
  ctx.moveTo(15, -4);
  ctx.quadraticCurveTo(11, -6.5, 5, -5);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // 6. Near / Main Wing (Foreground)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(-4, 18);
  ctx.lineTo(-14, 17);
  ctx.lineTo(-6, 2);
  ctx.closePath();

  const wingGrad = ctx.createLinearGradient(-14, 18, 8, 2);
  wingGrad.addColorStop(0, "#b91c1c");
  wingGrad.addColorStop(0.6, "#e11d48");
  wingGrad.addColorStop(1, "#ff3366");
  ctx.fillStyle = wingGrad;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Wing aileron / panel lines
  ctx.beginPath();
  ctx.moveTo(-1, 14);
  ctx.lineTo(-9, 13.5);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // Wingtip navigation strobe light (green on starboard / main wing)
  const strobeAlpha = 0.6 + Math.sin(performance.now() * 0.01) * 0.4;
  ctx.beginPath();
  ctx.arc(-4, 18, 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(74, 222, 128, ${strobeAlpha})`;
  ctx.shadowColor = "#4ade80";
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();

  // 7. Nose Propeller Hub & Spinning Blades
  ctx.save();
  // Spinner nose cone
  ctx.beginPath();
  ctx.moveTo(26, -3);
  ctx.quadraticCurveTo(31, 0, 26, 3);
  ctx.closePath();
  ctx.fillStyle = "#7f1d1d";
  ctx.fill();

  // Propeller Disc Motion-Blur
  const discGrad = ctx.createRadialGradient(28, 0, 1, 28, 0, 18);
  discGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  discGrad.addColorStop(0.35, "rgba(255, 255, 255, 0.2)");
  discGrad.addColorStop(0.85, "rgba(255, 255, 255, 0.08)");
  discGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.beginPath();
  ctx.ellipse(28, 0, 3, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = discGrad;
  ctx.fill();

  // Fast spinning propeller blade hints
  const bladeCount = 2;
  for (let b = 0; b < bladeCount; b++) {
    const curAngle = propAngle + (b * Math.PI);
    const bladeY = Math.sin(curAngle) * 16;
    const bladeX = 28 + Math.cos(curAngle) * 1.5;
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(bladeX, bladeY);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Center chrome spinner point
  ctx.beginPath();
  ctx.arc(28, 0, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/* ─── Main Animation Frame Loop (60 FPS) ─── */
function animateAviatorFrame(now) {
  const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  if (ctx && canvas && canvasW > 0 && canvasH > 0) {
    ctx.clearRect(0, 0, canvasW, canvasH);

    const w = canvasW;
    const h = canvasH;
    const startX = w * 0.07;
    const startY = h * 0.85;

    // Advance propeller
    plane.propellerAngle += dt * 38;

    // Ambient altitude grid lines
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    for (let i = 1; i <= 4; i++) {
      const y = h * (0.15 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Runway ground line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.moveTo(0, startY + 2);
    ctx.lineTo(w, startY + 2);
    ctx.stroke();
    ctx.restore();

    // Speed wind streaks during flight
    if (aviatorStatus === "FLYING" || aviatorStatus === "CRASHED") {
      ctx.save();
      const speedMult = Math.min(displayedMultiplier, 8);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      windStreaks.forEach(s => {
        s.x -= (s.speed + speedMult * 1.5);
        if (s.x < -s.len) {
          s.x = w + Math.random() * 40;
          s.y = Math.random() * (h * 0.85);
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y);
        ctx.stroke();
      });
      ctx.restore();
    }

    if (aviatorStatus === "BETTING" || aviatorStatus === "CONNECTING") {
      // Resting on runway, propeller spinning, warm engine idle
      plane.x = startX + 18;
      plane.y = startY - 4;
      plane.angle = -0.06;
      plane.scale = 1;
      plane.exhaustThrust = 0.35;

      // Runway threshold marks
      ctx.save();
      ctx.fillStyle = "rgba(234, 34, 70, 0.35)";
      for (let k = 0; k < 4; k++) {
        ctx.fillRect(startX - 20 + k * 12, startY - 1, 6, 3);
      }
      ctx.restore();

      drawAviatorPlane(ctx, plane.x, plane.y, plane.angle, plane.scale, plane.exhaustThrust, plane.propellerAngle, "BETTING");
    } else if (aviatorStatus === "FLYING") {
      // Smoothly interpolate displayed multiplier towards target
      displayedMultiplier += (targetMultiplier - displayedMultiplier) * Math.min(1, dt * 8);

      const multDisplay = document.getElementById("multiplier-display");
      if (multDisplay && !multDisplay.classList.contains("crashed")) {
        multDisplay.textContent = displayedMultiplier.toFixed(2) + "x";
      }

      // Update cashout button value in real-time
      if (activeAviatorBet) {
        const cashoutAmt = document.getElementById("cashoutAmountDisplay");
        if (cashoutAmt) {
          cashoutAmt.textContent = (activeAviatorBet.amount * displayedMultiplier).toFixed(2);
        }
      }

      // Smooth flight trajectory curve calculation
      const m = Math.max(1, displayedMultiplier);
      const progress = Math.min((m - 1) / (m + 3), 0.86);

      const endX = startX + (w * 0.82) * progress;
      const liftPower = Math.pow(progress, 0.85);
      const endY = startY - (h * 0.72) * liftPower;
      const controlX = startX + (endX - startX) * 0.6;
      const controlY = startY;

      // Curve tangent vector
      const dx = endX - controlX;
      const dy = endY - controlY;
      let tangentAngle = Math.atan2(dy, dx);

      // Micro aerodynamic turbulence
      const wobble = Math.sin(now * 0.016) * 1.5;
      tangentAngle += Math.sin(now * 0.022) * 0.025;

      plane.x = endX;
      plane.y = endY + wobble;
      plane.angle = tangentAngle;
      plane.scale = 1;
      plane.exhaustThrust = 1 + Math.min(progress, 0.8);

      // 1. Draw glowing curve fill underneath
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(controlX, controlY, endX, plane.y);
      ctx.lineTo(endX, startY);
      ctx.closePath();

      const fillGrad = ctx.createLinearGradient(0, endY, 0, startY);
      fillGrad.addColorStop(0, "rgba(255, 42, 85, 0.28)");
      fillGrad.addColorStop(0.5, "rgba(234, 34, 70, 0.12)");
      fillGrad.addColorStop(1, "rgba(234, 34, 70, 0)");
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.restore();

      // 2. Draw neon flight curve line
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(controlX, controlY, endX, plane.y);
      ctx.strokeStyle = "rgba(255, 42, 85, 0.4)";
      ctx.lineWidth = 8;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#ff2a55";
      ctx.stroke();

      ctx.strokeStyle = "#ff2a55";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // 3. Emit exhaust smoke and embers
      const tailOffset = -26;
      const emitterX = plane.x + Math.cos(plane.angle) * tailOffset;
      const emitterY = plane.y + Math.sin(plane.angle) * tailOffset;

      if (Math.random() < 0.6) {
        smokePuffs.push({
          x: emitterX,
          y: emitterY,
          vx: -(Math.cos(plane.angle) * 2 + 1) + (Math.random() - 0.5),
          vy: -(Math.sin(plane.angle) * 1.5) + (Math.random() - 0.5),
          radius: 3 + Math.random() * 2,
          maxRadius: 18 + Math.random() * 8,
          alpha: 0.5,
          decay: 0.016 + Math.random() * 0.01
        });
      }

      if (Math.random() < 0.4) {
        sparks.push({
          x: emitterX,
          y: emitterY,
          vx: -Math.cos(plane.angle) * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2,
          vy: -Math.sin(plane.angle) * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2,
          size: 1.5 + Math.random() * 2,
          alpha: 1,
          decay: 0.03 + Math.random() * 0.02,
          color: Math.random() > 0.4 ? "#facc15" : "#f97316"
        });
      }

      // Draw the plane
      drawAviatorPlane(ctx, plane.x, plane.y, plane.angle, plane.scale, plane.exhaustThrust, plane.propellerAngle, "FLYING");
    } else if (aviatorStatus === "CRASHED") {
      // Plane accelerated away into the sky with rocket burst
      const elapsedCrash = plane.crashedAt ? (now - plane.crashedAt) : 0;
      const progress = Math.min((displayedMultiplier - 1) / (displayedMultiplier + 3), 0.86);
      const frozenEndX = startX + (w * 0.82) * progress;
      const frozenEndY = startY - (h * 0.72) * Math.pow(progress, 0.85);
      const controlX = startX + (frozenEndX - startX) * 0.6;
      const controlY = startY;

      // Draw frozen flight curve in dark crimson
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(controlX, controlY, frozenEndX, frozenEndY);
      ctx.lineTo(frozenEndX, startY);
      ctx.closePath();
      const frozenFill = ctx.createLinearGradient(0, frozenEndY, 0, startY);
      frozenFill.addColorStop(0, "rgba(225, 29, 72, 0.15)");
      frozenFill.addColorStop(1, "rgba(225, 29, 72, 0)");
      ctx.fillStyle = frozenFill;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(controlX, controlY, frozenEndX, frozenEndY);
      ctx.strokeStyle = "rgba(185, 28, 28, 0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Flew away zoom animation
      if (elapsedCrash < 1400) {
        const flySpd = 500 + elapsedCrash * 0.8;
        plane.x += Math.cos(plane.angle) * flySpd * dt;
        plane.y += Math.sin(plane.angle) * flySpd * dt;
        plane.scale = Math.max(0.4, 1 - (elapsedCrash / 1400) * 0.5);
        plane.flewAwayAlpha = Math.max(0, 1 - (elapsedCrash / 1300));

        // High intensity exhaust plume
        smokePuffs.push({
          x: plane.x,
          y: plane.y,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          radius: 6 + Math.random() * 4,
          maxRadius: 26,
          alpha: 0.6,
          decay: 0.02
        });

        ctx.save();
        ctx.globalAlpha = plane.flewAwayAlpha;
        drawAviatorPlane(ctx, plane.x, plane.y, plane.angle, plane.scale, 2.2, plane.propellerAngle, "CRASHED");
        ctx.restore();
      }
    }

    // Update and draw smoke puffs
    ctx.save();
    for (let i = smokePuffs.length - 1; i >= 0; i--) {
      const p = smokePuffs[i];
      p.x += p.vx;
      p.y += p.vy;
      p.radius += 0.25;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.radius >= p.maxRadius) {
        smokePuffs.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(234, 34, 70, ${p.alpha * 0.35})`;
      ctx.fill();
    }
    ctx.restore();

    // Update and draw sparks
    ctx.save();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.alpha -= s.decay;

      if (s.alpha <= 0) {
        sparks.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.alpha;
      ctx.fill();
    }
    ctx.restore();

    // Update and draw shockwaves
    ctx.save();
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 10);
      sw.alpha -= dt * 1.5;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius - 2) {
        shockwaves.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 42, 85, ${sw.alpha})`;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#ff2a55";
      ctx.stroke();
    }
    ctx.restore();
  }

  aviatorAnimFrame = requestAnimationFrame(animateAviatorFrame);
}

function clearCanvas() {
  targetMultiplier = 1.0;
  displayedMultiplier = 1.0;
  smokePuffs = [];
  sparks = [];
  shockwaves = [];
  if (ctx && canvas && canvasW > 0 && canvasH > 0) {
    ctx.clearRect(0, 0, canvasW, canvasH);
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
    if(tabId==='aviator'&&typeof resizeCanvas==='function'){
      requestAnimationFrame(resizeCanvas);
    }
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