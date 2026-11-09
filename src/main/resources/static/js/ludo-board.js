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
  function tile(c,x,y,s,fill,stroke="#9aa9a0"){
    const px=x*s,py=y*s;
    c.fillStyle=fill;c.fillRect(px,py,s,s);
    c.strokeStyle=stroke;c.lineWidth=Math.max(1,s*.018);
    c.strokeRect(px+.5,py+.5,s-1,s-1);
  }
  function drawBase(c,color,x,y,s){
    const side=s*6,px=x*s,py=y*s;
    c.fillStyle=COLORS[color];c.fillRect(px,py,side,side);
    c.fillStyle=SOFT[color];c.fillRect(px+s*.65,py+s*.65,side-s*1.3,side-s*1.3);
    c.strokeStyle="#ffffff";c.lineWidth=Math.max(2,s*.055);
    c.strokeRect(px+s*.65,py+s*.65,side-s*1.3,side-s*1.3);
    BASE[color].forEach(([gx,gy])=>{
      const cx=(gx+.5)*s,cy=(gy+.5)*s,r=s*.25;
      c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fillStyle="#fff";c.fill();
      c.strokeStyle=COLORS[color];c.lineWidth=Math.max(2,s*.05);c.stroke();
      c.beginPath();c.arc(cx,cy,r*.72,0,Math.PI*2);c.fillStyle=SOFT[color];c.fill();
    });
  }
  function drawCenter(c,s){
    const x=5*s,y=5*s,w=4*s,h=4*s,mx=x+w/2,my=y+h/2;
    const parts=[
      {color:COLORS.RED,pts:[[x,y],[x+w,y],[mx,my]]},
      {color:COLORS.GREEN,pts:[[x+w,y],[x+w,y+h],[mx,my]]},
      {color:COLORS.YELLOW,pts:[[x+w,y+h],[x,y+h],[mx,my]]},
      {color:COLORS.BLUE,pts:[[x,y+h],[x,y],[mx,my]]}
    ];
    parts.forEach(p=>{c.beginPath();c.moveTo(...p.pts[0]);c.lineTo(...p.pts[1]);c.lineTo(...p.pts[2]);c.closePath();c.fillStyle=p.color;c.fill();});
    c.beginPath();c.arc(mx,my,s*.28,0,Math.PI*2);c.fillStyle="#f7f3dd";c.fill();
    c.strokeStyle="#304336";c.lineWidth=2;c.stroke();
    c.fillStyle="#25382c";c.font="bold "+(s*.3)+"px Arial";c.textAlign="center";c.textBaseline="middle";c.fillText("A",mx,my);
  }
  function render(canvas,state,userId){
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const W=canvas.width,H=canvas.height,outer=24,boardSize=Math.min(W,H)-outer*2;
    const cell=boardSize/14,ox=(W-boardSize)/2,oy=(H-boardSize)/2;
    ctx.clearRect(0,0,W,H);
    // Deep-blue patterned table surround inspired by the supplied Ludo reference.
    const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#0c3971");bg.addColorStop(.5,"#15569a");bg.addColorStop(1,"#09264e");
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.12;ctx.strokeStyle="#b7dcff";ctx.lineWidth=2;
    for(let k=-W;k<W*2;k+=58){ctx.beginPath();ctx.moveTo(k,0);ctx.lineTo(k+H,H);ctx.stroke();ctx.beginPath();ctx.moveTo(k+22,0);ctx.lineTo(k+H+22,H);ctx.stroke();}
    for(let y=24;y<H;y+=112)for(let x=24;x<W;x+=112){
      ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke();
      for(let a=0;a<4;a++){const ang=a*Math.PI/2;ctx.beginPath();ctx.arc(x+Math.cos(ang)*16,y+Math.sin(ang)*16,5,0,Math.PI*2);ctx.stroke();}
    }
    ctx.restore();
    ctx.save();ctx.shadowColor="#0009";ctx.shadowBlur=18;ctx.fillStyle="#fff";ctx.fillRect(ox-3,oy-3,boardSize+6,boardSize+6);ctx.restore();
    ctx.save();ctx.translate(ox,oy);
    const bases={RED:[0,0],GREEN:[8,0],YELLOW:[8,8],BLUE:[0,8]};
    Object.entries(bases).forEach(([color,[x,y]])=>drawBase(ctx,color,x,y,cell));
    // Outer track cells, using the existing server position index order.
    TRACK.forEach(([x,y],i)=>{
      const safe=({0:"RED",13:"GREEN",26:"YELLOW",39:"BLUE"})[i];
      tile(ctx,x,y,cell,safe?COLORS[safe]:"#fff","#a9b5ad");
      if(safe){ctx.beginPath();ctx.arc((x+.5)*cell,(y+.5)*cell,cell*.12,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();}
    });
    // Visual bridge tiles close the four diagonal seams in the legacy track map.
    [[13,7],[7,13],[1,7],[5,0]].forEach(([x,y])=>tile(ctx,x,y,cell,"#fff","#a9b5ad"));
    Object.entries(HOME).forEach(([color,path])=>path.forEach(([x,y],i)=>{
      tile(ctx,x,y,cell,COLORS[color],"#ffffff");
      if(i===path.length-1){ctx.beginPath();ctx.arc((x+.5)*cell,(y+.5)*cell,cell*.12,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();}
    }));
    drawCenter(ctx,cell);
    // Token coordinates are read only from the server's board state.
    const positions=state.tokenPositions||{};
    Object.entries(positions).forEach(([color,tokens])=>(tokens||[]).forEach((pos,i)=>{
      let x,y;
      if(pos===-1){[x,y]=BASE[color]?.[i]||[7,7];}
      else if(pos===999){x=7;y=7;}
      else if(pos>=100){[x,y]=HOME[color]?.[Math.min(5,Math.max(0,pos-100))]||[7,7];}
      else{[x,y]=TRACK[Number(pos)]||TRACK[0];}
      const cx=(x+.5)*cell,cy=(y+.5)*cell,r=cell*.29;
      ctx.save();ctx.shadowColor="#0008";ctx.shadowBlur=5;ctx.shadowOffsetY=2;
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=COLORS[color]||"#fff";ctx.fill();
      ctx.strokeStyle="#fff";ctx.lineWidth=Math.max(2,cell*.055);ctx.stroke();
      ctx.restore();
      ctx.beginPath();ctx.arc(cx-r*.22,cy-r*.27,r*.12,0,Math.PI*2);ctx.fillStyle="#ffffffd9";ctx.fill();
    }));
    ctx.strokeStyle="#344e6b";ctx.lineWidth=2;ctx.strokeRect(1,1,boardSize-2,boardSize-2);
    ctx.restore();
  }
  window.ApexLudoBoard={render};
})();