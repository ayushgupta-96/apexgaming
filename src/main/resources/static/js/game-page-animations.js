/**
 * Apex Gaming — Premium Game Animations v2.0
 * Covers: card entrances, Aviator flight-path, Colour glow, Ludo dice,
 *         hero orb pulse, tab transitions, particles, shimmer loaders.
 */

/* ─── Staggered Card Entrance via IntersectionObserver ─── */
(function initCardEntrances() {
  const style = document.createElement('style');
  style.textContent = `
    .catalog-card{opacity:0;transform:translateY(24px) scale(.96);transition:opacity .45s cubic-bezier(.22,1,.36,1),transform .45s cubic-bezier(.22,1,.36,1);}
    .catalog-card.card-visible{opacity:1;transform:translateY(0) scale(1);}
    .catalog-card:hover{transform:translateY(-5px) scale(1.03)!important;box-shadow:0 18px 40px rgba(0,0,0,.45),0 0 0 1px rgba(230,196,91,.28)!important;transition:transform .2s ease,box-shadow .2s ease!important;}
    .catalog-card:active{transform:scale(.97)!important;transition:transform .08s ease!important;}
    .game-tile{transition:transform .22s cubic-bezier(.22,1,.36,1),box-shadow .22s ease,border-color .22s ease;}
    .game-tile:hover{transform:translateX(6px)!important;box-shadow:0 12px 28px rgba(0,0,0,.38),0 0 0 1px rgba(230,196,91,.25)!important;border-color:rgba(230,196,91,.35)!important;}
    .winner-row{opacity:0;transform:translateX(-16px);animation:slideInRow .4s cubic-bezier(.22,1,.36,1) forwards;}
    .winner-row:nth-child(1){animation-delay:.08s}.winner-row:nth-child(2){animation-delay:.16s}.winner-row:nth-child(3){animation-delay:.24s}.winner-row:nth-child(4){animation-delay:.32s}.winner-row:nth-child(5){animation-delay:.4s}
    @keyframes slideInRow{to{opacity:1;transform:translateX(0)}}
    .earning-item{animation:fadeSlideUp .5s cubic-bezier(.22,1,.36,1) both;}
    .earning-item:nth-child(2){animation-delay:.1s}.earning-item:nth-child(3){animation-delay:.2s}
    @keyframes fadeSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  `;
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', () => {
    const observe = () => {
      document.querySelectorAll('.catalog-card:not(.card-visible)').forEach((card, idx) => {
        const io = new IntersectionObserver(entries => {
          entries.forEach(e => { if (e.isIntersecting) { setTimeout(() => e.target.classList.add('card-visible'), idx * 70); io.unobserve(e.target); } });
        }, { threshold: 0.1 });
        io.observe(card);
      });
    };
    observe();
    // Re-observe after dynamic renders
    new MutationObserver(observe).observe(document.body, { childList: true, subtree: true });
  });
})();

