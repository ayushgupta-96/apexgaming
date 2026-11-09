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
  function tile(c,x,y,s,fill,stroke="#82938a"){
    const px=x*s,py=y*s;
    c.fillStyle=fill;c.fillRect(px,py,s,s);
    c.strokeStyle=stroke;c.lineWidth=Math.max(1,s*.012);
    c.strokeRect(px+.5,py+.5,s-1,s-1);
  }
  function drawBase(c,color,x,y,s){
    const size=s*6,px=x*s,py=y*s;
    c.fillStyle=COLORS[color];c.fillRect(px,py,size,size);
    c.strokeStyle="#ffffff";c.lineWidth=Math.max(2,s*.055);
    c.strokeRect(px+s*.08,py+s*.08,size-s*.16,size-s*.16);
    const inset=s*.72,inner=size-inset*2;
    c.fillStyle=SOFT[color];c.fillRect(px+inset,py+inset,inner,inner);
    c.strokeStyle="rgba(20,35,27,.25)";c.lineWidth=Math.max(1,s*.018);
    c.strokeRect(px+inset,py+inset,inner,inner);
    BASE[color].forEach(([gx,gy])=>{
      const cx=(gx+.5)*s,cy=(gy+.5)*s,r=s*.22;
      c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fillStyle="#fff";c.fill();
      c.beginPath();c.arc(cx,cy,r*.72,0,Math.PI*2);c.fillStyle=COLORS[color];c.fill();
    });
  }
  function drawCenter(c,s){
    const x=6*s,y=6*s,w=3*s,h=3*s,mx=x+w/2,my=y+h/2;
    const tris=[
      {color:COLORS.RED,pts:[[x,y],[x+w,y],[mx,my]]},
      {color:COLORS.GREEN,pts:[[x+w,y],[x+w,y+h],[mx,my]]},
      {color:COLORS.YELLOW,pts:[[x+w,y+h],[x,y+h],[mx,my]]},
      {color:COLORS.BLUE,pts:[[x,y+h],[x,y],[mx,my]]}
    ];
    tris.forEach(t=>{
      c.beginPath();c.moveTo(...t.pts[0]);c.lineTo(...t.pts[1]);c.lineTo(...t.pts[2]);c.closePath();
      c.fillStyle=t.color;c.fill();
    });
    c.beginPath();c.arc(mx,my,s*.31,0,Math.PI*2);c.fillStyle="#fff";c.fill();
    c.strokeStyle="#34443a";c.lineWidth=Math.max(1,s*.025);c.stroke();
  }
  function render(canvas,state,userId){
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const n=15,size=canvas.width/n;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);

    // Four flat home quadrants with matching token bays.
    const bases={RED:[0,0],GREEN:[9,0],YELLOW:[9,9],BLUE:[0,9]};
    Object.entries(bases).forEach(([color,[x,y]])=>drawBase(ctx,color,x,y,size));

    // Neutral outer track and four straight home lanes.
    TRACK.forEach(([x,y],i)=>{
      const startColor=({0:"RED",13:"GREEN",26:"YELLOW",39:"BLUE"})[i];
      tile(ctx,x,y,size,startColor?COLORS[startColor]:"#fff", "#8b9b91");
      if(startColor){
        ctx.beginPath();ctx.arc((x+.5)*size,(y+.5)*size,size*.105,0,Math.PI*2);
        ctx.fillStyle="#fff";ctx.fill();
      }
    });
    Object.entries(HOME).forEach(([color,path])=>path.forEach(([x,y],i)=>{
      tile(ctx,x,y,size,COLORS[color],"#ffffff");
      if(i===path.length-1){
        ctx.beginPath();ctx.arc((x+.5)*size,(y+.5)*size,size*.105,0,Math.PI*2);
        ctx.fillStyle="#fff";ctx.fill();
      }
    }));

    // Small neutral corner connectors keep the visual track continuous
    // without changing the server's 52-position token index mapping.
    [[13,7],[7,13],[1,7]].forEach(([x,y])=>{
      tile(ctx,x,y,size,"#fff","#8b9b91");
    });
    drawCenter(ctx,size);

    // Only server-provided token positions are rendered.
    const positions=state.tokenPositions||{};
    Object.entries(positions).forEach(([color,tokens])=>(tokens||[]).forEach((pos,i)=>{
      let x,y;
      if(pos===-1){[x,y]=BASE[color]?.[i]||[7,7];}
      else if(pos===999){x=7;y=7;}
      else if(pos>=100){[x,y]=HOME[color]?.[Math.min(5,Math.max(0,pos-100))]||[7,7];}
      else{const trackIndex=Number(pos);[x,y]=TRACK[trackIndex]||TRACK[0];}
      const cx=(x+.5)*size,cy=(y+.5)*size,r=size*.23;
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=COLORS[color]||"#fff";ctx.fill();
      ctx.strokeStyle="#fff";ctx.lineWidth=Math.max(2,size*.035);ctx.stroke();
      ctx.beginPath();ctx.arc(cx-r*.22,cy-r*.25,r*.12,0,Math.PI*2);ctx.fillStyle="#ffffffaa";ctx.fill();
    }));
    ctx.strokeStyle="#263a2d";ctx.lineWidth=Math.max(2,size*.045);
    ctx.strokeRect(size*.02,size*.02,canvas.width-size*.04,canvas.height-size*.04);
  }
  window.ApexLudoBoard={render};
})();