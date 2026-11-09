/* APEX Ludo board renderer. Visual-only rendering; token positions remain server-authoritative. */
(function(){
  "use strict";
  const TRACK=[
    [6,1],[6,2],[6,3],[6,4],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[12,5],[12,6],[12,7],
    [13,6],[13,7],[13,8],[12,8],[11,8],[10,8],[9,8],[9,9],[9,10],[9,11],[9,12],[8,12],[7,12],
    [8,13],[7,13],[6,13],[6,12],[6,11],[6,10],[6,9],[5,9],[4,9],[3,9],[2,9],[2,8],[2,7],
    [1,8],[1,7],[1,6],[2,6],[3,6],[4,6],[5,6],[5,5],[5,4],[5,3],[5,2],[5,1],[6,0]
  ];
  const COLORS={RED:"#ed5360",GREEN:"#20bd80",YELLOW:"#e8c65c",BLUE:"#5797e8"};
  const SOFT={RED:"#f8dfe1",GREEN:"#d9f4e8",YELLOW:"#fbf0ca",BLUE:"#dceaff"};
  const HOME={
    RED:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    GREEN:[[12,7],[11,7],[10,7],[9,7],[8,7],[7,7]],
    YELLOW:[[7,12],[7,11],[7,10],[7,9],[7,8],[7,7]],
    BLUE:[[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]]
  };
  const BASE={RED:[[2,2],[4,2],[2,4],[4,4]],GREEN:[[10,2],[12,2],[10,4],[12,4]],YELLOW:[[10,10],[12,10],[10,12],[12,12]],BLUE:[[2,10],[4,10],[2,12],[4,12]]};
  const START={RED:0,GREEN:13,YELLOW:26,BLUE:39};
  const rounded=(c,x,y,w,h,r)=>{c.beginPath();c.roundRect(x,y,w,h,r);};
  function tile(c,x,y,s,fill,stroke="#b7c7bb"){
    const pad=s*.055;rounded(c,x*s+pad,y*s+pad,s-pad*2,s-pad*2,s*.09);
    c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=Math.max(1,s*.025);c.stroke();
  }
  function drawBase(c,color,x,y,s){
    const span=s*6;
    c.fillStyle=COLORS[color];c.fillRect(x*s,y*s,span,span);
    c.fillStyle="rgba(0,0,0,.10)";c.fillRect(x*s,y*s,span,span);
    c.strokeStyle="rgba(255,255,255,.7)";c.lineWidth=s*.055;c.strokeRect(x*s+s*.08,y*s+s*.08,span-s*.16,span-s*.16);
    rounded(c,x*s+s*.72,y*s+s*.72,span-s*1.44,span-s*1.44,s*.3);
    c.fillStyle=SOFT[color];c.fill();c.strokeStyle="rgba(20,35,27,.35)";c.lineWidth=s*.04;c.stroke();
    BASE[color].forEach(([gx,gy],i)=>{
      const cx=(gx+.5)*s,cy=(gy+.5)*s;
      c.beginPath();c.arc(cx,cy,s*.34,0,Math.PI*2);c.fillStyle="#fff";c.fill();
      c.beginPath();c.arc(cx,cy,s*.245,0,Math.PI*2);c.fillStyle=COLORS[color];c.fill();
      c.beginPath();c.arc(cx-s*.07,cy-s*.08,s*.055,0,Math.PI*2);c.fillStyle="rgba(255,255,255,.55)";c.fill();
    });
  }
  function drawCenter(c,s){
    const x=6*s,y=6*s,w=3*s,h=3*s,mx=x+w/2,my=y+h/2;
    c.fillStyle="#f8f7ed";c.fillRect(x,y,w,h);
    const tris=[
      {color:COLORS.RED,pts:[[x,y],[x+w,y],[mx,my]]},
      {color:COLORS.GREEN,pts:[[x+w,y],[x+w,y+h],[mx,my]]},
      {color:COLORS.YELLOW,pts:[[x+w,y+h],[x,y+h],[mx,my]]},
      {color:COLORS.BLUE,pts:[[x,y+h],[x,y],[mx,my]]}
    ];
    tris.forEach(t=>{c.beginPath();c.moveTo(...t.pts[0]);c.lineTo(...t.pts[1]);c.lineTo(...t.pts[2]);c.closePath();c.fillStyle=t.color;c.fill();});
    c.beginPath();c.arc(mx,my,s*.36,0,Math.PI*2);c.fillStyle="#082217";c.fill();
    c.strokeStyle="#f3d77c";c.lineWidth=s*.055;c.stroke();
    c.fillStyle="#f4dfa0";c.font="900 "+(s*.31)+"px system-ui,sans-serif";c.textAlign="center";c.textBaseline="middle";c.fillText("A",mx,my);
  }
  function render(canvas,state,userId){
    const c=canvas.getContext("2d");if(!c)return;
    const n=15,s=canvas.width/n;
    c.clearRect(0,0,canvas.width,canvas.height);
    c.fillStyle="#07180f";c.fillRect(0,0,canvas.width,canvas.height);
    const bases={RED:[0,0],GREEN:[9,0],YELLOW:[9,9],BLUE:[0,9]};
    Object.entries(bases).forEach(([color,[x,y]])=>drawBase(c,color,x,y,s));

    const startColors={0:"RED",13:"GREEN",26:"YELLOW",39:"BLUE"};
    TRACK.forEach(([x,y],i)=>{
      const color=startColors[i];
      tile(c,x,y,s,color?COLORS[color]:"#f4f5ed",color?"#ffffffaa":"#aebdb1");
      if(color){
        c.beginPath();c.arc((x+.5)*s,(y+.5)*s,s*.12,0,Math.PI*2);
        c.fillStyle="#fff";c.fill();
      }
    });
    Object.entries(HOME).forEach(([color,path])=>path.forEach(([x,y],i)=>{
      tile(c,x,y,s,COLORS[color], "#ffffff88");
      if(i===path.length-1){
        c.beginPath();c.arc((x+.5)*s,(y+.5)*s,s*.12,0,Math.PI*2);c.fillStyle="#fff";c.fill();
      }
    }));
    drawCenter(c,s);

    const positions=state.tokenPositions||{};
    Object.entries(positions).forEach(([color,tokens])=>(tokens||[]).forEach((pos,i)=>{
      let x,y;
      if(pos===-1){[x,y]=BASE[color]?.[i]||[7,7];}
      else if(pos===999){x=7;y=7;}
      else if(pos>=100){[x,y]=HOME[color]?.[Math.min(5,Math.max(0,pos-100))]||[7,7];}
      else{const trackIndex=Number(pos);[x,y]=TRACK[trackIndex]||TRACK[0];}
      const cx=(x+.5)*s,cy=(y+.5)*s;
      c.save();c.shadowColor="#000a";c.shadowBlur=s*.12;c.shadowOffsetY=s*.055;
      c.beginPath();c.arc(cx,cy,s*.27,0,Math.PI*2);c.fillStyle=COLORS[color]||"#fff";c.fill();
      c.shadowBlur=0;c.shadowOffsetY=0;c.lineWidth=s*.055;c.strokeStyle="#fff";c.stroke();
      c.beginPath();c.arc(cx-s*.07,cy-s*.075,s*.065,0,Math.PI*2);c.fillStyle="rgba(255,255,255,.62)";c.fill();
      c.fillStyle="#102016";c.font="900 "+(s*.2)+"px system-ui,sans-serif";c.textAlign="center";c.textBaseline="middle";c.fillText(String(i+1),cx,cy+s*.015);
      c.restore();
    }));
    c.strokeStyle="#d7bd68";c.lineWidth=Math.max(3,s*.075);c.strokeRect(s*.035,s*.035,canvas.width-s*.07,canvas.height-s*.07);
  }
  window.ApexLudoBoard={render};
})();