/* ─── Hero Orb — Float, Glow, Live Counter ─── */
(function initHeroOrb() {
  const style = document.createElement('style');
  style.textContent = `
    .hero-orb{animation:orbFloat 3.6s ease-in-out infinite,orbGlow 3.6s ease-in-out infinite;}
    @keyframes orbFloat{0%,100%{transform:rotate(-7deg) translateY(0)}50%{transform:rotate(-7deg) translateY(-8px)}}
    @keyframes orbGlow{0%,100%{box-shadow:0 0 0 8px rgba(230,196,91,.06),0 20px 40px rgba(0,0,0,.35)}50%{box-shadow:0 0 0 16px rgba(230,196,91,.14),0 20px 40px rgba(0,0,0,.4),0 0 40px rgba(230,196,91,.18)}}
    .hero-orb span{animation:orbCounterTick 2.2s ease-in-out infinite alternate;}
    @keyframes orbCounterTick{from{color:#fff4bf}to{color:#ffe55a;text-shadow:0 0 18px rgba(230,196,91,.7)}}
    .mobile-hero{animation:heroReveal .7s cubic-bezier(.22,1,.36,1) both;}
    @keyframes heroReveal{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    .eyebrow{animation:eyebrowReveal .6s .1s cubic-bezier(.22,1,.36,1) both;}
    @keyframes eyebrowReveal{from{opacity:0;letter-spacing:.18em}to{opacity:1;letter-spacing:.06em}}
    .mobile-hero h1{animation:fadeSlideUp .65s .2s cubic-bezier(.22,1,.36,1) both;}
    .hero-cta-row .btn{animation:fadeSlideUp .65s both;}
    .hero-cta-row .btn:nth-child(1){animation-delay:.35s}.hero-cta-row .btn:nth-child(2){animation-delay:.45s}
    .btn-gold{position:relative;overflow:hidden;}
    .btn-gold::after{content:'';position:absolute;top:-50%;left:-70%;width:50%;height:200%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-20deg);animation:btnShimmer 3.5s 1.2s ease-in-out infinite;}
    @keyframes btnShimmer{0%,100%{left:-70%}50%{left:130%}}
  `;
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', () => {
    const orbSpan = document.querySelector('.hero-orb > span');
    if (!orbSpan) return;
    let val = 1.0, target = 2.48, up = true;
    setInterval(() => {
      if (up) { val = Math.min(val + 0.01, target); if (val >= target) up = false; }
      else { val = Math.max(val - 0.02, 1.0); if (val <= 1.0) up = true; }
      orbSpan.textContent = val.toFixed(2) + 'x';
    }, 120);
  });
})();

/* ─── Aviator — Stage Glow, Multiplier & UI Micro-Animations ─── */
(function initAviatorAnimation() {
  const style = document.createElement('style');
  style.textContent = `
    .aviator-screen{background:#0a0b10!important;}
    .aviator-screen .aviator-stage{position:relative;background:radial-gradient(ellipse 120% 100% at 50% 100%,#151726 0%,#090a10 75%,#06070a 100%);border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 16px 40px rgba(0,0,0,.6);border-radius:18px;overflow:hidden;}
    .aviator-screen .aviator-stage::after{content:'';position:absolute;inset:0;background:radial-gradient(circle 350px at 80% 20%,rgba(234,34,70,.06),transparent 70%);pointer-events:none;z-index:2;}
    .aviator-screen .aviator-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:1;display:block;}
    .aviator-screen .aviator-multiplier-display{font-size:4.8rem;font-weight:950;color:#ffffff;letter-spacing:-1px;text-shadow:0 0 30px rgba(255,255,255,.2),0 0 60px rgba(234,34,70,.25);z-index:10;user-select:none;transition:transform .12s cubic-bezier(.22,1,.36,1),color .2s ease;font-variant-numeric:tabular-nums;line-height:1;}
    .aviator-screen .aviator-multiplier-display.crashed{color:#ff2a55!important;text-shadow:0 0 35px rgba(255,42,85,.85),0 0 70px rgba(255,42,85,.5)!important;animation:crashShudder .35s cubic-bezier(.36,.07,.19,.97) both;}
    @keyframes crashShudder{0%,100%{transform:scale(1) translate(0,0)}20%{transform:scale(1.08) translate(-3px,2px)}40%{transform:scale(1.05) translate(3px,-2px)}60%{transform:scale(1.02) translate(-2px,1px)}80%{transform:scale(1.01) translate(2px,-1px)}}
    .aviator-screen .display-status-text{position:relative;z-index:10;font-size:.78rem;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,.65);text-transform:uppercase;margin-bottom:8px;}
    .aviator-screen .display-status-text.flying{color:#2ecc71;text-shadow:0 0 10px rgba(46,204,113,.4);}
    .aviator-screen .display-status-text.crashed{color:#ff3155;text-shadow:0 0 10px rgba(255,49,85,.4);}
    .aviator-screen .history-ribbon{display:flex;gap:6px;overflow-x:auto;padding:6px 2px 10px;scrollbar-width:none;}
    .aviator-screen .history-ribbon::-webkit-scrollbar{display:none;}
    .aviator-screen .history-pill{font-size:.72rem;font-weight:800;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,.05);color:#70a1ff;border:1px solid rgba(112,161,255,.2);white-space:nowrap;transition:transform .18s ease;}
    .aviator-screen .history-pill:hover{transform:scale(1.08);}
    .aviator-screen .history-pill.tier-low{color:#70a1ff;border-color:rgba(112,161,255,.25);background:rgba(112,161,255,.08);}
    .aviator-screen .history-pill.tier-mid{color:#c56cf0;border-color:rgba(197,108,240,.35);background:rgba(197,108,240,.12);}
    .aviator-screen .history-pill.tier-high{color:#ffd32a;border-color:rgba(255,211,42,.4);background:rgba(255,211,42,.15);box-shadow:0 0 12px rgba(255,211,42,.2);}
    .aviator-screen .betting-console{animation:consoleSlideUp .5s .1s cubic-bezier(.22,1,.36,1) both;}
    @keyframes consoleSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    .aviator-screen .btn-execute-bet{transition:transform .15s ease,box-shadow .15s ease,filter .15s ease;animation:betBtnPulse 2.4s ease-in-out infinite;}
    @keyframes betBtnPulse{0%,100%{box-shadow:0 4px 16px rgba(46,204,113,.25)}50%{box-shadow:0 8px 28px rgba(46,204,113,.55)}}
    .aviator-screen .btn-execute-bet:hover{transform:scale(1.03)!important;box-shadow:0 8px 28px rgba(46,204,113,.6)!important}
    .aviator-screen .btn-execute-bet:active{transform:scale(.97)!important}
    .aviator-screen .aviator-cashout-action{animation:cashoutUrgent .65s ease-in-out infinite alternate;}
    @keyframes cashoutUrgent{from{box-shadow:0 0 0 0 rgba(234,34,70,.5);background:linear-gradient(180deg,#e0203e,#a8142d)}to{box-shadow:0 0 18px 4px rgba(234,34,70,.4);background:linear-gradient(180deg,#ff3158,#c0182f)}}
    @media(max-width:480px){.aviator-screen .aviator-multiplier-display{font-size:3.8rem;}}
  `;
  document.head.appendChild(style);
})();

