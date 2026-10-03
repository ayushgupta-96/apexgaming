/* Apex Games UI — visual/game-surface layer.
   API calls remain in app.js; this file owns presentation and smooth animation. */
(function(){
  "use strict";

  const ui = {
    aviator: {
      canvas:null, ctx:null, raf:0, lastTs:0, target:1, visual:1,
      phase:"BETTING", crashed:false, roundKey:null, width:0, height:0
    },
    colour: { lastRound:null, lastResult:null, wheelRotation:0 }
  };

  function el(id){ return document.getElementById(id); }
  function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }

  function resizeAviatorCanvas(){
    const s=el("flightCanvas"); if(!s) return;
    const rect=s.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
    s.width=Math.max(1,Math.floor(rect.width*dpr));
    s.height=Math.max(1,Math.floor(rect.height*dpr));
    s.style.width=rect.width+"px"; s.style.height=rect.height+"px";
    const c=s.getContext("2d");
    if(c){c.setTransform(dpr,0,0,dpr,0,0);ui.aviator.ctx=c;ui.aviator.width=rect.width;ui.aviator.height=rect.height;}
  }

  function initAviator(){
    const s=el("flightCanvas"); if(!s) return;
    ui.aviator.canvas=s; ui.aviator.ctx=s.getContext("2d");
    resizeAviatorCanvas();
    window.addEventListener("resize",resizeAviatorCanvas,{passive:true});
    window.addEventListener("orientationchange",()=>setTimeout(resizeAviatorCanvas,120),{passive:true});
    if(!ui.aviator.raf) ui.aviator.raf=requestAnimationFrame(drawAviator);
  }

  function planePath(c,x,y,scale,angle){
    c.save();
    c.translate(x,y);
    c.rotate(angle);
    c.scale(scale,scale);

    // Custom aircraft silhouette: fuselage, swept wings, tail and cockpit.
    c.shadowColor="rgba(255,70,100,.45)";
    c.shadowBlur=14;
    c.beginPath();
    c.moveTo(30,0);
    c.quadraticCurveTo(20,-4,9,-4);
    c.lineTo(-13,-3);
    c.lineTo(-28,-10);
    c.lineTo(-31,-8);
    c.lineTo(-17,1);
    c.lineTo(-31,10);
    c.lineTo(-28,12);
    c.lineTo(-5,5);
    c.lineTo(5,7);
    c.lineTo(12,15);
    c.lineTo(16,14);
    c.lineTo(12,5);
    c.lineTo(24,3);
    c.quadraticCurveTo(29,2,30,0);
    c.closePath();
    const body=c.createLinearGradient(-30,-10,30,10);
    body.addColorStop(0,"#ff6b80");
    body.addColorStop(.5,"#ef3f5b");
    body.addColorStop(1,"#b81e39");
    c.fillStyle=body;
    c.fill();

    c.shadowBlur=0;
    c.beginPath();
    c.moveTo(4,-3); c.lineTo(13,-12); c.lineTo(19,-11); c.lineTo(12,-2); c.closePath();
    c.fillStyle="#ff9aaa"; c.fill();

    c.beginPath();
    c.moveTo(8,0); c.quadraticCurveTo(17,-1,22,0); c.lineTo(16,3); c.lineTo(8,3); c.closePath();
    c.fillStyle="#e8eff0"; c.fill();

    c.beginPath();
    c.arc(12,0,2.2,0,Math.PI*2);
    c.fillStyle="#6fd4ff";
    c.fill();
    c.restore();
  }

  function drawAviator(ts){
    const a=ui.aviator,c=a.ctx,w=a.width,h=a.height;
    if(!c||!w||!h){a.raf=requestAnimationFrame(drawAviator);return;}
    const dt=a.lastTs?Math.min(32,ts-a.lastTs):16;a.lastTs=ts;
    a.visual += (a.target-a.visual)*(1-Math.pow(.0015,dt/1000));
    if(a.phase==="BETTING") a.visual=1;
    const p=clamp((a.visual-1)/18,0,1);
    const ease=p*p*(3-2*p);
    const startX=w*.06,startY=h*.86,endX=w*(.22+.67*ease),endY=h*(.83-.68*ease);
    const controlX=w*(.42+.30*ease),controlY=h*(.87-.62*ease);
    c.clearRect(0,0,w,h);

    const bg=c.createRadialGradient(w*.65,h*.2,0,w*.65,h*.2,w*.75);
    bg.addColorStop(0,a.crashed?"rgba(255,65,90,.10)":"rgba(230,57,83,.10)");
    bg.addColorStop(1,"rgba(0,0,0,0)");
    c.fillStyle=bg;c.fillRect(0,0,w,h);

    c.save();c.globalAlpha=.12;c.strokeStyle="#8a9a92";c.lineWidth=1;
    for(let y=.18;y<.9;y+=.16){c.beginPath();c.moveTo(0,h*y);c.lineTo(w,h*y);c.stroke();}
    for(let x=.12;x<1;x+=.16){c.beginPath();c.moveTo(w*x,0);c.lineTo(w*x,h);c.stroke();}c.restore();

    c.save();c.beginPath();c.moveTo(startX,startY);c.quadraticCurveTo(controlX,controlY,endX,endY);c.lineTo(endX,startY);c.closePath();
    const fill=c.createLinearGradient(0,endY,0,startY);fill.addColorStop(0,"rgba(239,65,91,.28)");fill.addColorStop(1,"rgba(239,65,91,0)");
    c.fillStyle=fill;c.fill();c.restore();

    c.save();c.beginPath();c.moveTo(startX,startY);c.quadraticCurveTo(controlX,controlY,endX,endY);
    c.strokeStyle=a.crashed?"#ff5169":"#ed405a";c.lineWidth=3.5;c.lineCap="round";c.shadowBlur=10;c.shadowColor="#ed405a";c.stroke();c.restore();

    const dx=2*(1-p)*(controlX-startX)+2*p*(endX-controlX);
    const dy=2*(1-p)*(controlY-startY)+2*p*(endY-controlY);
    const angle=Math.atan2(dy,dx);
    c.save();c.globalAlpha=.7;c.fillStyle="#ff7b8c";c.beginPath();c.arc(endX,endY,3.5,0,Math.PI*2);c.fill();c.restore();
    planePath(c,endX,endY,clamp(w/360,.78,1.12),angle);

    if(a.phase==="BETTING"){
      c.save();c.fillStyle="rgba(240,207,104,.05)";c.beginPath();c.arc(w*.5,h*.52,72+Math.sin(ts/450)*3,0,Math.PI*2);c.fill();c.restore();
    }
    a.raf=requestAnimationFrame(drawAviator);
  }

  function renderAviator(state){
    const a=ui.aviator;if(!a.canvas) initAviator();
    const mult=el("multiplier-display"),status=el("aviatorStatusSubtitle"),live=el("aviatorLiveBadge"),seed=el("aviatorSeedHash");
    if(seed&&state.serverSeedHash) seed.textContent="Seed: "+String(state.serverSeedHash).slice(0,24)+"…";
    if(state.roundUuid && state.roundUuid!==a.roundKey){a.roundKey=state.roundUuid;a.crashed=false;}
    a.phase=state.status||"BETTING";
    if(a.phase==="FLYING"){a.target=Number(state.currentMultiplier)||1;a.crashed=false;}
    else if(a.phase==="CRASHED"){a.target=Number(state.crashMultiplier||state.currentMultiplier)||1;a.crashed=true;}
    else {a.target=1;a.crashed=false;}
    if(mult){
      mult.classList.toggle("crashed",a.crashed);
      mult.textContent=a.phase==="BETTING"?Math.max(0,Number(state.countdownSeconds)||0)+"s":(Number(a.target).toFixed(2)+"x");
    }
    if(status){
      status.textContent=a.phase==="BETTING"?"NEXT ROUND STARTS SOON":a.phase==="FLYING"?"PLANE IN FLIGHT":"ROUND CRASHED";
    }
    if(live) live.classList.toggle("off",a.phase==="CRASHED");
    const ribbon=el("aviatorHistoryRibbon");
    if(ribbon) renderPills(ribbon,state.recentHistory||[]);
  }

  function renderPills(container,values){
    container.replaceChildren();
    (values||[]).slice(0,18).forEach((v,i)=>{
      const p=document.createElement("span");p.className="apx-history-pill "+(Number(v)>=5?"hot":(i%3===0?"cool":""));p.textContent=Number(v).toFixed(2)+"x";container.appendChild(p);
    });
  }

  function colourClass(value){
    const v=String(value||"").toUpperCase();
    if(v==="GREEN") return "green"; if(v==="VIOLET") return "violet"; return "red";
  }

  function renderColour(state){
    const timer=el("colourTimerBadge"),round=el("colourRoundUuid"),wrap=el("colourWheel");
    if(round) round.textContent=state.roundUuid||"CP-—";

    const seconds=Math.max(0,Number(state.secondsRemaining)||0);
    if(timer){
      const inner=timer.querySelector(".apx-timer-inner");
      if(inner) inner.textContent=state.status==="LOCKED"?"LOCK":state.status==="RESULT"?String(state.winningNumber??"—"):String(seconds).padStart(2,"0");
      const pct=clamp((seconds/60)*100,0,100);
      timer.style.setProperty("--timer-progress",pct);
      timer.classList.toggle("locked",state.status==="LOCKED");
    }

    const resultNumber=Number(state.winningNumber);
    const resultKey=state.status==="RESULT" && Number.isFinite(resultNumber)
      ? String(state.roundUuid||"")+"|"+resultNumber
      : null;

    if(wrap){
      wrap.classList.toggle("result",state.status==="RESULT");
      wrap.classList.toggle("locked",state.status==="LOCKED");
      wrap.dataset.winningColor=state.winningColor||"";

      const disc=wrap.querySelector(".apx-wheel-disc");
      const centerNumber=el("colourWheelCenterNumber");
      const centerLabel=el("colourWheelCenterLabel");

      if(state.status==="RESULT" && Number.isFinite(resultNumber)){
        if(resultKey!==ui.colour.lastResult){
          const sectorCenter=(resultNumber*36)+18;
          ui.colour.wheelRotation=1440 + (360-sectorCenter);
          if(disc){
            disc.style.setProperty("--wheel-target-rotation", ui.colour.wheelRotation+"deg");
            disc.classList.remove("spin-result");
            void disc.offsetWidth;
            disc.classList.add("spin-result");
          }
          ui.colour.lastResult=resultKey;
        }
        if(centerNumber) centerNumber.textContent=String(resultNumber);
        if(centerLabel) centerLabel.textContent=String(state.winningColor||"").replace("_"," + ").toUpperCase();
      }else{
        if(centerNumber) centerNumber.textContent="?";
        if(centerLabel) centerLabel.textContent=state.status==="LOCKED"?"TABLE LOCKED":"NEXT RESULT";
      }
    }

    const result=el("colourLiveResult");
    if(result){
      result.textContent=state.status==="RESULT"
        ? "WINNING "+String(state.winningNumber??"—")+" · "+String(state.winningColor||"").toUpperCase()
        : state.status==="LOCKED" ? "BETS LOCKED" : "OPEN FOR PREDICTIONS";
    }
  }

  window.ApexGameUI={initAviator,resizeAviatorCanvas,renderAviator,renderColour};
  document.addEventListener("DOMContentLoaded",()=>{
    initAviator();
    document.querySelectorAll(".apx-colour-btn,.apx-number-btn").forEach(btn=>{
      btn.addEventListener("click",()=>btn.classList.add("pressed"));
    });
  });
})();
