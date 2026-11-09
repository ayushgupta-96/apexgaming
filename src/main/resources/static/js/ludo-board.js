/* Classic 15x15 Ludo board renderer. Server remains authoritative for all token positions. */
(function(){
  "use strict";
  const TRACK=[
    [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[7,14],[8,14],[8,13],
    [8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],
    [12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],[6,1]
  ];
  // The final repeated coordinate closes the visual loop; the engine uses indices 0..51.
  TRACK.pop();
  const COLORS={RED:"#e94352",GREEN:"#16a66a",YELLOW:"#e7c54d",BLUE:"#267fc1"};
  const PALE={RED:"#f8dfe2",GREEN:"#d9f3e7",YELLOW:"#fff2c7",BLUE:"#dcecff"};
  const START={RED:0,GREEN:13,YELLOW:26,BLUE:39};
  const BASE={
    RED:[[1.5,1.5],[4.5,1.5],[1.5,4.5],[4.5,4.5]],
    GREEN:[[10.5,1.5],[13.5,1.5],[10.5,4.5],[13.5,4.5]],
    YELLOW:[[10.5,10.5],[13.5,10.5],[10.5,13.5],[13.5,13.5]],
    BLUE:[[1.5,10.5],[4.5,10.5],[1.5,13.5],[4.5,13.5]]
  };
  const HOME={
    RED:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    GREEN:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    YELLOW:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    BLUE:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
  };
  function cell(ctx,x,y,size,fill,stroke="#aeb9b3"){
    const px=x*size,py=y*size;
    ctx.fillStyle=fill;ctx.fillRect(px,py,size,size);
    ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(1,size*.018);
    ctx.strokeRect(px+.5,py+.5,size-1,size-1);
  }
  function drawBase(ctx,color,x,y,size){
    const side=size*6,px=x*size,py=y*size;
    ctx.fillStyle=COLORS[color];ctx.fillRect(px,py,side,side);
    ctx.strokeStyle="#fff";ctx.lineWidth=Math.max(2,size*.06);ctx.strokeRect(px+1,py+1,side-2,side-2);
    const inset=size*.72,inner=side-inset*2;
    ctx.fillStyle=PALE[color];ctx.fillRect(px+inset,py+inset,inner,inner);
    ctx.strokeStyle="#ffffff";ctx.lineWidth=Math.max(2,size*.07);ctx.strokeRect(px+inset,py+inset,inner,inner);
    BASE[color].forEach(([gx,gy])=>{
      const cx=gx*size,cy=gy*size,r=size*.36;
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
      ctx.strokeStyle=COLORS[color];ctx.lineWidth=Math.max(2,size*.06);ctx.stroke();
      ctx.beginPath();ctx.arc(cx,cy,r*.76,0,Math.PI*2);ctx.fillStyle=PALE[color];ctx.fill();
    });
  }
  function drawCenter(ctx,size){
    const x=6*size,y=6*size,w=3*size,h=3*size,mx=x+w/2,my=y+h/2;
    const wedges=[
      {color:COLORS.RED,points:[[x,y],[x+w,y],[mx,my]]},
      {color:COLORS.GREEN,points:[[x+w,y],[x+w,y+h],[mx,my]]},
      {color:COLORS.YELLOW,points:[[x+w,y+h],[x,y+h],[mx,my]]},
      {color:COLORS.BLUE,points:[[x,y+h],[x,y],[mx,my]]}
    ];
    wedges.forEach(w=>{
      ctx.beginPath();ctx.moveTo(...w.points[0]);ctx.lineTo(...w.points[1]);ctx.lineTo(...w.points[2]);ctx.closePath();
      ctx.fillStyle=w.color;ctx.fill();
    });
    ctx.beginPath();ctx.arc(mx,my,size*.24,0,Math.PI*2);ctx.fillStyle="#f7f4e8";ctx.fill();
    ctx.strokeStyle="#334c3e";ctx.lineWidth=2;ctx.stroke();
  }
  function drawTable(ctx,width,height){
    const bg=ctx.createLinearGradient(0,0,width,height);
    bg.addColorStop(0,"#0a2d57");bg.addColorStop(.48,"#1760a0");bg.addColorStop(1,"#09264b");
    ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
    ctx.save();ctx.globalAlpha=.13;ctx.strokeStyle="#b8ddff";ctx.lineWidth=2;
    for(let k=-height;k<width+height;k+=54){
      ctx.beginPath();ctx.moveTo(k,0);ctx.lineTo(k+height,height);ctx.stroke();
      ctx.beginPath();ctx.moveTo(k+19,0);ctx.lineTo(k+height+19,height);ctx.stroke();
    }
    for(let y=28;y<height;y+=100)for(let x=28;x<width;x+=100){
      ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();
      for(let a=0;a<4;a++){const angle=a*Math.PI/2;ctx.beginPath();ctx.arc(x+Math.cos(angle)*15,y+Math.sin(angle)*15,4,0,Math.PI*2);ctx.stroke();}
    }
    ctx.restore();
  }
  function render(canvas,state){
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);drawTable(ctx,W,H);
    const margin=Math.max(10,W*.025),boardSize=Math.min(W,H)-margin*2,size=boardSize/15;
    const ox=(W-boardSize)/2,oy=(H-boardSize)/2;
    ctx.save();ctx.shadowColor="#0009";ctx.shadowBlur=14;ctx.fillStyle="#fff";ctx.fillRect(ox-3,oy-3,boardSize+6,boardSize+6);ctx.restore();
    ctx.save();ctx.translate(ox,oy);
    // Four equal 6x6 home quadrants with large inset token yards.
    drawBase(ctx,"RED",0,0,size);
    drawBase(ctx,"GREEN",9,0,size);
    drawBase(ctx,"BLUE",0,9,size);
    drawBase(ctx,"YELLOW",9,9,size);
    // Neutral 52-cell outer path. Index mapping exactly follows the server's colour starts.
    TRACK.forEach(([row,col],index)=>{
      const startColor=Object.keys(START).find(color=>START[color]===index);
      cell(ctx,col,row,size,startColor?COLORS[startColor]:"#fff","#aab5af");
      if(startColor){
        ctx.beginPath();ctx.arc((col+.5)*size,(row+.5)*size,size*.12,0,Math.PI*2);
        ctx.fillStyle="#fff";ctx.fill();
      }
    });
    // Four straight coloured home lanes leading into the centre.
    Object.entries(HOME).forEach(([color,path])=>path.forEach(([row,col],i)=>{
      cell(ctx,col,row,size,COLORS[color],"#fff");
      if(i===path.length-1){
        ctx.beginPath();ctx.arc((col+.5)*size,(row+.5)*size,size*.12,0,Math.PI*2);
        ctx.fillStyle="#fff";ctx.fill();
      }
    }));
    drawCenter(ctx,size);
    // Only server-supplied positions are drawn. -1=base, 100..104=home lane, 999=finished.
    const positions=state?.tokenPositions||{};
    Object.entries(positions).forEach(([color,tokens])=>(tokens||[]).forEach((pos,index)=>{
      let row,col;
      if(pos===-1){const p=BASE[color]?.[index]||[7.5,7.5];col=p[0];row=p[1];}
      else if(pos===999){row=7.5;col=7.5;}
      else if(pos>=100){const p=HOME[color]?.[Math.min(5,Math.max(0,pos-100))]||[7,7];row=p[0]+.5;col=p[1]+.5;}
      else{const p=TRACK[Number(pos)]||TRACK[0];row=p[0]+.5;col=p[1]+.5;}
      const cx=col*size,cy=row*size,r=size*.31;
      ctx.save();ctx.shadowColor="#0008";ctx.shadowBlur=5;ctx.shadowOffsetY=2;
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=COLORS[color]||"#fff";ctx.fill();
      ctx.strokeStyle="#fff";ctx.lineWidth=Math.max(2,size*.055);ctx.stroke();ctx.restore();
      ctx.beginPath();ctx.arc(cx-r*.22,cy-r*.26,r*.12,0,Math.PI*2);ctx.fillStyle="#ffffffdd";ctx.fill();
    }));
    ctx.strokeStyle="#263c56";ctx.lineWidth=Math.max(2,size*.06);ctx.strokeRect(1,1,boardSize-2,boardSize-2);
    ctx.restore();
  }
  window.ApexLudoBoard={render};
})();