/* ─── Colour Prediction — Glow, Shimmer & Timer Urgency ─── */
(function initColourAnimations() {
  const style = document.createElement('style');
  style.textContent = `
    .btn-bet-colour{position:relative;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease;}
    .btn-green{animation:greenPulse 2.8s ease-in-out infinite;}
    .btn-violet{animation:violetPulse 2.8s .6s ease-in-out infinite;}
    .btn-red{animation:redPulse 2.8s 1.2s ease-in-out infinite;}
    @keyframes greenPulse{0%,100%{box-shadow:0 4px 16px rgba(11,191,121,.25)}50%{box-shadow:0 8px 32px rgba(11,191,121,.55),0 0 0 2px rgba(11,191,121,.2)}}
    @keyframes violetPulse{0%,100%{box-shadow:0 4px 16px rgba(139,98,218,.25)}50%{box-shadow:0 8px 32px rgba(139,98,218,.6),0 0 0 2px rgba(139,98,218,.2)}}
    @keyframes redPulse{0%,100%{box-shadow:0 4px 16px rgba(233,78,103,.25)}50%{box-shadow:0 8px 32px rgba(233,78,103,.6),0 0 0 2px rgba(233,78,103,.2)}}
    .btn-bet-colour::before{content:'';position:absolute;top:-50%;left:-70%;width:50%;height:200%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent);transform:skewX(-20deg);animation:colourShimmer 3.2s ease-in-out infinite;}
    .btn-green::before{animation-delay:0s}.btn-violet::before{animation-delay:1.1s}.btn-red::before{animation-delay:2.2s}
    @keyframes colourShimmer{0%,100%{left:-70%}50%{left:130%}}
    .btn-bet-colour:hover{transform:scale(1.04) translateY(-3px)!important;}
    .btn-bet-colour:active{transform:scale(.97)!important;}
    .btn-number{transition:transform .15s ease,box-shadow .15s ease,background .15s ease;position:relative;overflow:hidden;}
    .btn-number:hover{transform:scale(1.1) translateY(-3px)!important;box-shadow:0 8px 22px rgba(0,0,0,.4),0 0 0 2px rgba(230,196,91,.4)!important;background:#0a3328!important;}
    .btn-number:active{transform:scale(.95)!important;}
    #colourTimerBadge.urgent{animation:timerUrgent .5s ease-in-out infinite alternate;}
    @keyframes timerUrgent{from{background:rgba(233,78,103,.15);color:#ff6e84}to{background:rgba(233,78,103,.4);color:#fff;box-shadow:0 0 12px rgba(233,78,103,.6)}}
    .history-ribbon .badge,.history-ribbon .history-pill{transition:transform .15s ease;}
    .history-ribbon .badge:hover,.history-ribbon .history-pill:hover{transform:scale(1.15) translateY(-2px);}
  `;
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('colourTimerBadge');
    if (!badge) return;
    new MutationObserver(() => {
      const sec = parseInt(badge.textContent.replace(/\D/g, ''), 10);
      if (!isNaN(sec)) badge.classList.toggle('urgent', sec <= 10);
    }).observe(badge, { childList: true, characterData: true, subtree: true });
  });
})();

