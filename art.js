"use strict";
/* ============================================================================
   ART  -  palettes, palette quantizer, procedural pixel-art textures + sprites
   Look: gritty Korean street pixel art (dusty beige/grey/pink, dark navy outlines,
   flat colours). One locked 'real' palette; waves only tint the sky (see setMood in game.js).
   ============================================================================ */
const NAVY = '#1b1f2e';
const PALETTES = {
  real:['#1b1f2e','#2c3142','#3f4658','#5a6275','#7d8597','#a3aab8','#c9cdd6','#e8e6e0',
        '#efe3cf','#d9c8a8','#bfa985','#8f7b5e','#5e4f3c','#f2b8b0','#e08f8a','#b86a6e',
        '#bcd6e8','#8fb4d0','#5f89ab','#3f5f82','#8fa66a','#6b8650','#4a6b3c','#34502f',
        '#b5463f','#7a2a30','#e0a050','#c07a3a','#e8c860','#3cff8a','#4be08a','#f1c27d',
        '#c98f62','#ff5a4a','#4a90d9','#fdf6e3','#ffe14a',
        '#6b7387','#98a0b0','#4b5266','#d4d0c8','#a89f91','#f4f1ea','#8d94a3']
};
let PAL = 'real';
const palCache = {};
function getPal(name){
  if (palCache[name]) return palCache[name];
  const cols = PALETTES[name].map(h => { const n = parseInt(h.slice(1),16); return [n>>16&255, n>>8&255, n&255]; });
  const lut = new Uint8Array(32768);
  for (let i=0;i<32768;i++){
    const r=((i>>10)&31)*8+4, g=((i>>5)&31)*8+4, b=(i&31)*8+4; let best=0, bd=1e9;
    for (let j=0;j<cols.length;j++){ const c=cols[j], dr=r-c[0], dg=g-c[1], db=b-c[2], d=dr*dr*3+dg*dg*4+db*db*2; if (d<bd){ bd=d; best=j; } }
    lut[i] = best;
  }
  const lut32 = new Uint32Array(32768);                     // index -> packed RGBA (little-endian), for the fast snap below
  for (let i=0;i<32768;i++){ const c = cols[lut[i]]; lut32[i] = ((255<<24) | (c[2]<<16) | (c[1]<<8) | c[0]) >>> 0; }
  return palCache[name] = { cols, lut, lut32 };
}
/* snap a 2D canvas to the palette (used for the isometric intro; 3D gameplay does this on the GPU in game.js) */
function quantize(ctx, w, h){
  const img = ctx.getImageData(0,0,w,h), u = new Uint32Array(img.data.buffer), L = getPal(PAL).lut32;
  for (let i=0, n=w*h; i<n; i++){ const v = u[i]; u[i] = L[((v & 0xf8) << 7) | ((v >> 6) & 0x3e0) | ((v >> 19) & 0x1f)]; }   // one read + one write per pixel
  ctx.putImageData(img,0,0);
}
/* ---------- tiny drawing helpers ---------- */
function mkCanvas(w,h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
let _s = 1337;
function rnd(){ _s = (_s*16807) % 2147483647; return (_s-1)/2147483646; }
const ri = (a,b) => a + Math.floor(rnd()*(b-a+1));
const pick = arr => arr[ri(0,arr.length-1)];
function px(g,x,y,w,h,c){ g.fillStyle = c; g.fillRect(x,y,w,h); }
function speckle(g,w,h,cols,n){ for (let i=0;i<n;i++) px(g,ri(0,w-1),ri(0,h-1),1,1,pick(cols)); }
function makeTex(c, repeat, mip){   // mip = mipmapped minification (world textures): kills far-away shimmer
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = mip ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter; t.generateMipmaps = !!mip;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return t;
}

/* ---------- base 64x64 tiles ---------- */
const PAINT = {
  asphalt(g){ px(g,0,0,64,64,'#5a6275'); speckle(g,64,64,['#3f4658','#7d8597','#2c3142'],30);
    let x=ri(8,50), y=0; for (let i=0;i<30;i++){ px(g,x,y,1,2,'#2c3142'); y+=2; x+=ri(-1,1); } },
  sidewalk(g){ px(g,0,0,64,64,'#a3aab8'); px(g,0,0,64,2,'#7d8597'); px(g,0,32,64,2,'#7d8597'); px(g,0,0,2,32,'#7d8597'); px(g,32,32,2,32,'#7d8597');
    speckle(g,64,64,['#c9cdd6','#8f96a6','#7d8597'],16); px(g,ri(6,40),ri(6,24),14,6,'#8f96a6'); },
  wallCream(g){ px(g,0,0,64,64,'#efe3cf'); for (let i=0;i<8;i++){ const x=ri(0,62), l=ri(10,44); px(g,x,0,2,l,'#d9c8a8'); px(g,x,l,2,3,'#bfa985'); }
    speckle(g,64,64,['#d9c8a8','#bfa985'],14); px(g,ri(4,40),ri(20,50),18,8,'#d9c8a8'); },
  concrete(g){ px(g,0,0,64,64,'#7d8597'); for (let y=0;y<64;y+=21) px(g,0,y,64,2,'#5a6275'); for (let y=0;y<3;y++) px(g,(y%2)*32+16,y*21,2,21,'#5a6275');
    speckle(g,64,64,['#5a6275','#a3aab8','#8f96a6'],20); px(g,ri(4,40),ri(8,40),20,10,'#6b7387'); },
  roof(g){ px(g,0,0,64,64,'#5a6275'); speckle(g,64,64,['#3f4658','#7d8597','#a3aab8'],40); },
  crate(g){ px(g,0,0,64,64,'#c07a3a'); for (let y=0;y<64;y+=16) px(g,0,y,64,2,'#8f5a3a');
    px(g,0,0,4,64,'#8f5a3a'); px(g,60,0,4,64,'#8f5a3a'); px(g,0,60,64,4,'#8f5a3a'); px(g,0,0,64,4,'#8f5a3a');
    for (let i=0;i<56;i++){ px(g,4+i,4+i,2,2,'#8f5a3a'); px(g,58-i,4+i,2,2,'#8f5a3a'); } speckle(g,64,64,['#e0a050','#5e4f3c'],12); },
  metal(g){ px(g,0,0,64,64,'#5f89ab'); for (let x=0;x<64;x+=4) px(g,x,0,1,64,'#3f5f82'); px(g,0,0,64,4,'#3f4658'); px(g,0,60,64,4,'#3f4658');
    speckle(g,64,64,['#b5463f','#8fb4d0'],8); },
  dumpster(g){ px(g,0,0,64,64,'#4a6b3c'); for (let x=0;x<64;x+=8) px(g,x,6,2,58,'#34502f'); px(g,0,0,64,6,'#2c3142'); speckle(g,64,64,['#6b8650','#2c3142'],12); },
  barrier(g){ px(g,0,0,64,64,'#c9cdd6'); for (let i=-4;i<10;i++){ px(g,i*10,40,5,12,'#b5463f'); } px(g,0,52,64,12,'#a3aab8'); speckle(g,64,64,['#8f96a6','#e8e6e0'],14); },
  vend(g){ px(g,0,0,64,64,'#b5463f'); px(g,8,8,34,40,'#bcd6e8'); for (let r=0;r<3;r++) for (let c=0;c<4;c++) px(g,10+c*8,10+r*12,6,8,pick(['#e0a050','#f2b8b0','#5f89ab','#e8e6e0']));
    px(g,46,12,12,18,'#2c3142'); px(g,46,34,12,6,'#e8e6e0'); px(g,8,52,50,6,'#2c3142'); },
  tag(g){ PAINT.concrete(g); g.lineWidth = 3; for (const c of ['#f2b8b0','#ffe14a','#4a90d9']){ g.strokeStyle = c; g.beginPath(); g.moveTo(ri(4,20),ri(10,50)); g.quadraticCurveTo(ri(20,40),ri(0,60),ri(44,60),ri(10,50)); g.stroke(); } },
};
const baseCache = {}, tileCache = {};
function tiled(name, rx, ry){
  const key = name+'|'+rx.toFixed(2)+'|'+ry.toFixed(2);
  if (tileCache[key]) return tileCache[key];
  if (!baseCache[name]){ _s = 500 + name.length*31; const c = mkCanvas(64,64); PAINT[name](c.getContext('2d')); baseCache[name] = c; }
  const t = makeTex(baseCache[name], true, true); t.repeat.set(rx, ry);
  return tileCache[key] = t;
}

/* ---------- building facades (the hero asset: matches the show's shopfront look) ---------- */
function paintWindow(g,x,y,w,h,ac){
  px(g,x-2,y-2,w+4,h+4,NAVY); px(g,x-1,y-1,w+2,h+2,'#7d8597'); px(g,x+2,y+2,w-4,h-4,'#8fb4d0');
  px(g,x+4,y+4,6,3,'#bcd6e8'); px(g,x+6,y+8,3,3,'#bcd6e8'); px(g,x+w/2-1,y+2,2,h-4,'#7d8597'); px(g,x+2,y+h/2,w-4,2,'#7d8597');
  px(g,x-3,y+h+2,w+6,3,'#a3aab8'); px(g,x-3,y+h+5,w+6,1,NAVY);
  if (ac){ px(g,x+w-22,y-14,24,16,NAVY); px(g,x+w-21,y-13,22,14,'#c9cdd6'); px(g,x+w-17,y-11,10,10,'#5a6275'); px(g,x+w-5,y-10,4,8,'#a3aab8'); }
}
function paintFacade(kind, wm, hm, seedBump){
  _s = 97 + kind.length*13 + Math.floor(wm)*7 + (seedBump||0)*101;
  const W = Math.round(wm*16), H = Math.round(hm*16), c = mkCanvas(W,H), g = c.getContext('2d');
  const base = { shutter:'#efe3cf', staffing:'#d9c8a8', cstore:'#e8e6e0', plain:'#c9bba0' }[kind];
  const dark = { shutter:'#d9c8a8', staffing:'#bfa985', cstore:'#c9cdd6', plain:'#a3926f' }[kind];
  px(g,0,0,W,H,base);
  for (let i=0;i<W/12;i++){ const x=ri(0,W-3), l=ri(12,70); px(g,x,10,2,l,dark); px(g,x,10+l,2,3,dark); }
  speckle(g,W,H,[dark,'#bfa985'],W);
  px(g,0,0,W,9,'#a3aab8'); px(g,0,9,W,2,'#5a6275'); px(g,0,0,W,1,NAVY);
  const gy = H-54, floors = Math.max(1, Math.floor((gy-26)/46)), n = Math.max(2, Math.floor(wm/3.6));
  for (let f=0;f<floors;f++) for (let i=0;i<n;i++) paintWindow(g, Math.floor((i+0.5)*W/n)-20, 24+f*46, 40, 30, rnd()<.25);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'shutter'){
    px(g,6,gy-10,W*0.6,22,NAVY); px(g,8,gy-8,W*0.6-4,18,'#a3aab8');
    g.font = 'bold 14px "Courier New",monospace'; g.fillStyle = '#3f4658'; g.fillText('BIZNES OUTLET', 8+(W*0.6-4)/2, gy+1);
    const sw = Math.floor(W*0.5); px(g,8,gy+14,sw+4,H-gy-14,NAVY); px(g,10,gy+16,sw,H-gy-16,'#a3aab8');
    for (let y=gy+18;y<H;y+=3) px(g,10,y,sw,1,'#7d8597'); px(g,10+sw/2-4,H-8,8,3,'#5a6275');
    px(g,Math.floor(W*0.68),gy+16,34,H-gy-16,NAVY); px(g,Math.floor(W*0.68)+2,gy+18,30,H-gy-18,'#5a6275'); px(g,Math.floor(W*0.68)+6,gy+22,22,20,'#8fb4d0');
    px(g,Math.floor(W*0.82),gy+2,36,16,NAVY); px(g,Math.floor(W*0.82)+2,gy+4,32,12,'#f2b8b0'); g.font='bold 8px "Courier New",monospace'; g.fillStyle='#7a2a30'; g.fillText('HIRING',Math.floor(W*0.82)+18,gy+10);
  } else if (kind === 'staffing'){
    const sx = Math.floor(W*0.08), sw = Math.floor(W*0.62);
    px(g,sx-2,gy-34,sw+4,40,NAVY); px(g,sx,gy-32,sw,36,'#a3aab8'); px(g,sx+4,gy-28,sw-8,28,'#e8e6e0');
    g.font = 'bold 17px "Courier New",monospace'; g.fillStyle = NAVY; g.fillText('SYNERGY STAFFING', sx+sw/2, gy-14);
    px(g,sx-2,gy+8,W*0.84,18,NAVY); px(g,sx,gy+10,W*0.84-4,14,'#f2b8b0');
    g.font = 'bold 10px "Courier New",monospace'; g.fillStyle = '#b86a6e'; g.fillText('PRODUCTIVITY IS PEACE', sx+(W*0.84-4)/2, gy+17);
    px(g,sx,gy+28,Math.floor(W*0.84),H-gy-28,NAVY);
    for (let i=0;i<3;i++){ const x = sx+6+i*Math.floor(W*0.27); px(g,x,gy+32,Math.floor(W*0.24),H-gy-36,'#2c3142'); px(g,x+4,gy+36,16,26,pick(['#f2b8b0','#e08f8a','#bcd6e8'])); }
  } else if (kind === 'cstore'){
    px(g,6,gy-8,W-12,24,NAVY);
    for (let x=8;x<W-8;x+=10){ px(g,x,gy-6,5,20,'#b5463f'); px(g,x+5,gy-6,5,20,'#e8e6e0'); }
    px(g,Math.floor(W/2)-50,gy-4,100,16,NAVY); px(g,Math.floor(W/2)-48,gy-2,96,12,'#3f5f82'); g.font='bold 11px "Courier New",monospace'; g.fillStyle='#e8e6e0'; g.fillText('MOO-MART 24',Math.floor(W/2),gy+4);
    px(g,6,gy+18,W-12,H-gy-18,NAVY); px(g,8,gy+20,W-16,H-gy-22,'#bcd6e8');
    for (let r=0;r<3;r++) for (let x=12;x<W-20;x+=14) px(g,x,gy+24+r*8,10,6,pick(['#c07a3a','#e0a050','#8f7b5e','#b5463f','#6b8650','#5f89ab']));
    px(g,Math.floor(W/2)-8,gy+20,16,H-gy-22,'#5f89ab'); px(g,Math.floor(W/2)-1,gy+20,2,H-gy-22,NAVY);
  } else {
    for (let i=0;i<n;i++) paintWindow(g, Math.floor((i+0.5)*W/n)-20, gy+6, 40, 26, false);
    const dx = Math.floor(W*0.5); px(g,dx-1,gy+34,28,H-gy-34,NAVY); px(g,dx+1,gy+36,24,H-gy-36,'#5a6275'); px(g,dx+5,gy+40,16,14,'#8fb4d0');
  }
  g.strokeStyle = NAVY; g.lineWidth = 1;
  for (const y0 of [28, 60]){ g.beginPath(); g.moveTo(0,y0); g.quadraticCurveTo(W*0.5,y0+18+ri(0,10),W,y0+ri(-4,8)); g.stroke(); }
  px(g,0,0,1,H,NAVY); px(g,W-1,0,1,H,NAVY); px(g,0,H-1,W,1,NAVY);
  return makeTex(c,false,true);
}

