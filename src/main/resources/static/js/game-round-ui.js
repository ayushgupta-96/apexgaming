(function(){
  "use strict";

  let wheelRotation = 0;
  let lastColourResultKey = null;

  function makeResultChip(item, type){
    const chip = document.createElement("div");
    chip.className = "apx-round-chip";
    if(type === "colour"){
      const number = Number(item.number);
      const color = String(item.winningColor || "").toUpperCase();
      chip.classList.add(
        color === "GREEN" ? "is-green" :
        color === "VIOLET" ? "is-violet" :
        color === "RED" ? "is-red" : "is-neutral"
      );
      const n = document.createElement("strong");
      n.textContent = Number.isFinite(number) ? String(number) : "?";
      const c = document.createElement("span");
      c.textContent = color || "RESULT";
      chip.append(n,c);
    } else {
      const value = Number(item);
      const label = document.createElement("strong");
      label.textContent = Number.isFinite(value) ? value.toFixed(2) + "x" : "--";
      chip.append(label);
    }
    return chip;
  }

  function renderAviatorRoundResults(values){
    const host = document.getElementById("aviatorRoundResults");
    if(!host) return;
    host.replaceChildren();
    (Array.isArray(values) ? values : []).slice(0,12).forEach(v => {
      host.appendChild(makeResultChip(v, "aviator"));
    });
    if(!host.children.length){
      const empty=document.createElement("span");
      empty.className="apx-round-empty";
      empty.textContent="Waiting for completed rounds…";
      host.appendChild(empty);
    }
  }

  function renderColourRoundResults(values){
    const host = document.getElementById("colourRoundResults");
    if(!host) return;
    host.replaceChildren();
    (Array.isArray(values) ? values : []).slice(0,12).forEach(v => {
      host.appendChild(makeResultChip(v, "colour"));
    });
    if(!host.children.length){
      const empty=document.createElement("span");
      empty.className="apx-round-empty";
      empty.textContent="Waiting for completed rounds…";
      host.appendChild(empty);
    }
  }

  function animateColourWheel(result){
    const disc=document.getElementById("colourWheelDisc");
    const center=document.getElementById("colourWheelCenterNumber");
    const label=document.getElementById("colourWheelCenterLabel");
    const wheel=document.getElementById("colourWheel");
    if(!disc || !center || !label) return;

    const number=Number(result && result.number);
    if(!Number.isInteger(number) || number<0 || number>9) return;

    const targetDeg=number*36;
    const currentNorm=((wheelRotation%360)+360)%360;
    const targetNorm=(((-targetDeg)%360)+360)%360;
    const delta=((targetNorm-currentNorm)+360)%360;
    wheelRotation += 360*4 + delta;

    wheel?.classList.remove("is-spinning","is-result");
    void disc.offsetWidth;
    wheel?.classList.add("is-spinning");
    disc.style.transform="rotate("+wheelRotation+"deg)";

    window.setTimeout(function(){
      center.textContent=String(number);
      center.classList.add("is-revealed");
      label.textContent=String(result.winningColor || "RESULT").toUpperCase();
      wheel?.classList.remove("is-spinning");
      wheel?.classList.add("is-result");
      window.setTimeout(()=>center.classList.remove("is-revealed"),900);
    },1350);
  }

  function install(){
    const originalColour=window.handleColourTick;
    const originalAviator=window.handleAviatorTick;

    if(typeof originalColour==="function"){
      window.handleColourTick=function(state){
        originalColour(state);
        if(state && Array.isArray(state.recentResults)){
          renderColourRoundResults(state.recentResults);
          if(state.status==="RESULT" && state.recentResults.length){
            const latest=state.recentResults[0];
            const key=String(state.roundUuid||"")+"|"+String(latest.number);
            if(key!==lastColourResultKey){
              lastColourResultKey=key;
              animateColourWheel(latest);
            }
          }
        }
      };
    }

    if(typeof originalAviator==="function"){
      window.handleAviatorTick=function(state){
        originalAviator(state);
        if(state && Array.isArray(state.recentHistory)){
          renderAviatorRoundResults(state.recentHistory);
        }
      };
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",install,{once:true});
  }else{
    install();
  }
})();