/* ─── Ludo — Dice Roll + Canvas Flash ─── */
(function initLudoAnimations() {
  const style = document.createElement('style');
  style.textContent = `
    #btnLudoRoll{position:relative;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease;}
    #btnLudoRoll::before{content:'🎲';position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:1.2rem;animation:diceIdle 2s ease-in-out infinite;}
    @keyframes diceIdle{0%,100%{transform:translateY(-50%) rotate(0deg)}25%{transform:translateY(-55%) rotate(-15deg)}75%{transform:translateY(-45%) rotate(15deg)}}
    #btnLudoRoll.rolling::before{animation:diceRoll .5s linear infinite;}
    @keyframes diceRoll{from{transform:translateY(-50%) rotate(0deg)}to{transform:translateY(-50%) rotate(360deg)}}
    #btnLudoRoll:hover{transform:scale(1.04) translateY(-2px);box-shadow:0 8px 24px rgba(230,196,91,.35)!important;}
    #btnLudoRoll:active{transform:scale(.97);}
    .ludo-canvas{transition:filter .3s ease;border-radius:16px;}
    .ludo-canvas.roll-flash{animation:canvasFlash .35s ease;}
    @keyframes canvasFlash{0%{filter:brightness(1)}30%{filter:brightness(1.6) saturate(1.4)}100%{filter:brightness(1)}}
    .token-actions .btn{transition:transform .18s ease,box-shadow .18s ease;}
    .token-actions .btn:hover{transform:scale(1.06) translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.4);}
    .ludo-status div{animation:fadeSlideUp .4s cubic-bezier(.22,1,.36,1) both;}
    .ludo-status div:nth-child(1){animation-delay:.05s}.ludo-status div:nth-child(2){animation-delay:.1s}.ludo-status div:nth-child(3){animation-delay:.15s}
  `;
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', () => {
    const rollBtn = document.getElementById('btnLudoRoll');
    if (!rollBtn) return;
    rollBtn.addEventListener('click', () => {
      rollBtn.classList.add('rolling');
      const canvas = document.getElementById('ludoCanvas');
      if (canvas) { canvas.classList.add('roll-flash'); setTimeout(() => canvas.classList.remove('roll-flash'), 400); }
      setTimeout(() => rollBtn.classList.remove('rolling'), 900);
    });
  });
})();

