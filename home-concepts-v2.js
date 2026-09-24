(() => {
  'use strict';
  const desktop = matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
  if (!desktop.matches) { location.replace('index.html'); return; }
  desktop.addEventListener('change', e => { if (!e.matches) location.replace('index.html'); });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const projects = [
    ['BIOCOOLER', 'biocooler.html'], ['SYLLABUS', 'https://syllabus.fly.dev/'],
    ['ATLANTA EXPLORER', 'https://atlanta-explorer.fly.dev'], ['PEPTOCOPIA', 'https://peptocopeia.com'],
    ['ORGANISM LOGGER', 'https://organism-logger.fly.dev'], ['THERMOROID', 'thermoroid.html'],
    ['ARTWORKS', 'artworks.html'], ['RELAY', 'https://relaycallbell.com'],
    ['CURRICULUM VITAE', 'research.html'], ['PATENTS', 'projects.html'], ['BIOGRAPHY', 'biography.html']
  ];
  const board = document.querySelector('#departures-board');
  const canvas = document.querySelector('#tiles');
  const links = document.querySelector('#board-links');
  const ctx = canvas.getContext('2d', {alpha: false});
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+*—';
  const radius = 14.7, radiusSquared = radius * radius;
  const lifetime = 1800, arrival = 60, departure = 180, flipPeriod = 720;
  const yellowLifetime = arrival + (lifetime - arrival - departure) * .6 + departure;
  const rainbow = [[255,222,53], [255,134,28], [40,115,255], [42,208,92], [229,34,32]];
  const colors = Array.from({length:20}, (_, i) => {
    const p = i / 19 * 4, segment = Math.min(3, Math.floor(p)), t = p - segment;
    return `rgb(${rainbow[segment].map((v,c) => Math.round(v + (rainbow[segment+1][c]-v)*t)).join(',')})`;
  });
  let mode = 0, cells = [], grid, ratio, fontSize, started;
  let frameId = null, timerId = null, lastPointer = null, hovered = new Set();
  const intro = new Set(), trails = new Map(), sprites = new Map();
  let blankSprite;
  board.dataset.trailMode = 'yellow';

  // These tiny card images are painted once, then reused for every matching tile.
  function sprite(char = ' ', color = '') {
    const key = color ? `dot:${color}` : char;
    if (sprites.has(key)) return sprites.get(key);
    const image = document.createElement('canvas');
    image.width = Math.ceil(grid.cw * ratio); image.height = Math.ceil(grid.ch * ratio);
    const c = image.getContext('2d');
    c.scale(ratio, ratio);
    const w = grid.cw, h = grid.ch, mid = h / 2, x = 2, y = 3, innerW = w - 4;
    const rounded = (x,y,w,h,r,fill) => { c.fillStyle = fill; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill(); };
    const gradient = (top,bottom,stops) => {
      const g = c.createLinearGradient(0,top,0,bottom);
      stops.forEach(([p,color]) => g.addColorStop(p,color)); return g;
    };
    c.fillStyle = '#1a1a1a'; c.fillRect(0,0,w,h);
    rounded(0,0,w,h,3,'#060606');
    c.fillStyle = '#303030'; c.fillRect(2,h-1,w-4,1);
    rounded(x,y,innerW,mid-y-.3,2,gradient(y,mid,[[0,'#383838'],[.12,'#141414'],[.45,'#050505'],[1,'#020202']]));
    rounded(x,mid+.3,innerW,h-y-mid-.3,2,gradient(mid,h-y,[[0,'#020202'],[.7,'#080808'],[.94,'#1e1e1e'],[1,'#070707']]));
    c.fillStyle = '#676767'; c.fillRect(x+1,y,innerW-2,.65);
    c.fillStyle = '#333'; c.fillRect(x+1,h-y-.65,innerW-2,.65);
    if (color) {
      c.fillStyle = color; c.beginPath(); c.arc(w/2,mid,Math.min(innerW,h-6)*.405,0,Math.PI*2); c.fill();
    } else if (char !== ' ') {
      c.font = `${fontSize}px "Times New Roman"`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const metrics = c.measureText(char);
      c.fillStyle = '#f7f7f3';
      c.fillText(char,w/2,mid+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2);
    }
    c.fillStyle = '#000'; c.fillRect(x,mid-.65,innerW,1.3);
    c.fillStyle = '#ffffff12'; c.fillRect(x,mid+.65,innerW,.5);
    const pin = gradient(mid-1,mid+2,[[0,'#777'],[.45,'#171717'],[1,'#050505']]);
    c.fillStyle = pin; c.fillRect(0,mid-1,3,3); c.fillRect(w-3,mid-1,3,3);
    const result = {image,key}; sprites.set(key,result); return result;
  }
  function draw(cell, face, opening = 1) {
    const scale = Math.round(Math.max(.015, opening)*32)/32;
    if (cell.face === face.key && cell.scale === scale) return;
    cell.face = face.key; cell.scale = scale;
    const {cw:w,ch:h} = grid, mid = h/2, x = cell.x, y = cell.y;
    if (scale >= .999) { ctx.drawImage(face.image,x,y,w,h); return; }
    ctx.drawImage(blankSprite.image,x,y,w,h);
    ctx.drawImage(face.image,0,mid*ratio,w*ratio,(h-mid)*ratio,x,y+mid,w,h-mid);
    const half = mid-3;
    ctx.drawImage(face.image,2*ratio,3*ratio,(w-4)*ratio,half*ratio,x+2,y+mid-half*scale,w-4,half*scale);
    ctx.drawImage(blankSprite.image,0,(mid-.65)*ratio,w*ratio,2*ratio,x,y+mid-.65,w,2);
  }
  function build() {
    stop(); intro.clear(); trails.clear(); sprites.clear(); hovered.clear(); lastPointer = null;
    const bounds = canvas.getBoundingClientRect();
    const cols = Math.max(42,Math.min(84,Math.floor(bounds.width/25)));
    const rows = Math.max(28,Math.floor(bounds.height/28));
    const cw = (bounds.width-(cols-1)*4)/cols, ch = (bounds.height-(rows-1)*5)/rows;
    grid = {cols,rows,cw,ch,pitchX:cw+4,pitchY:ch+5,left:bounds.left+scrollX,top:bounds.top+scrollY};
    ratio = Math.min(devicePixelRatio || 1,1.5);
    canvas.width = Math.ceil(bounds.width*ratio); canvas.height = Math.ceil(bounds.height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,bounds.width,bounds.height);
    fontSize = Math.min((cw-4)*1.12,(ch-6)*.95);
    cells = Array.from({length:cols*rows},(_,i)=>({
      x:(i%cols)*(cw+4),y:Math.floor(i/cols)*(ch+5),target:' ',protected:false,
      seed:Math.floor(Math.random()*10000),face:null,scale:null,settled:reduced
    }));
    links.replaceChildren();
    function word(text,row,col,href,name=false) {
      for (let i=0;i<text.length;i++) { const cell=cells[row*cols+col+i]; cell.target=text[i]; cell.protected=true; }
      const a=document.createElement('a'); a.href=href; a.className='board-link'; a.textContent=text;
      if(name) a.setAttribute('aria-label','Jacob Budnitz — switch to original homepage');
      a.style.left=`${col*(cw+4)}px`; a.style.top=`${row*(ch+5)}px`;
      a.style.width=`${text.length*(cw+4)-4}px`; a.style.height=`${ch}px`;
      links.append(a);
    }
    word('JACOB BUDNITZ',3,Math.floor((cols-13)/2),'index.html?home=classic',true);
    projects.forEach(([label,href],i)=>word(label,9+Math.floor(i/2)*3,
      Math.floor(cols*(i%2?.73:.27))-Math.floor(label.length/2),href));
    blankSprite=sprite();
    // Warm up the tiny glyph cache before animation; no text measurement during frames.
    for(const char of alphabet+' ') sprite(char);
    started=performance.now();
    cells.forEach(cell=>{
      cell.end=(cell.protected?3100:2400)+(cell.seed%300);
      if(reduced) draw(cell,sprite(cell.target));
      else { intro.add(cell); draw(cell,sprite(alphabet[cell.seed%alphabet.length])); }
    });
    if(!reduced) wake();
  }
  function stop() {
    cancelAnimationFrame(frameId); clearTimeout(timerId); frameId=timerId=null;
  }
  function wake() {
    if(document.hidden) return;
    clearTimeout(timerId); timerId=null;
    if(frameId===null) frameId=requestAnimationFrame(render);
  }
  function render() {
    frameId=null;
    if(document.hidden) return;
    const now=performance.now(), age=now-started;
    let moving=false, deadline=Infinity;
    for(const cell of intro) {
      if(age>=cell.end) { cell.settled=true; draw(cell,sprite(cell.target)); intro.delete(cell); continue; }
      const phase=age/flipPeriod+(cell.seed%100)/100;
      const char=alphabet[(cell.seed+Math.floor(phase)*13)%alphabet.length];
      draw(cell,sprite(char),Math.abs(Math.cos(Math.PI*phase))); moving=true;
    }
    for(const [cell,trail] of trails) {
      const elapsed=now-trail.started;
      const duration=trail.mode===0?yellowLifetime:lifetime;
      if(elapsed>=duration) { draw(cell,blankSprite); trails.delete(cell); continue; }
      const color=trail.mode===0?'#ffdf32':colors[Math.min(19,Math.floor(elapsed/(lifetime-departure)*20))];
      let face=sprite(' ',color), scale=1;
      if(!reduced && elapsed<arrival) { scale=.15+.85*elapsed/arrival; moving=true; }
      else if(elapsed>=duration-departure) {
        if(reduced) { deadline=Math.min(deadline,trail.started+duration); }
        else {
          const phase=(elapsed-(duration-departure))/departure;
          scale=Math.abs(1-2*phase); if(phase>=.5) face=blankSprite; moving=true;
        }
      } else if(trail.mode===1) {
        if(!reduced) { scale=Math.abs(Math.cos(Math.PI*elapsed/180)); moving=true; }
        else deadline=Math.min(deadline,trail.started+(Math.floor(elapsed/81)+1)*81);
      } else deadline=Math.min(deadline,trail.started+duration-departure);
      draw(cell,face,scale);
    }
    if(moving) frameId=requestAnimationFrame(render);
    else if(deadline<Infinity) timerId=setTimeout(()=>{timerId=null;wake();},Math.max(1,deadline-performance.now()));
  }
  // Exact swept-path hit testing retains fast strokes and coalesced pointer bends.
  function segment(point,now,touched) {
    const from=lastPointer||point, dx=point.x-from.x, dy=point.y-from.y, lengthSquared=dx*dx+dy*dy;
    const next=new Set();
    const minRow=Math.max(0,Math.floor((Math.min(from.y,point.y)-radius)/grid.pitchY));
    const maxRow=Math.min(grid.rows-1,Math.floor((Math.max(from.y,point.y)+radius)/grid.pitchY));
    for(let row=minRow;row<=maxRow;row++) {
      const cy=row*grid.pitchY+grid.ch/2;
      let lo=0,hi=1;
      if(dy) {
        const a=(cy-radius-from.y)/dy,b=(cy+radius-from.y)/dy;
        lo=Math.max(0,Math.min(a,b));hi=Math.min(1,Math.max(a,b));if(lo>hi)continue;
      } else if(Math.abs(cy-from.y)>radius)continue;
      const x0=from.x+dx*lo,x1=from.x+dx*hi;
      const minCol=Math.max(0,Math.floor((Math.min(x0,x1)-radius)/grid.pitchX));
      const maxCol=Math.min(grid.cols-1,Math.floor((Math.max(x0,x1)+radius)/grid.pitchX));
      for(let col=minCol;col<=maxCol;col++) {
        const cell=cells[row*grid.cols+col]; if(cell.protected||!cell.settled)continue;
        const cx=cell.x+grid.cw/2,cy=cell.y+grid.ch/2;
        const t=lengthSquared?Math.max(0,Math.min(1,((cx-from.x)*dx+(cy-from.y)*dy)/lengthSquared)):0;
        const ex=cx-from.x-t*dx,ey=cy-from.y-t*dy;
        if(ex*ex+ey*ey>radiusSquared)continue;
        if((cx-point.x)**2+(cy-point.y)**2<=radiusSquared)next.add(cell);
        if(hovered.has(cell)||touched.has(cell))continue;
        touched.add(cell);trails.set(cell,{started:now,mode});
        // Paint the response now, without waiting for the next frame.
        draw(cell,sprite(' ',mode===0?'#ffdf32':colors[0]),reduced?1:.15);
      }
    }
    hovered=next;lastPointer=point;
  }
  function pointer(event) {
    if(event.pointerType==='touch')return;
    const samples=event.getCoalescedEvents?.()||[];
    const touched=new Set(),now=performance.now(),ox=scrollX-grid.left,oy=scrollY-grid.top;
    for(const sample of samples.length?samples:[event])segment({x:sample.clientX+ox,y:sample.clientY+oy},now,touched);
    if(touched.size)wake();
  }
  function endPath(){lastPointer=null;hovered.clear();}
  board.addEventListener('onpointerrawupdate' in window?'pointerrawupdate':'pointermove',pointer,{passive:true});
  board.addEventListener('click',event=>{
    if(event.target.closest('a, button'))return;
    mode=1-mode;board.dataset.trailMode=mode?'rainbow':'yellow';endPath();pointer(event);
  });
  board.addEventListener('pointerleave',endPath);board.addEventListener('pointercancel',endPath);
  addEventListener('blur',endPath);addEventListener('scroll',endPath,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) { stop();trails.forEach((_,cell)=>draw(cell,blankSprite));trails.clear();endPath(); }
    else wake();
  });
  let resizeTimer;
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(desktop.matches)build();},150);});
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  build();
})();