/* ---------- sky dome + skyline ---------- */
function paintSky(){
  _s = 4242; const c = mkCanvas(256,128), g = c.getContext('2d');
  const gr = g.createLinearGradient(0,0,0,128); gr.addColorStop(0,'#5f89ab'); gr.addColorStop(0.55,'#8fb4d0'); gr.addColorStop(1,'#bcd6e8');
  g.fillStyle = gr; g.fillRect(0,0,256,128);
  for (let i=0;i<9;i++){ const x=ri(0,255), y=ri(30,92), w=ri(30,70);
    px(g,x,y,w,5,'#e8e6e0'); px(g,x+6,y-4,w-18,5,'#e8e6e0'); px(g,x+10,y+5,w-14,3,'#c9cdd6'); }
  return makeTex(c,true);
}
function paintTower(){
  _s = 777; const c = mkCanvas(32,128), g = c.getContext('2d');
  px(g,0,0,32,128,'#7d8597'); px(g,0,0,3,128,'#5a6275');
  for (let y=6;y<124;y+=8) for (let x=5;x<28;x+=7) px(g,x,y,4,5,rnd()<.12?'#e8c860':'#5f89ab');
  px(g,0,0,32,3,'#3f4658');
  return makeTex(c,true);
}

function outlined(c, color){
  const w=c.width, h=c.height, o=mkCanvas(w+2,h+2), g=o.getContext('2d'), sil=mkCanvas(w,h), sg=sil.getContext('2d');
  sg.drawImage(c,0,0); sg.globalCompositeOperation='source-in'; sg.fillStyle=color||NAVY; sg.fillRect(0,0,w,h);
  for (const [dx,dy] of [[0,1],[2,1],[1,0],[1,2],[0,0],[2,0],[0,2],[2,2]]) g.drawImage(sil,dx,dy);
  g.drawImage(c,1,1); return o;
}
const enemyTexCache = {};
function enemyTex(kind, state, frame, white){
  const key = kind+state+frame+(white?'w':'');
  if (enemyTexCache[key]) return enemyTexCache[key];
  let c = outlined(paintEnemyRaw(kind,state,frame));
  if (white){ const w = mkCanvas(c.width,c.height), g = w.getContext('2d'); g.drawImage(c,0,0); g.globalCompositeOperation='source-atop'; g.fillStyle='#ffffff'; g.fillRect(0,0,w.width,w.height); c = w; }
  const t = makeTex(c,false); return enemyTexCache[key] = t;
}
function paperTex(){
  const c = mkCanvas(14,14), g = c.getContext('2d');
  px(g,0,0,14,14,NAVY); px(g,1,1,12,12,'#e8e6e0'); px(g,3,3,8,2,'#7d8597'); px(g,3,6,8,1,'#7d8597'); px(g,3,9,5,3,'#b5463f');
  return makeTex(c,false);
}