/* ─── Tab Switch — Smooth Enter Transitions ─── */
(function initTabTransitions() {
  const style = document.createElement('style');
  style.textContent = `
    .tab-content{transition:opacity .3s ease;}
    .tab-enter{animation:tabEnter .35s cubic-bezier(.22,1,.36,1) both;}
    @keyframes tabEnter{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    .bottom-nav-btn{transition:color .2s ease,transform .15s ease;}
    .bottom-nav-btn:active{transform:scale(.88);}
    .bottom-nav-btn.active span{animation:navIconPop .3s cubic-bezier(.22,1,.36,1);}
    @keyframes navIconPop{0%{transform:scale(1)}50%{transform:scale(1.28)}100%{transform:scale(1)}}
    .bottom-nav-btn.center-action span,.bottom-nav-btn.play-action span{animation:centerBtnGlow 2.5s ease-in-out infinite alternate;}
    @keyframes centerBtnGlow{from{box-shadow:0 5px 16px rgba(230,196,91,.18)}to{box-shadow:0 7px 26px rgba(230,196,91,.55)}}
  `;
  document.head.appendChild(style);

  // Late-bind patch: waits until all scripts load, then wraps switchTab
  window.addEventListener('load', () => {
    const _orig = window.switchTab;
    if (typeof _orig !== 'function') return;
    window.switchTab = function(tabId) {
      _orig.call(this, tabId);
      const target = document.getElementById('tab-' + tabId);
      if (target) {
        target.classList.remove('tab-enter');
        void target.offsetWidth; // force reflow to restart animation
        target.classList.add('tab-enter');
      }
      if (tabId === 'aviator' && typeof window.resizeAviatorCanvas === 'function') {
        requestAnimationFrame(() => window.resizeAviatorCanvas());
      }
    };
  });
})();

/* ─── Ambient Particle Background ─── */
(function initAmbientParticles() {
  const style = document.createElement('style');
  style.textContent = `.apex-ambient-canvas{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:.4;}`;
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.createElement('canvas');
    canvas.className = 'apex-ambient-canvas';
    document.body.insertBefore(canvas, document.body.firstChild);
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    class P {
      constructor() { this.reset(); }
      reset() { this.x = Math.random()*W; this.y = Math.random()*H; this.r = Math.random()*1.4+.3; this.vx = (Math.random()-.5)*.25; this.vy = -Math.random()*.4-.05; this.alpha = Math.random()*.5+.1; this.gold = Math.random()>.5; }
      update() { this.x+=this.vx; this.y+=this.vy; this.alpha-=.0007; if(this.y<-10||this.alpha<=0) this.reset(); }
      draw() { ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fillStyle=this.gold?`rgba(230,196,91,${this.alpha})`:`rgba(11,191,121,${this.alpha})`; ctx.fill(); }
    }
    for(let i=0;i<60;i++) particles.push(new P());
    (function loop(){ ctx.clearRect(0,0,W,H); particles.forEach(p=>{p.update();p.draw();}); requestAnimationFrame(loop); })();
  });
})();

/* ─── Section Heading Underline Animate ─── */
(function initSectionHeadings() {
  const style = document.createElement('style');
  style.textContent = `
    .section-heading h2{position:relative;display:inline-block;}
    .section-heading h2::after{content:'';position:absolute;bottom:-4px;left:0;height:2px;width:0;background:linear-gradient(90deg,#e6c45b,#0bbf79);border-radius:999px;transition:width .6s cubic-bezier(.22,1,.36,1);}
    .games-visible .section-heading h2::after{width:100%;}
  `;
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', () => {
    const h = document.getElementById('mobile-game-home');
    if (h) setTimeout(() => h.classList.add('games-visible'), 400);
  });
})();

/* ─── Catalog Image Shimmer Skeleton ─── */
(function initImageShimmer() {
  const style = document.createElement('style');
  style.textContent = `
    .catalog-image{width:100%;aspect-ratio:1/1.16;object-fit:cover;border-radius:14px 14px 0 0;transition:transform .3s ease,filter .3s ease;}
    .catalog-card:hover .catalog-image{transform:scale(1.06);filter:brightness(1.08);}
  `;
  document.head.appendChild(style);
  const markLoaded = () => document.querySelectorAll('.catalog-image').forEach(img => {
    if (img.complete) img.classList.add('loaded');
    else img.addEventListener('load', () => img.classList.add('loaded'));
  });
  document.addEventListener('DOMContentLoaded', markLoaded);
  new MutationObserver(markLoaded).observe(document, { subtree: true, childList: true });
})();