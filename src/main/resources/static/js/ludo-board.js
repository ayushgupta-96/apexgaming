/* APEX Ludo board renderer. Token positions are always read from server state. */
(function(){
  "use strict";
    const TRACK=[
    [6,1],[6,2],[6,3],[6,4],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[12,5],[12,6],[12,7],
    [13,6],[13,7],[13,8],[12,8],[11,8],[10,8],[9,8],[9,9],[9,10],[9,11],[9,12],[8,12],[7,12],
    [8,13],[7,13],[6,13],[6,12],[6,11],[6,10],[6,9],[5,9],[4,9],[3,9],[2,9],[2,8],[2,7],
    [1,8],[1,7],[1,6],[2,6],[3,6],[4,6],[5,6],[5,5],[5,4],[5,3],[5,2],[5,1],[6,0]
  ];
  const COLORS={RED:"#e65a62",GREEN:"#25bd82",YELLOW:"#e9c65d",BLUE:"#5d9ce8"};
  const HOME={RED:[[7,2],[7,3],[7,4],[7,5],[7,6],[7,7]],GREEN:[[12,7],[11,7],[10,7],[9,7],[8,7],[7,7]],YELLOW:[[7,12],[7,11],[7,10],[7,9],[7,8],[7,7]],BLUE:[[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]]};
  const BASE={RED:[[2,2],[4,2],[2,4],[4,4]],GREEN:[[10,2],[12,2],[10,4],[12,4]],YELLOW:[[10,10],[12,10],[10,12],[12,12]],BLUE:[[2,10],[4,10],[2,12],[4,12]]};
  const START={RED:0,GREEN:13,YELLOW:26,BLUE:39};
  const cell=(ctx,x,y,size,color)=>{ctx.fillStyle=color;ctx.fillRect(x*size,y*size,size,size);ctx.strokeStyle="#183b2a";ctx.lineWidth=1;ctx.strokeRect(x*size,y*size,size,size);};
  function render(canvas,state,userId){
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const n=15,size=canvas.width/n;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#07170f";ctx.fillRect(0,0,canvas.width,canvas.height);
    const bases={RED:[0,0],GREEN:[9,0],YELLOW:[9,9],BLUE:[0,9]};
    Object.entries(bases).forEach(([color,[x,y]])=>{ctx.fillStyle=COLORS[color];ctx.globalAlpha=.22;ctx.fillRect(x*size,y*size,size*6,size*6);ctx.globalAlpha=1;ctx.strokeStyle=COLORS[color];ctx.lineWidth=3;ctx.strokeRect(x*size+2,y*size+2,size*6-4,size*6-4);});
    TRACK.forEach(([x,y],i)=>{const color=Object.keys(START).find(k=>START[k]===i);cell(ctx,x,y,size,color?COLORS[color]:"#e8eee8");});
    Object.entries(HOME).forEach(([color,path])=>path.forEach(([x,y])=>cell(ctx,x,y,size,COLORS[color])));
    ctx.fillStyle="#102e20";ctx.fillRect(6*size,6*size,3*size,3*size);ctx.strokeStyle="#e8ca72";ctx.lineWidth=2;ctx.strokeRect(6*size,6*size,3*size,3*size);
    ctx.fillStyle="#f3dda0";ctx.font="bold "+(size*.42)+"px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("APEX",7.5*size,7.5*size);
    Object.entries(BASE).forEach(([color,slots])=>slots.forEach(([x,y],i)=>{ctx.beginPath();ctx.arc((x+.5)*size,(y+.5)*size,size*.32,0,Math.PI*2);ctx.fillStyle="#07170f";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=COLORS[color];ctx.stroke();}));
    const positions=state.tokenPositions||{};
    Object.entries(positions).forEach(([color,tokens])=>(tokens||[]).forEach((pos,i)=>{
      let x,y;
      if(pos===-1){[x,y]=BASE[color]?.[i]||[7,7];}
      else if(pos===999){x=7;y=7;}
      else if(pos>=100){[x,y]=HOME[color]?.[Math.min(5,Math.max(0,pos-100))]||[7,7];}
      else {let trackIndex=Number(pos);[x,y]=TRACK[trackIndex]||TRACK[0];}
      ctx.beginPath();ctx.arc((x+.5)*size,(y+.5)*size,size*.25,0,Math.PI*2);ctx.fillStyle=COLORS[color]||"#fff";ctx.fill();ctx.lineWidth=2;ctx.strokeStyle="#fff";ctx.stroke();
      ctx.fillStyle="#07170f";ctx.font="bold "+(size*.23)+"px sans-serif";ctx.fillText(String(i+1),(x+.5)*size,(y+.5)*size);
    }));
    ctx.strokeStyle="#e8ca72";ctx.lineWidth=2;ctx.strokeRect(1,1,canvas.width-2,canvas.height-2);
  }
  window.ApexLudoBoard={render};
})();