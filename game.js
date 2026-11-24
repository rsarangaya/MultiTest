"use strict";
/* ============================================================================
   THE SUPER SLASHER 5000  -  first-person hack & slash vs. BizNes Corp's alien suits
   Movement: Apex-style sprint / slide / slide-jump / mantle / bhop + GunZ-style
   wall-run / wall-jump / dash / slash-lunge.   Skills (unlocked with skill points):
   wall flip, dash slash, whirlwind, slide chain.
   Rendering: low-res 3D -> depth-edge navy outlines -> palette quantize -> 2x upscale.
   The intro cutscene lives in intro.js; menus + rebinding are at the bottom of this file.
   ============================================================================ */
const DW = 960, DH = 540, LW = 480, LH = 270;
const disp = document.getElementById('c'), dctx = disp.getContext('2d');
const lo = mkCanvas(LW, LH), lctx = lo.getContext('2d', { willReadFrequently:true });
const renderer = new THREE.WebGLRenderer({ antialias:false, preserveDrawingBuffer:true });
renderer.setSize(LW, LH, false);
const camera = new THREE.PerspectiveCamera(80, LW/LH, 0.15, 250);
camera.rotation.order = 'YXZ';
buildLevel();

/* ============================ settings + key binds ============================ */
const DEFAULT_BINDS = { forward:'KeyW', back:'KeyS', left:'KeyA', right:'KeyD', jump:'Space', sprint:'ShiftLeft',
                        slide:'KeyC', dash:'KeyQ', flip:'KeyE', attack:'Mouse0', block:'Mouse2' };
const ACTIONS = [['forward','Move forward'],['back','Move back'],['left','Strafe left'],['right','Strafe right'],
                 ['jump','Jump / wall-jump / mantle'],['sprint','Sprint'],['slide','Crouch / slide'],['dash','Dash'],
                 ['flip','Wall flip (skill)'],['attack','Slash'],['block','Block / parry']];
const binds = Object.assign({}, DEFAULT_BINDS), settings = { sens:1.0, fov:80, music:6, sfx:8 };
function loadSettings(){
  try { const s = JSON.parse(localStorage.getItem('deadend_settings')); if (s){ Object.assign(binds, s.binds||{}); if (s.sens) settings.sens = s.sens; if (s.fov) settings.fov = s.fov; if (s.music !== undefined) settings.music = s.music; if (s.sfx !== undefined) settings.sfx = s.sfx; } } catch(e){}
}
function saveSettings(){ try { localStorage.setItem('deadend_settings', JSON.stringify({ binds, sens:settings.sens, fov:settings.fov, music:settings.music, sfx:settings.sfx })); } catch(e){} }
loadSettings();
function codeName(c){
  if (c.startsWith('Mouse')) return ['LEFT CLICK','MIDDLE CLICK','RIGHT CLICK'][+c.slice(5)] || c.toUpperCase();
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  return ({ Space:'SPACE', ShiftLeft:'L-SHIFT', ShiftRight:'R-SHIFT', ControlLeft:'L-CTRL', ControlRight:'R-CTRL', AltLeft:'L-ALT',
            ArrowUp:'UP', ArrowDown:'DOWN', ArrowLeft:'LEFT', ArrowRight:'RIGHT', Tab:'TAB' })[c] || c.toUpperCase();
}
function setBind(action, code){
  for (const a in binds) if (binds[a] === code && a !== action) binds[a] = binds[action];   // swap on conflict
  binds[action] = code; saveSettings();
}

/* ============================ input ============================ */
const keys = {}, pressed = {}, mouse = { x:-1, y:-1 };
const held = a => !!keys[binds[a]], tapped = a => !!pressed[binds[a]];
let capture = null;                                   // action currently being rebound
let state = 'menu';                                   // menu|options|skills|intro|card|play|store|paused|dead|exited
let pauseFrom = 'play';                               // which mode a pause returns to (street 'play' or 'store')
let optionsFrom = 'menu', skillsFrom = 'paused';
const locked = () => document.pointerLockElement === disp;
function lockPointer(){ try { const r = disp.requestPointerLock(); if (r && r.catch) r.catch(()=>{}); } catch(e){} }

addEventListener('keydown', e => {
  if (e.target && e.target.id === 'nm'){ if (e.key === 'Enter'){ e.preventDefault(); nameDoneTouch(); } return; }      // typing in the mobile name box
  if (e.code === 'Backquote' && !capture && !(IN.on && IN.nameMode)){ e.preventDefault(); DBG.on = !DBG.on; return; }
  if (!Music.on) startMusic();
  if (typeof introKey === 'function' && introKey(e)) return;
  if (capture){ e.preventDefault(); if (e.code !== 'Escape') setBind(capture, e.code); capture = null; return; }
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function mpos(e){ const r = disp.getBoundingClientRect(); mouse.x = (e.clientX-r.left)*DW/r.width; mouse.y = (e.clientY-r.top)*DH/r.height; }
disp.addEventListener('mousemove', e => { if (!locked()) mpos(e); });
disp.addEventListener('contextmenu', e => e.preventDefault());
disp.addEventListener('mousedown', e => {
  e.preventDefault(); const code = 'Mouse'+e.button; if (!Music.on) startMusic();
  if (state === 'play'){ if (!locked()) lockPointer(); keys[code] = true; pressed[code] = true; return; }
  mpos(e);
  if (state === 'intro' || state === 'card'){ introMouse(); return; }
  if (state === 'store'){ if (ST.battle) clickUI(); else { keys[code] = true; pressed[code] = true; } return; }
  if (capture){ setBind(capture, code); capture = null; return; }
  clickUI();
});
addEventListener('mouseup', e => { keys['Mouse'+e.button] = false; });
/* ---- touch (testing build: the intro + all menus are playable; the street and store have no touch controls yet) ----
   A tap acts like a click. On-screen buttons (drawn on the canvas) stand in for the keys the intro uses: WASD, Enter, hold-F fast-forward, Esc skip. */
let IS_TOUCH = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
const touchHeld = {};
const TB_DPAD = [ { k:'KeyW', x:59, y:361, w:50, h:50, t:'^' }, { k:'KeyS', x:59, y:469, w:50, h:50, t:'v' }, { k:'KeyA', x:5, y:415, w:50, h:50, t:'<' }, { k:'KeyD', x:113, y:415, w:50, h:50, t:'>' } ];
const TB_INTRO = TB_DPAD.concat([ { k:'Enter', x:840, y:420, w:100, h:56, t:'OK' }, { k:'KeyF', x:840, y:360, w:100, h:50, t:'FAST >>' }, { k:'Escape', x:840, y:300, w:100, h:50, t:'SKIP' } ]);
const TB_TAB = { k:'Tab', x:724, y:420, w:100, h:56, t:'TAB' }, TB_MENU = [ { k:'Escape', x:840, y:16, w:100, h:44, t:'MENU' } ];
function tbActive(){
  if (state === 'intro' || state === 'card') return IN.nameMode ? [NAME_DONE] : IN.creator ? TB_INTRO.concat([TB_TAB]) : TB_INTRO;
  if (state === 'play' || state === 'store') return (state === 'play' && OBJ.phase === 'arrive') ? [] : TB_MENU;
  return [];
}
function touchStartMusic(){ if (!Music.on) startMusic(); }
/* mobile name entry: a real <input> sits over the canvas name field (tapping it opens the phone keyboard) + a DONE button */
const nmEl = document.getElementById('nm'), NAME_DONE = { k:'NameDone', x:400, y:366, w:160, h:54, t:'DONE' };
function nameDoneTouch(){ IN.nameBuf = nmEl.value.replace(/[^A-Za-z0-9 '\-]/g, '').slice(0, 12); IN.nameDone = true; nmEl.blur(); }
nmEl.addEventListener('input', () => { const v = nmEl.value.replace(/[^A-Za-z0-9 '\-]/g, '').slice(0, 12); if (v !== nmEl.value) nmEl.value = v; IN.nameBuf = v; });
function syncNameBox(){
  const on = IS_TOUCH && state === 'intro' && IN.on && IN.nameMode;
  if (!on){ if (nmEl.style.display !== 'none'){ nmEl.style.display = 'none'; nmEl.blur(); } return; }
  const r = disp.getBoundingClientRect(), sc = r.width/DW;
  if (nmEl.style.display === 'none'){ nmEl.style.display = 'block'; nmEl.value = ''; }
  nmEl.style.left = (r.left + 263*sc) + 'px'; nmEl.style.top = (r.top + 259*sc) + 'px'; nmEl.style.width = (434*sc) + 'px'; nmEl.style.height = (40*sc) + 'px';
  nmEl.style.fontSize = Math.max(16, 26*sc) + 'px';
}
disp.addEventListener('touchstart', e => {
  e.preventDefault(); IS_TOUCH = true; touchStartMusic();
  for (const t of e.changedTouches){
    mpos(t); const b = tbActive().find(b => mouse.x >= b.x && mouse.x <= b.x+b.w && mouse.y >= b.y && mouse.y <= b.y+b.h);
    if (b === NAME_DONE){ nameDoneTouch(); continue; }
    if (b){ touchHeld[t.identifier] = b.k; if (!keys[b.k]) pressed[b.k] = true; keys[b.k] = true; continue; }
    if (state === 'intro' || state === 'card') introMouse();
    else if (state === 'store' ? !!ST.battle : state !== 'play') clickUI();
  }
}, { passive:false });
const touchEnd = e => { e.preventDefault(); touchStartMusic(); for (const t of e.changedTouches){ const k = touchHeld[t.identifier]; if (k){ keys[k] = false; delete touchHeld[t.identifier]; } } };
disp.addEventListener('touchend', touchEnd, { passive:false }); disp.addEventListener('touchcancel', touchEnd, { passive:false });
function drawTouchUI(){
  syncNameBox();
  if (!IS_TOUCH) return;
  const list = tbActive(); dctx.save(); dctx.font = 'bold 18px "Courier New",monospace'; dctx.textAlign = 'center';
  for (const b of list){
    const on = keys[b.k]; dctx.globalAlpha = on ? 0.8 : 0.45; dctx.fillStyle = on ? '#ffe14a' : '#2c3142'; dctx.fillRect(b.x, b.y, b.w, b.h);
    dctx.globalAlpha = 0.9; dctx.strokeStyle = '#efe3cf'; dctx.lineWidth = 2; dctx.strokeRect(b.x+1, b.y+1, b.w-2, b.h-2); dctx.fillStyle = on ? '#1b1f2e' : '#efe3cf'; dctx.fillText(b.t, b.x+b.w/2, b.y+b.h/2+6);
  }
  if ((state === 'play' || state === 'store') && !(state === 'play' && OBJ.phase === 'arrive')){
    dctx.globalAlpha = 0.85; dctx.fillStyle = 'rgba(18,10,16,.85)'; dctx.fillRect(DW/2-250, DH-44, 500, 30); dctx.fillStyle = '#ffe14a'; dctx.font = '14px "Courier New",monospace';
    dctx.fillText('TOUCH BUILD: only the intro and menus work on mobile (tap MENU)', DW/2, DH-24);
  }
  dctx.restore();
}
document.addEventListener('mousemove', e => {
  if (state !== 'play' || !locked()) return;
  const s = 0.0022*settings.sens;
  P.yaw -= e.movementX*s; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - e.movementY*s));
});
document.addEventListener('pointerlockchange', () => { if (!locked() && state === 'play') openPause(); });

/* ============================ audio (tiny synth) ============================ */
let AC = null;
function audio(){ if (!AC){ try { AC = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} } return AC; }
function tone(type, f0, f1, dur, vol){
  const a = audio(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001, t+dur); o.connect(g); g.connect(sfxOut()); o.start(t); o.stop(t+dur);
}
let SFXBUS = null;
function sfxOut(){ const a = audio(); if (!SFXBUS){ SFXBUS = a.createGain(); SFXBUS.connect(a.destination); } SFXBUS.gain.value = settings.sfx/10; return SFXBUS; }
function noise(dur, vol, freq){
  const a = audio(); if (!a) return; const n = Math.floor(a.sampleRate*dur), buf = a.createBuffer(1,n,a.sampleRate), d = buf.getChannelData(0);
  for (let i=0;i<n;i++) d[i] = (Math.random()*2-1)*(1-i/n);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(sfxOut()); s.start();
}
const sfx = {
  swing:()=>noise(0.18,0.28,1800), hit:()=>{ tone('square',170,50,0.12,0.28); noise(0.08,0.3,900); }, hurt:()=>tone('sawtooth',150,45,0.28,0.35),
  parry:()=>{ tone('square',1100,1900,0.14,0.22); noise(0.1,0.2,3000); }, jump:()=>tone('sine',280,520,0.1,0.12), dash:()=>noise(0.22,0.25,700),
  slide:()=>noise(0.35,0.12,500), wave:()=>{ tone('square',220,220,0.1,0.18); setTimeout(()=>tone('square',330,330,0.1,0.18),110); setTimeout(()=>tone('square',440,440,0.18,0.18),220); },
  die:()=>tone('sawtooth',200,30,0.8,0.4),
};

/* ============================ skill tree ============================ */
/* One tree per weapon. Nodes have ranks and a prerequisite [node, rank]; points come from levelling up. */
const TREE = { sword:[
  { id:'slash',      name:'SWORD SLASH', max:5, cost:1, col:0, row:0, req:null,            desc:'+12% sword damage per rank.' },
  { id:'whirlwind',  name:'WHIRLWIND',   max:1, cost:2, col:0, row:1, req:['slash',2],     desc:'Click, then hold attack and release: a 360 degree spin that hits everything around you.' },
  { id:'launcher',   name:'LAUNCHER',    max:1, cost:2, col:0, row:2, req:['slash',3],     desc:'Slash while looking up (or a 3rd combo hit) to launch a recruiter. Air hits deal +50% and keep you both aloft.' },
  { id:'footwork',   name:'FOOTWORK',    max:3, cost:1, col:1, row:0, req:null,            desc:'Dash charges recharge 0.15 s faster per rank.' },
  { id:'dashslash',  name:'DASH SLASH',  max:1, cost:1, col:1, row:1, req:['footwork',1],  desc:'Slash while dashing; the dash carries through for extra damage and reach.' },
  { id:'slidechain', name:'SLIDE CHAIN', max:1, cost:1, col:1, row:2, req:['footwork',2],  desc:'Chain slashes while sliding (locked: one slash per slide).' },
  { id:'wallflip',   name:'WALL FLIP',   max:1, cost:1, col:1, row:3, req:['footwork',3],  desc:'After a wall-jump press FLIP + W/S/A/D for a front/back/side flip and boost.' },
  { id:'vitality',   name:'VITALITY',    max:5, cost:1, col:2, row:0, req:null,            desc:'+15 max HP per rank.' },
  { id:'ironguard',  name:'IRON GUARD',  max:2, cost:1, col:2, row:1, req:['vitality',2],  desc:'Parry window +0.06 s per rank, and blocked hits hurt less.' },
  { id:'secondwind', name:'SECOND WIND', max:1, cost:2, col:2, row:2, req:['ironguard',2], desc:'Once per wave, a lethal hit leaves you at 25 HP instead.' } ] };
const BRANCHES = ['BLADE', 'MOBILITY', 'BODY'];
const prog = { points:0, level:1, xp:0, ranks:{} };
const xpNeed = lv => 60 + lv*30;
const rank = id => prog.ranks[id] || 0;
const hasSkill = id => rank(id) > 0;
const treeNodes = () => TREE[CHAR.weapon] || TREE.sword;
const dmgMul = () => 1 + 0.12*rank('slash');
const dashRecharge = () => 1.1 - 0.15*rank('footwork');
const momentum = () => 1 + Math.min(0.6, Math.max(0, (G.speed-7)/12));   // up to +60% damage at speed
const styleRank = () => Math.min(4, Math.floor(G.style/20));             // D C B A S
function gainXp(n){
  prog.xp += n; let up = 0;
  while (prog.xp >= xpNeed(prog.level)){ prog.xp -= xpNeed(prog.level); prog.level++; prog.points++; up++; }
  if (up){ P.hp = Math.min(P.maxHp, P.hp+25); msg('LEVEL '+prog.level+'!  +1 SKILL POINT  (PAUSE > SKILLS)', 3, '#ffe14a'); sfx.wave(); saveProgress(); }
}
function applyStats(){ const old = P.maxHp; P.maxHp = 100 + 15*rank('vitality'); P.hp = Math.min(P.maxHp, P.hp + Math.max(0, P.maxHp-old)); }
function nodeState(n){
  if (rank(n.id) >= n.max) return 'max';
  if (n.req && rank(n.req[0]) < n.req[1]) return 'locked';
  return prog.points >= n.cost ? 'buy' : 'poor';
}
function buyNode(n){
  if (nodeState(n) !== 'buy'){ tone('square', 120, 90, 0.15, 0.1); return false; }
  prog.points -= n.cost; prog.ranks[n.id] = rank(n.id)+1; applyStats(); saveProgress(); sfx.wave(); return true;
}
function respecTree(){
  let back = 0; for (const n of treeNodes()) back += rank(n.id)*n.cost;
  prog.points += back; prog.ranks = {}; applyStats(); saveProgress(); tone('square', 600, 300, 0.2, 0.12);
}
/* older saves stored unlocked flags + vit/pow stats: map them onto the tree */
function migrateProg(p){
  const ranks = Object.assign({}, p.ranks || {});
  for (const id in (p.unlocked || {})) if (p.unlocked[id]) ranks[id] = Math.max(1, ranks[id] || 0);
  if (p.stats){ if (p.stats.vit) ranks.vitality = Math.max(ranks.vitality||0, Math.min(5, p.stats.vit)); if (p.stats.pow) ranks.slash = Math.max(ranks.slash||0, Math.min(5, p.stats.pow)); }
  return ranks;
}
/* ============================ player ============================ */
const WALK = 6.0, SPRINT = 9.0, CROUCH = 3.2, GRAV = 24, JUMP = 7.8, MAXH = 20;
const P = { x:0,y:0,z:18, vx:0,vz:0,vy:0, yaw:0,pitch:0, h:1.8, eye:1.62, onGround:true, sliding:false, slideT:0, slideSlashes:0,
            hp:100, maxHp:100, iframes:0, dashT:0, dashCd:0, dashCharges:2, airJumps:1, slamming:false, wjCd:0, mantCd:0, coyote:0, jumpBuf:0, wallCount:0, wfWin:0, flip:null, spin:0,
            wall:{ on:false, t:0, side:0 }, mant:null, roll:0, fov:80, bobT:0, landDip:0, blocking:false, blockT:0 };
const G = { kills:0, combo:0, comboT:0, shake:0, hitstop:0, vign:0, msgs:[], time:0, speed:0, fovPunch:0, nums:[], hits:[], boss:null, style:0 };
const tmpV = new THREE.Vector3();                                    // reused for screen projection (no per-frame allocation)
function resetPlayer(){
  Object.assign(P, { x:0,y:0,z:18, vx:0,vz:0,vy:0, yaw:0,pitch:0, h:1.8, eye:1.62, onGround:true, sliding:false, slideSlashes:0, hp:P.maxHp, iframes:1,
                     dashT:0, dashCd:0, dashCharges:2, airJumps:1, slamming:false, wjCd:0, mantCd:0, coyote:0, jumpBuf:0, wallCount:0, wfWin:0, flip:null, spin:0, mant:null, roll:0, landDip:0, blocking:false });
  P.wall.on = false; P.wall.t = 0;
}
function accelerate(wx, wz, wishspeed, accel, dt){
  const cur = P.vx*wx + P.vz*wz, add = wishspeed - cur; if (add <= 0) return;
  const a = Math.min(accel*wishspeed*dt, add); P.vx += a*wx; P.vz += a*wz;
}
function msg(text, sec, color){ G.msgs.push({ text, t:sec||2, max:sec||2, color:color||'#ffe14a' }); if (G.msgs.length > 4) G.msgs.shift(); }

function startMantle(x1, y1, z1){
  P.mant = { t:0, dur:0.34, x0:P.x, y0:P.y, z0:P.z, x1, y1, z1 };
  P.sliding = false; P.vx = P.vy = P.vz = 0; P.mantCd = 0.3;
}
function movePlayerAxis(ax, az){
  P.x += ax; P.z += az;
  const b = collides(P.x, P.y, P.z, P.h); if (!b) return false;
  const top = maxTopOverlap(P.x, P.y, P.z, P.h), stepH = top - P.y;
  if (stepH > 0 && stepH <= 0.56 && !collides(P.x, top+0.002, P.z, P.h)){ P.y = top+0.002; return false; }
  if (stepH > 0.56 && stepH <= 2.2 && held('forward') && !P.mant && P.mantCd <= 0 && (!P.onGround || held('jump'))){
    const d = Math.hypot(ax,az) || 1, ox = P.x-ax, oz = P.z-az, tx = ox + ax/d*0.75, tz = oz + az/d*0.75;
    if (!collides(tx, top+0.002, tz, 1.8) && supportY(tx, top+0.05, tz) >= top-0.01){ P.x = ox; P.z = oz; startMantle(tx, top+0.002, tz); return 'mantle'; }
  }
  P.x -= ax; P.z -= az; return true;
}
function probeWalls(){
  let best = null, bestScore = 9;
  const hs = Math.hypot(P.vx,P.vz), vx = hs>0.1 ? P.vx/hs : -Math.sin(P.yaw), vz = hs>0.1 ? P.vz/hs : -Math.cos(P.yaw);
  for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const b = wallProbe(P.x, P.y, P.z, P.h, dx, dz); if (!b) continue;
    const score = Math.abs(vx*dx + vz*dz);            // smallest = wall alongside travel direction
    if (score < bestScore){ bestScore = score; best = { b, nx:-dx, nz:-dz }; }
  }
  return best;
}
/* skill: wall flip. Direction comes from the movement keys: W front, S back, A left, D right. */
function startFlip(f, s, fwdX, fwdZ, cy, sy){
  const dir = f > 0 ? 'front' : f < 0 ? 'back' : s > 0 ? 'right' : s < 0 ? 'left' : 'back';
  const v = dir === 'front' ? [fwdX,fwdZ] : dir === 'back' ? [-fwdX,-fwdZ] : dir === 'right' ? [cy,-sy] : [-cy,sy];
  P.vx += v[0]*5.5; P.vz += v[1]*5.5; P.vy = Math.min(10, Math.max(P.vy,0) + 3.5);
  const hs = Math.hypot(P.vx,P.vz); if (hs > MAXH){ P.vx *= MAXH/hs; P.vz *= MAXH/hs; }
  P.flip = { t:0, dur:0.6, dir }; P.wfWin = 0; P.iframes = Math.max(P.iframes, 0.35); G.fovPunch = 1; sfx.dash();
  G.style += 6; G.combo++; G.comboT = 3.2; msg(dir.toUpperCase()+' FLIP!', 1, '#8fb4d0');
}

function updatePlayer(dt){
  const f = (held('forward')?1:0) - (held('back')?1:0), s = (held('right')?1:0) - (held('left')?1:0);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  let wx = -sy*f + cy*s, wz = -cy*f - sy*s; const wl = Math.hypot(wx,wz); if (wl > 0){ wx /= wl; wz /= wl; }
  const hasWish = wl > 0.01, fwdX = -sy, fwdZ = -cy;
  P.iframes = Math.max(0, P.iframes-dt); if (P.dashCharges < 2){ P.dashCd -= dt; if (P.dashCd <= 0){ P.dashCharges++; P.dashCd = P.dashCharges < 2 ? dashRecharge() : 0; } } P.wjCd = Math.max(0, P.wjCd-dt);
  P.mantCd = Math.max(0, P.mantCd-dt); P.landDip = Math.max(0, P.landDip-dt*0.6); P.wfWin = Math.max(0, P.wfWin-dt);
  P.coyote = P.onGround ? 0.12 : Math.max(0, P.coyote-dt);
  P.jumpBuf = held('jump') ? 0.14 : Math.max(0, P.jumpBuf-dt);
  if (P.flip){ P.flip.t += dt; if (P.flip.t >= P.flip.dur) P.flip = null; }

  /* ---- mantle: scripted climb over a ledge ---- */
  if (P.mant){
    const m = P.mant; m.t += dt; const k = Math.min(1, m.t/m.dur);
    const up = 1-Math.pow(1-Math.min(1,k*1.5),2), fw = Math.max(0,(k-0.35)/0.65);
    P.y = m.y0 + (m.y1-m.y0)*up; P.x = m.x0 + (m.x1-m.x0)*fw; P.z = m.z0 + (m.z1-m.z0)*fw;
    if (k >= 1){ const d = Math.hypot(m.x1-m.x0, m.z1-m.z0) || 1; P.vx = (m.x1-m.x0)/d*3.5; P.vz = (m.z1-m.z0)/d*3.5; P.vy = 0; P.onGround = true; P.mant = null; }
    return;
  }

  /* ---- crouch / slide ---- */
  const crouchHeld = held('slide'), hs0 = Math.hypot(P.vx,P.vz);
  if (tapped('slide') && P.onGround && !P.sliding && hs0 > 5){
    P.sliding = true; P.slideT = 0; P.slideSlashes = 0; const sp = Math.min(Math.max(hs0+3, 9.5), 14.5);
    P.vx = P.vx/hs0*sp; P.vz = P.vz/hs0*sp; sfx.slide();
  }
  if (P.sliding && (!crouchHeld || (!P.onGround && P.coyote <= 0))) P.sliding = false;
  let targetH = (crouchHeld || P.sliding) ? 1.0 : 1.8;
  if (targetH > P.h && collides(P.x, P.y, P.z, targetH)) targetH = P.h;                 // stay low under ceilings
  P.h = targetH;
  P.eye += ((P.h < 1.5 ? 0.85 : 1.62) - P.eye) * Math.min(1, dt*14);

  /* ---- dash (GunZ-style burst, brief i-frames) ---- */
  if (tapped('dash') && P.dashCharges > 0){
    if (atk.state === 'swing' && !hasSkill('dashslash')){ atk.state = 'idle'; swingTrail.length = 0; }   // dashing cancels a swing unless Dash Slash is owned
    const dx = hasWish ? wx : fwdX, dz = hasWish ? wz : fwdZ;
    P.vx = dx*18; P.vz = dz*18; P.dashT = 0.17; P.dashCharges--; if (P.dashCd <= 0) P.dashCd = dashRecharge(); P.slamming = false; P.iframes = Math.max(P.iframes, 0.2); P.sliding = false; sfx.dash(); G.fovPunch = 1;
  }
  P.dashT = Math.max(0, P.dashT-dt);
  P.blocking = held('block') && atk.state === 'idle' && !P.sliding && P.dashT <= 0;
  P.blockT = P.blocking ? P.blockT+dt : 0;

  /* ---- jump (ground / coyote) ---- */
  const wantJump = P.jumpBuf > 0; let jumpedNow = false;
  if (wantJump && (P.onGround || P.coyote > 0)){
    P.vy = JUMP; P.onGround = false; P.coyote = 0; P.jumpBuf = 0; jumpedNow = true;
    if (P.sliding){ P.sliding = false; const hs = Math.hypot(P.vx,P.vz); if (hs > 0.1){ const k = Math.min(1.05, 17/hs); P.vx *= k; P.vz *= k; } }
    sfx.jump();
  } else if (P.onGround){
    /* ---- ground movement ---- */
    const hs = Math.hypot(P.vx,P.vz);
    if (P.sliding){
      P.slideT += dt; let sp = hs*(1-0.55*dt) - 1.0*dt;
      if (sp < 3.4 && P.slideT > 0.15){ P.sliding = false; }
      if (hs > 0.1){
        let dx = P.vx/hs, dz = P.vz/hs;
        if (hasWish){ dx += (wx-dx)*Math.min(1,1.0*dt); dz += (wz-dz)*Math.min(1,1.0*dt); const l = Math.hypot(dx,dz)||1; dx/=l; dz/=l; }
        sp = Math.max(0, sp); P.vx = dx*sp; P.vz = dz*sp;
      }
    } else if (P.dashT <= 0){
      if (hs > 0){ const drop = Math.max(hs,1.5)*6*dt, ns = Math.max(0, hs-drop); P.vx *= ns/hs; P.vz *= ns/hs; }
      let ws = P.h < 1.5 ? CROUCH : (held('sprint') && f > 0 ? SPRINT : WALK);
      if (P.blocking) ws *= 0.55;
      if (hasWish) accelerate(wx, wz, ws, 11, dt);
    }
  }
  if (!P.onGround){
    /* ---- air: gravity, Quake-style strafe accel, light steering ---- */
    const wall = probeWalls(), hs = Math.hypot(P.vx,P.vz);
    let gScale = P.dashT > 0 ? 0.15 : 1;
    P.wall.on = false;
    if (wall && P.mantCd <= 0){
      const tx = -wall.nz, tz = wall.nx, sign = (fwdX*tx + fwdZ*tz) >= 0 ? 1 : -1;
      if (wantJump && P.wjCd <= 0 && P.wallCount < 5){                       // wall-jump
        const sp = Math.max(hs*0.8, 6.5);
        P.vx = fwdX*sp*0.8 + wall.nx*5.8; P.vz = fwdZ*sp*0.8 + wall.nz*5.8; P.vy = 8.4;
        P.wallCount++; P.airJumps = 1; jumpedNow = true; P.wjCd = 0.22; P.jumpBuf = 0; P.wall.t = Math.max(0, P.wall.t-0.5); P.wfWin = 1.0; sfx.jump(); G.fovPunch = 0.5;
      } else if (held('forward') && hs > 5.5 && P.wall.t < 1.5 && P.vy > -7 && Math.abs(fwdX*wall.nx + fwdZ*wall.nz) < 0.8){   // wall-run
        P.wall.on = true; P.wall.t += dt; gScale = 0.1; P.wfWin = Math.max(P.wfWin, 0.3);
        const sp = Math.max(hs*0.985, 7.0); P.vx = tx*sign*sp; P.vz = tz*sign*sp; if (P.vy < -1.8) P.vy = -1.8;
        P.wall.side = (wall.nx*cy*-1 + wall.nz*sy) > 0 ? 1 : -1;
      } else if (P.vy < -3 && Math.abs(fwdX*wall.nx + fwdZ*wall.nz) > 0.5){ P.vy = Math.max(P.vy, -3.5); }          // wall slide
    }
    if (tapped('flip') && hasSkill('wallflip') && !P.flip && P.wfWin > 0){ startFlip(f, s, fwdX, fwdZ, cy, sy); P.wall.on = false; P.wall.t = 9; }
    if (!jumpedNow && tapped('jump') && P.airJumps > 0 && P.coyote <= 0 && !P.slamming){       // double jump, redirected toward your input
      P.airJumps--; P.vy = JUMP*0.95; jumpedNow = true;
      if (hasWish){ const h = Math.hypot(P.vx,P.vz); P.vx = P.vx*0.5 + wx*h*0.5; P.vz = P.vz*0.5 + wz*h*0.5; }
      burst(P.x, P.y+0.1, P.z, 8, 0xe8e6e0, 3); sfx.jump(); G.style += 3;
    }
    if (tapped('slide') && !P.slamming && P.y - supportY(P.x,P.y,P.z) > 1.2){ P.slamming = true; P.vy = -32; P.vx *= 0.3; P.vz *= 0.3; sfx.dash(); }   // ground slam
    P.vy -= GRAV*gScale*dt; if (P.vy < -40) P.vy = -40;
    if (hasWish && P.dashT <= 0){
      accelerate(wx, wz, Math.min(SPRINT, 1.0), 10, dt);
      if (hs > 0.5){                                                          // gentle air steering keeps momentum
        const a0 = Math.atan2(P.vx,P.vz), a1 = Math.atan2(wx,wz); let da = a1-a0; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
        const turn = Math.sign(da)*Math.min(Math.abs(da), 1.3*dt), na = a0+turn; P.vx = Math.sin(na)*hs; P.vz = Math.cos(na)*hs;
      }
    }
    const hs2 = Math.hypot(P.vx,P.vz); if (hs2 > MAXH){ P.vx *= MAXH/hs2; P.vz *= MAXH/hs2; }
  } else { P.wall.on = false; }

  /* ---- integrate with collision ---- */
  const prevOnGround = P.onGround, preVy = P.vy;
  let r = movePlayerAxis(P.vx*dt, 0); if (r === true) P.vx = 0;
  if (!P.mant){ r = movePlayerAxis(0, P.vz*dt); if (r === true) P.vz = 0; }
  if (P.mant) return;
  const prevY = P.y; P.y += P.vy*dt;
  if (P.vy <= 0){
    const gy = supportY(P.x, prevY, P.z);
    if (P.y <= gy){ P.y = gy; P.vy = 0; P.onGround = true; }
    else P.onGround = (P.y - gy) < 0.05 && P.vy > -0.01 ? true : false;
  } else {
    P.onGround = false;
    const b = collides(P.x, P.y, P.z, P.h); if (b){ P.y = b.miny - P.h - 0.002; P.vy = 0; }
  }
  if (P.onGround && prevOnGround === false){                                  // landed
    P.wallCount = 0; P.wall.t = 0; P.flip = null; P.wfWin = 0; P.airJumps = 1;
    if (P.slamming){ P.slamming = false; groundSlam(); }
    if (preVy < -9){ P.landDip = 0.25; G.shake = Math.max(G.shake, 0.12); }
  }
  if (P.onGround){ const gy = supportY(P.x, P.y, P.z); if (P.y - gy > 0.06) P.onGround = false; }
  if (P.y < -5) { P.y = 0; P.hp = 0; }
  resolveBodies();
  G.speed = Math.hypot(P.vx,P.vz);
}
/* enemies are solid: the player can't walk or slide through them (and shoves them a little) */
/* slam landing: shockwave; hold jump to bounce high, hold slide to shoot off into a slide */
function groundSlam(){
  G.shake = Math.max(G.shake, 0.45); G.hitstop = 0.05; burst(P.x, 0.2, P.z, 20, 0xe8e6e0, 7); noise(0.25,0.4,200);
  for (const e of enemies){
    if (e.state === 'dying' || e.state === 'spawn') continue;
    const dx = e.x-P.x, dz = e.z-P.z, d = Math.hypot(dx,dz) || 1;
    if (d < 4.05 + e.rad && Math.abs(e.y-P.y) < 2) damageEnemy(e, 2, dx/d, dz/d, 9);
  }
  if (held('jump')){ P.vy = 12; P.onGround = false; msg('SLAM BOUNCE!', 0.8, '#8fb4d0'); G.style += 6; }
  else if (held('slide')){ P.vx = -Math.sin(P.yaw)*13; P.vz = -Math.cos(P.yaw)*13; P.sliding = true; P.slideT = 0; P.slideSlashes = 0; }
}
function resolveBodies(){
  for (const e of enemies){
    if (e.state === 'dying' || e.state === 'spawn') continue;
    if (P.y > e.y+e.h-0.3 || P.y+P.h < e.y) continue;
    const dx = P.x-e.x, dz = P.z-e.z, d = Math.hypot(dx,dz), min = HW+e.rad+0.03;
    if (d >= min || d < 0.0001) continue;
    const nx = dx/d, nz = dz/d, pen = min-d, px_ = P.x+nx*pen*0.65, pz_ = P.z+nz*pen*0.65;
    if (!collides(px_, P.y, pz_, P.h)){ P.x = px_; P.z = pz_; }
    if (e.kind !== 'boss') moveEnemy(e, -nx*pen*0.35, -nz*pen*0.35);
    const vn = P.vx*nx + P.vz*nz; if (vn < 0){ P.vx -= vn*nx*0.85; P.vz -= vn*nz*0.85; }
  }
}

function updateCamera(dt, real){
  const hs = Math.hypot(P.vx,P.vz);
  if (P.onGround && hs > 1 && !P.sliding) P.bobT += hs*dt*1.15;
  const bob = P.onGround && !P.sliding ? Math.sin(P.bobT*2)*0.025*Math.min(1,hs/9) : 0;
  const rollTarget = (P.wall.on ? P.wall.side*0.10 : 0) + (-(((held('right')?1:0)-(held('left')?1:0)))*0.015*Math.min(1,hs/8));
  P.roll += (rollTarget - P.roll) * Math.min(1, real*10);
  const fovT = settings.fov + Math.min(hs,16)*0.8 + (G.fovPunch||0)*3;
  P.fov += (fovT - P.fov) * Math.min(1, real*8); G.fovPunch = Math.max(0, (G.fovPunch||0) - real*4);
  if (Math.abs(camera.fov - P.fov) > 0.05){ camera.fov = P.fov; camera.updateProjectionMatrix(); }
  G.shake = Math.max(0, G.shake - real*1.4);
  const sh = G.shake*0.12, ox = (Math.random()-0.5)*sh, oy = (Math.random()-0.5)*sh;
  camera.position.set(P.x+ox, P.y + P.eye + bob - P.landDip + oy, P.z);
  camera.rotation.set(P.pitch, P.yaw+P.spin, P.roll);
  camPull = 0; panCam(real);                                                  // flips, ground slam, whirlwind: the camera pans out to show you doing it
}
/* pan-out camera for the big moves: wall flip (you tumble), ground slam (you dive head-first), whirlwind (you spin). The camera eases out of your head
   to a spot beside (profile) or behind you, looks at you, then eases back. You are drawn as a billboard (screen-plane rotation for flips and the dive,
   a squash-flip for the whirl). It tries other angles in tight spots and stays first person when there is no room. */
let camPull = 0; const FLIP = { sprite:null, tex:{}, texKey:'', rig:new THREE.PerspectiveCamera(), s:0, hold:0, rot:0 };
function flipTex(back){
  const key = JSON.stringify(CHAR); if (FLIP.texKey !== key){ for (const t in FLIP.tex) FLIP.tex[t].dispose(); FLIP.tex = {}; FLIP.texKey = key; }
  return FLIP.tex[back ? 'b' : 'f'] || (FLIP.tex[back ? 'b' : 'f'] = makeTex(personCanvas(CHAR, 'stand', back), false));
}
function panCam(real){
  if (P.slamming) FLIP.hold = 0.4; else FLIP.hold = Math.max(0, FLIP.hold - real);
  const slamT = (P.slamming || FLIP.hold > 0) ? 1 : 0;
  FLIP.s += (slamT - FLIP.s)*Math.min(1, real*(slamT ? 14 : 7)); FLIP.rot += ((P.slamming ? Math.PI : 0) - FLIP.rot)*Math.min(1, real*14);
  const env = k => { const r = Math.min(1, k/0.2, (1-k)/0.2); return r*r*(3-2*r); };
  let mode, pull0, side, mv = null, rotA = 0, turn = 0, somer = false;
  if (P.flip){ const f = P.flip, k = Math.min(1, f.t/f.dur), e = k < 0.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2; mode = 'flip'; pull0 = env(k); side = false; somer = f.dir === 'front' || f.dir === 'back'; rotA = Math.PI*2*e; mv = f.dir; }
  else if (atk.state === 'whirl'){ const k = Math.min(1, atk.t/0.5); mode = 'whirl'; pull0 = env(k); side = false; turn = Math.PI*2*(1-Math.pow(1-k,2)); }
  else if (FLIP.s > 0.02){ mode = 'slam'; pull0 = FLIP.s; side = true; rotA = FLIP.rot; mv = 'front'; }
  else return;
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), B = [sy, cy], R = [cy, -sy], H = Math.SQRT1_2;       // behind / player's right
  const tx = P.x, ty = P.y + 0.9, tz = P.z;
  const cands = side ? [R, [-R[0],-R[1]], [(B[0]+R[0])*H,(B[1]+R[1])*H], [(B[0]-R[0])*H,(B[1]-R[1])*H], B]       // profile view first
                     : [B, [(B[0]+R[0])*H,(B[1]+R[1])*H], [(B[0]-R[0])*H,(B[1]-R[1])*H], R, [-R[0],-R[1]]];    // behind view first
  let best = cands[0], D = -1;                                                                         // the first direction with room (>= 2.5), else the roomiest
  for (const c of cands){ let m = 0; for (let s = 0.5; s <= 4.5; s += 0.5){ if (collides(tx+c[0]*s, ty+0.35, tz+c[1]*s, 0.5)) break; m = s; } if (m > D){ D = m; best = c; } if (m >= 2.5) break; }
  const pull = pull0 * Math.max(0, Math.min(1, (D-1.4)/1.1));                                          // tight spot (< 1.5 m of room) -> stay in first person
  if (mode === 'whirl' && pull > 0.02) camera.rotation.set(P.pitch, P.yaw, P.roll);                    // the camera itself no longer spins
  FLIP.rig.position.set(tx+best[0]*D, ty+0.6, tz+best[1]*D); FLIP.rig.lookAt(tx, ty, tz);
  camera.position.lerp(FLIP.rig.position, pull); camera.quaternion.slerp(FLIP.rig.quaternion, pull); camPull = pull;
  if (!FLIP.sprite){ FLIP.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:null, transparent:true, alphaTest:0.4 })); fx.add(FLIP.sprite); }
  const Hh = 1.8*78/64, W = Hh*42/78, fromBehind = (best[0]*B[0] + best[1]*B[1]) > 0.5, sp = FLIP.sprite;
  let back = fromBehind, sx = 1;
  let sy2 = 1, rotFix = 0, lift = 0;
  if (mode === 'whirl'){ const c = Math.cos(turn); back = c > 0; sx = Math.max(0.12, Math.abs(c)); }       // spinning on the spot: front, edge-on, back...
  else if (somer){                                                                                      // front/back somersault seen from behind: the body tips end over end,
    const c = Math.cos(rotA); back = c > 0; sy2 = Math.max(0.2, Math.abs(c)); rotFix = c > 0 ? 0 : Math.PI;   // so it foreshortens, shows the other side upside-down, and comes round again
    sx = 0.9 + 0.1*Math.abs(c); lift = Math.sin(rotA)*0.45*(mv === 'front' ? 1 : -1);
  }
  sp.material.map = flipTex(back); sp.scale.set(W*sx, Hh*sy2, 1); sp.position.set(tx, ty + lift, tz); sp.material.needsUpdate = true;
  let cw = true;
  if (mv){ const F = mv === 'front' ? [-sy,-cy] : mv === 'back' ? [sy,cy] : mv === 'right' ? R : [-R[0],-R[1]], L = Math.hypot(best[0], best[1]) || 1;
    cw = (F[0]*best[1]/L - F[1]*best[0]/L) >= 0; }                                                     // does your travel direction appear screen-right?
  sp.material.rotation = mode === 'slam' ? rotA : somer ? rotFix : (cw ? -rotA : rotA);
  sp.material.opacity = Math.max(0, Math.min(1, (pull-0.3)/0.4));                                      // fades in once the camera has moved away from your head
}

/* ============================ combat ============================ */
const atk = { state:'idle', t:0, idx:0, combo:0, windowT:0, hit:false, buffer:0, slide:false, dash:false, cd:0, hold:0, charging:false, wwCd:0 };
const SWING = [ { dur:0.30, hitAt:0.38, dmg:1, range:3.4, knock:7,  lunge:5.5 },
                { dur:0.30, hitAt:0.38, dmg:1, range:3.4, knock:7,  lunge:5.5 },
                { dur:0.44, hitAt:0.45, dmg:2, range:4.0, knock:12, lunge:7.5 } ];
const swingTrail = [];
function lookVec(){ const cp = Math.cos(P.pitch); return [-Math.sin(P.yaw)*cp, Math.sin(P.pitch), -Math.cos(P.yaw)*cp]; }
function updateCombat(dt){
  atk.cd = Math.max(0, atk.cd-dt); atk.wwCd = Math.max(0, atk.wwCd-dt);
  if (tapped('attack')) atk.buffer = 0.25; else atk.buffer = Math.max(0, atk.buffer-dt);
  /* locked skills: drop the click instead of letting it fire late (that felt like a free dash/slide slash) */
  if (atk.buffer > 0 && P.dashT > 0 && !hasSkill('dashslash')){ if (tapped('attack')) msg('DASH SLASH IS LOCKED  (PAUSE > SKILLS)', 1, '#a3aab8'); atk.buffer = 0; }
  if (atk.buffer > 0 && P.sliding && P.slideSlashes >= 1 && !hasSkill('slidechain')){ if (tapped('attack')) msg('SLIDE CHAIN IS LOCKED  (PAUSE > SKILLS)', 1, '#a3aab8'); atk.buffer = 0; }
  /* skill: whirlwind - click, then hold and release */
  if (held('attack')){ atk.hold += dt; atk.charging = hasSkill('whirlwind') && atk.hold > 0.45 && atk.wwCd <= 0 && atk.state !== 'whirl'; }
  else { if (atk.charging && atk.state !== 'whirl') startWhirl(); atk.hold = 0; atk.charging = false; }
  if (atk.state === 'whirl'){
    atk.t += dt; const k = Math.min(1, atk.t/0.5); P.spin = Math.PI*2*(1-Math.pow(1-k,2));
    if (!atk.hit && atk.t >= 0.2){ atk.hit = true; doWhirl(); }
    if (atk.t >= 0.5){ atk.state = 'idle'; P.spin = 0; atk.cd = 0.2; }
    return;
  }
  if (atk.state === 'idle'){
    if (atk.windowT > 0){ atk.windowT -= dt; if (atk.windowT <= 0) atk.combo = 0; }
    const slideOk = !P.sliding || hasSkill('slidechain') || P.slideSlashes < 1, dashOk = P.dashT <= 0 || hasSkill('dashslash');
    if (atk.buffer > 0 && atk.cd <= 0 && !P.mant && !atk.charging && slideOk && dashOk){
      atk.idx = atk.windowT > 0 ? atk.combo : 0; atk.state = 'swing'; atk.t = 0; atk.hit = false; atk.buffer = 0; atk.slide = P.sliding; atk.dash = P.dashT > 0;
      if (P.sliding) P.slideSlashes++;
      const s = SWING[atk.idx], k = atk.slide ? 0.4 : 1, hs = Math.hypot(P.vx,P.vz);
      if (atk.dash){ P.dashT = Math.max(P.dashT, 0.3); }
      else { P.vx += -Math.sin(P.yaw)*s.lunge*k; P.vz += -Math.cos(P.yaw)*s.lunge*k; }
      const h2 = Math.hypot(P.vx,P.vz), cap = Math.max(hs, 15); if (h2 > cap){ P.vx *= cap/h2; P.vz *= cap/h2; }
      swingTrail.length = 0; sfx.swing();
    }
  } else {
    atk.t += dt; const s = SWING[atk.idx];
    if (!atk.hit && atk.t >= s.dur*s.hitAt){ atk.hit = true; doSlash(s); }
    if (atk.t >= s.dur){ atk.state = 'idle'; atk.combo = atk.idx+1; atk.windowT = 0.45; if (atk.combo > 2){ atk.combo = 0; atk.windowT = 0; atk.cd = 0.22; } }
  }
}
function startWhirl(){
  atk.state = 'whirl'; atk.t = 0; atk.hit = false; atk.wwCd = 2.0; atk.charging = false; atk.hold = 0; P.iframes = Math.max(P.iframes, 0.5);
  sfx.swing(); setTimeout(sfx.swing, 120); G.fovPunch = 1; msg('WHIRLWIND!', 1, '#ffe14a');
}
function doWhirl(){
  let hits = 0;
  for (const e of enemies){
    if (e.state === 'dying' || e.state === 'spawn') continue;
    const dx = e.x-P.x, dz = e.z-P.z, d = Math.hypot(dx,dz) || 1;
    if (d < 4.15+e.rad && Math.abs(e.y-P.y) < 2.6){ damageEnemy(e, 2, dx/d, dz/d, 11); hits++; }
  }
  for (const p of projectiles) if (!p.fromPlayer && Math.hypot(p.x-P.x,p.z-P.z) < 5){ const dx = p.x-P.x, dz = p.z-P.z, d = Math.hypot(dx,dz)||1; p.fromPlayer = true; p.vx = dx/d*20; p.vz = dz/d*20; p.vy = 0; p.life = 3; hits++; }
  if (hits){ G.hitstop = 0.1; G.shake = Math.max(G.shake, 0.6); sfx.hit(); }
}
function doSlash(s){
  const L = lookVec(), ex = P.x, ey = P.y+P.eye, ez = P.z;
  const dmg = s.dmg + (atk.slide ? 1 : 0) + (atk.dash ? 1 : 0), range = s.range + (atk.slide ? 0.5 : 0) + (atk.dash ? 0.9 : 0);
  let hits = 0;
  for (const e of enemies){
    if (e.state === 'dying' || e.state === 'spawn') continue;
    const vx = e.x-ex, vy = (e.y+1.0)-ey, vz = e.z-ez, d = Math.hypot(vx,vy,vz) || 1;
    if (d > range+0.4+e.rad-0.45) continue;
    const c = (vx*L[0]+vy*L[1]+vz*L[2])/d; if (c < (d < 1.3 ? -0.1 : 0.42)) continue;
    const hd = Math.hypot(vx,vz) || 1, wasAir = e.air; damageEnemy(e, dmg, vx/hd, vz/hd, s.knock); hits++;
    if (hasSkill('launcher') && e.kind !== 'boss' && e.state !== 'dying'){
      if (wasAir){ e.vy = Math.max(e.vy, 4.5); if (!P.onGround) P.vy = Math.max(P.vy, 2.5); }          // juggle: both of you hang in the air
      else if (P.pitch > 0.3 || atk.idx === 2){ e.air = true; e.vy = 10.5; G.style += 4; }           // launch
    }
  }
  for (const p of projectiles){
    if (p.fromPlayer) continue;
    const vx = p.x-ex, vy = p.y-ey, vz = p.z-ez, d = Math.hypot(vx,vy,vz) || 1;
    if (d < range+0.8 && (vx*L[0]+vy*L[1]+vz*L[2])/d > 0.3){ p.fromPlayer = true; p.vx = L[0]*20; p.vy = L[1]*20; p.vz = L[2]*20; p.life = 3; burst(p.x,p.y,p.z,6,0xffffff,4); sfx.parry(); hits++; msg('DEFLECT!',0.8,'#8fb4d0'); }
  }
  if (hits){ G.hitstop = atk.idx === 2 ? 0.09 : 0.055; G.shake = Math.max(G.shake, atk.idx === 2 ? 0.55 : 0.28); G.fovPunch = 0.6; sfx.hit(); }
}
function hurtPlayer(dmg, sx, sz, enemy){
  if (P.iframes > 0 || state !== 'play' || DBG.god) return false;
  if (P.blocking){
    if (P.blockT <= 0.22 + 0.06*rank('ironguard')){
      if (enemy){ enemy.state = 'stagger'; enemy.stagger = 1.0; enemy.t = 0; const dx = enemy.x-P.x, dz = enemy.z-P.z, d = Math.hypot(dx,dz)||1; enemy.vx = dx/d*8; enemy.vz = dz/d*8; enemy.flash = 0.1; }
      G.hitstop = 0.09; G.shake = Math.max(G.shake, 0.3); sfx.parry(); burst(P.x-Math.sin(P.yaw)*1.2,P.y+1.4,P.z-Math.cos(P.yaw)*1.2,12,0xffe14a,6);
      msg('PARRY!',1,'#ffe14a'); G.style = Math.min(100, G.style+15); P.hp = Math.min(P.maxHp, P.hp+4); return false;
    }
    dmg *= 0.2 - 0.05*rank('ironguard'); sfx.parry();
  }
  G.style = Math.max(0, G.style-30);
  G.hits.push({ ang:Math.atan2(sx-P.x, sz-P.z), t:0.9 }); if (G.hits.length > 6) G.hits.shift();
  P.hp -= dmg; P.iframes = 0.5; G.vign = 1; G.shake = Math.max(G.shake, 0.45); sfx.hurt(); G.combo = 0;
  const dx = P.x-sx, dz = P.z-sz, d = Math.hypot(dx,dz)||1; P.vx += dx/d*5; P.vz += dz/d*5;
  if (P.hp <= 0 && hasSkill('secondwind') && !P.swUsed){ P.hp = 25; P.swUsed = true; P.iframes = 1.5; msg('SECOND WIND!', 1.6, '#3cff8a'); sfx.parry(); }
  if (P.hp <= 0){ P.hp = 0; state = 'dead'; deadT = 0; menuIdx = 0; hiredStart(); sfx.die(); if (document.exitPointerLock) document.exitPointerLock(); }
  return true;
}
let deadT = 0;

/* ============================ enemies / projectiles / particles ============================ */
const enemies = [], projectiles = [];
const ENEMY = { grunt:{ hp:6, speed:3.7, xp:12 }, runner:{ hp:4, speed:6.2, xp:16 }, thrower:{ hp:4, speed:3.0, xp:18 }, boss:{ hp:70, speed:2.4, xp:150 } };   // recruiter / headhunter / HR manager
const RECRUIT_LINES = ['We have competitive salary!', "We're like a family!", 'Join us!', 'Unlimited PTO!*', 'Great growth potential!', 'Free pizza Fridays!', 'Are you a team player?',
  "We're hiring... YOU!", "Let's circle back!", 'Passion required!', 'Real equity! Real!', 'Just 5 minutes of your time!', 'Sign here! Here! Here!', 'Synergy awaits!'];
const BOSS_LINES = ['Accept the offer letter!', 'No negotiations!', 'Sign it. SIGN IT.', 'Once-in-a-lifetime opportunity!', 'Your references checked out!',
  'We need you to start yesterday!', 'Benefits? YOU are the benefit!', 'Non-compete: forever!', 'Welcome to the family. Forever.', 'Probation period: eternity!',
  'Overtime is a privilege!', 'Counter-offer DENIED!', 'The position is YOURS!', 'We pay in exposure!'];
const bubbleCache = {};
function bubbleTex(text){
  if (bubbleCache[text]) return bubbleCache[text];
  const m = mkCanvas(2,2).getContext('2d'); m.font = 'bold 11px "Courier New",monospace';
  const w = Math.ceil(m.measureText(text).width)+12, h = 20, cv = mkCanvas(w,h+6), g = cv.getContext('2d');
  g.fillStyle = NAVY; g.fillRect(0,0,w,h); g.fillStyle = '#f4f1ea'; g.fillRect(1,1,w-2,h-2);
  g.fillStyle = NAVY; g.fillRect(w/2-3,h,7,2); g.fillRect(w/2-2,h+2,5,2); g.fillRect(w/2-1,h+4,3,2);
  g.fillStyle = '#f4f1ea'; g.fillRect(w/2-2,h-1,5,2); g.fillRect(w/2-1,h+1,3,2);
  g.font = 'bold 11px "Courier New",monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = NAVY; g.fillText(text, w/2, h/2+1);
  const t = makeTex(cv,false); t.userData = { w:cv.width, h:cv.height }; return bubbleCache[text] = t;
}
function showBubble(e, text, t){
  dropBubble(e); const tex = bubbleTex(text), k = e.kind === 'boss' ? 0.06 : 0.04;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true })); sprite.scale.set(tex.userData.w*k, tex.userData.h*k, 1);
  fx.add(sprite); e.bubble = { sprite, t };
}
function dropBubble(e){ if (e.bubble){ fx.remove(e.bubble.sprite); e.bubble.sprite.material.dispose(); e.bubble = null; } }
function updateBubble(e, dt){
  if (e.state === 'dying' || e.state === 'spawn'){ dropBubble(e); return; }
  if (e.bubble){ e.bubble.t -= dt; if (e.bubble.t <= 0){ dropBubble(e); e.sayT = e.kind === 'boss' ? 1.5 + Math.random()*2 : 3.5 + Math.random()*4; } return; }
  e.sayT -= dt;
  if (e.sayT <= 0){ const L = e.kind === 'boss' ? BOSS_LINES : RECRUIT_LINES; showBubble(e, L[Math.floor(Math.random()*L.length)], 2.6); }
}
const shadowGeo = new THREE.CircleGeometry(0.6, 12);
function spawnEnemy(kind, at){
  const boss = kind === 'boss', rad = boss ? 1.0 : 0.45;
  let x = 0, z = 0, ok = false;
  if (at && !circleBlocked(at.x, at.z, rad)){ x = at.x; z = at.z; ok = true; }
  for (let i=0;i<30 && !ok;i++){ x = (Math.random()*2-1)*(boss ? 22 : 27); z = (Math.random()*2-1)*(boss ? 22 : 27); ok = Math.hypot(x-P.x, z-P.z) > 14 && !circleBlocked(x,z,rad+0.25); }
  if (!ok) return null;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: enemyTex(kind,'walk',0), transparent:true, alphaTest:0.4 }));
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.35, depthWrite:false }));
  shadow.rotation.x = -Math.PI/2; fx.add(sprite); fx.add(shadow);
  enemies.push({ kind, x, y:0, z, vx:0, vz:0, hp:ENEMY[kind].hp, state:'spawn', t:0, flash:0, stagger:0, anim:Math.random()*3, atkCd:1+Math.random(), sprite, shadow, hitDone:false, fade:1, sayT:1.5+Math.random()*4, bubble:null,
                rad, h: boss ? 5.2 : 2.5, w: boss ? 4.0 : 1.29 });   // the boss is about twice a recruiter's height
  if (boss) shadow.scale.set(2.2,2.2,2.2);
  burst(x,0.3,z,10,0x7d1a2e,3);
  return enemies[enemies.length-1];
}
function removeEnemy(e){ dropBubble(e); if (e === G.boss){ G.boss = null; slamRing.visible = false; grabLine.visible = false; } fx.remove(e.sprite); fx.remove(e.shadow); e.sprite.material.dispose(); e.shadow.material.dispose(); enemies.splice(enemies.indexOf(e),1); }
function moveEnemy(e, dx, dz){
  const mh = e.kind === 'boss' ? 1.6 : 0.6;
  if (!circleBlocked(e.x+dx, e.z, e.rad, mh)) e.x += dx;
  if (!circleBlocked(e.x, e.z+dz, e.rad, mh)) e.z += dz;
}
function damageEnemy(e, dmg, dx, dz, knock){
  dmg *= dmgMul()*momentum()*(e.air ? 1.5 : 1); e.hp -= dmg; e.flash = 0.09; burst(e.x, e.y+1.2, e.z, 8, 0x8fa66a, 5);   // alien ichor
  G.nums.push({ x:e.x, y:e.y+e.h*0.85, z:e.z, v:Math.round(dmg*10), t:0, big: knock > 10 || e.hp <= 0, c: e.hp <= 0 ? '#ff5a4a' : knock > 10 ? '#ffe14a' : '#efe3cf' });
  if (G.nums.length > 40) G.nums.shift();
  if (e.kind === 'boss' && e.hp > 0){ G.combo++; G.comboT = 3.2; return; }          // super armour: no stagger, no knockback
  if (e.hp <= 0){
    if (e.kind === 'boss'){ msg('HIRING MANAGER DEFEATED!  +150 XP', 3.2, '#3cff8a'); burst(e.x, 2, e.z, 40, 0x6b8650, 10); G.shake = Math.max(G.shake, 0.6); sfx.wave(); knock = 2; }
    e.state = 'dying'; e.t = 0; e.vx = dx*knock*1.3; e.vz = dz*knock*1.3; G.kills++; G.combo++; G.comboT = 3.2;
    G.style = Math.min(100, G.style + 12 + (!P.onGround ? 8 : 0) + (P.sliding ? 6 : 0) + ((P.wall.on || P.flip) ? 8 : 0));
    P.hp = Math.min(P.maxHp, P.hp + 2 + (styleRank() >= 3 ? 3 : 0)); gainXp(Math.round(ENEMY[e.kind].xp*(1+styleRank()*0.25)));
    if (P.dashCharges < 2) P.dashCharges++;                                // kills refund a dash: keep moving
    dropCoffee(e); burst(e.x, e.y+1, e.z, 16, 0xbcd6e8, 7);
  } else { e.state = 'stagger'; e.stagger = knock > 10 ? 0.6 : 0.3; e.t = 0; e.vx = dx*knock; e.vz = dz*knock; e.hitDone = false; G.combo++; G.comboT = 3.2; }
}
function updateEnemy(e, dt){
  e.anim += dt; e.flash = Math.max(0, e.flash-dt); e.atkCd -= dt; updateBubble(e, dt);
  if (e.kind === 'boss'){ if (e.state !== 'slam') slamRing.visible = false; if (e.state !== 'pull') grabLine.visible = false; }
  if (e.state === 'spawn'){ e.t += dt; if (e.t >= (e.kind === 'boss' ? 1.6 : 0.7)) e.state = 'chase'; return; }
  if (e.state === 'dying'){ const dur = e.kind === 'boss' ? 1.4 : 0.5; e.t += dt; if (e.y > 0){ e.vy = (e.vy||0) - 22*dt; e.y = Math.max(0, e.y + e.vy*dt); } moveEnemy(e, e.vx*dt, e.vz*dt); e.vx *= Math.pow(0.03,dt); e.vz *= Math.pow(0.03,dt); e.fade = Math.max(0, 1-e.t/dur); if (e.t > dur) removeEnemy(e); return; }
  if (e.air){                                                                      // launched: ballistic, no AI until it lands
    e.vy -= 22*dt; e.y += e.vy*dt; moveEnemy(e, e.vx*dt*0.3, e.vz*dt*0.3); e.vx *= Math.pow(0.1,dt); e.vz *= Math.pow(0.1,dt);
    if (e.y <= 0){ e.y = 0; e.air = false; e.state = 'stagger'; e.stagger = 0.4; e.vx = e.vz = 0; burst(e.x,0.2,e.z,6,0xe8e6e0,3); }
    return;
  }
  if (e.state === 'stagger'){ e.stagger -= dt; moveEnemy(e, e.vx*dt, e.vz*dt); e.vx *= Math.pow(0.02,dt); e.vz *= Math.pow(0.02,dt); if (e.stagger <= 0) e.state = 'chase'; return; }
  const dx = P.x-e.x, dz = P.z-e.z, d = Math.hypot(dx,dz) || 1, nx = dx/d, nz = dz/d, sp = ENEMY[e.kind].speed, dy = Math.abs(P.y-e.y);
  e.t += dt;
  if (e.kind === 'grunt'){
    if (e.state === 'chase'){ if (d > 0.95) moveEnemy(e, nx*sp*dt, nz*sp*dt); if (d < 2.3 && e.atkCd <= 0 && dy < 2.2){ e.state = 'windup'; e.t = 0; } }
    else if (e.state === 'windup'){ if (e.t >= 0.42){ e.state = 'attack'; e.t = 0; if (d < 3.0 && dy < 2.2) hurtPlayer(16, e.x, e.z, e); } }
    else if (e.state === 'attack'){ if (d > 1.0) moveEnemy(e, nx*4*dt, nz*4*dt); if (e.t >= 0.25){ e.state = 'chase'; e.atkCd = 0.6; } }
  } else if (e.kind === 'runner'){
    if (e.state === 'chase'){ if (d > 0.95) moveEnemy(e, nx*sp*dt, nz*sp*dt); if (d < 5 && e.atkCd <= 0 && dy < 2.2){ e.state = 'windup'; e.t = 0; e.lx = nx; e.lz = nz; } }
    else if (e.state === 'windup'){ if (e.t >= 0.35){ e.state = 'lunge'; e.t = 0; e.hitDone = false; } }
    else if (e.state === 'lunge'){
      moveEnemy(e, e.lx*11*dt, e.lz*11*dt);
      if (!e.hitDone && d < 1.9 && dy < 2.2){ e.hitDone = true; hurtPlayer(20, e.x, e.z, e); }
      if (e.t >= 0.3){ e.state = 'chase'; e.atkCd = 0.9; }
    }
  } else if (e.kind === 'boss'){ updateBoss(e, dt, d, nx, nz, dy);
  } else {   // thrower: an executive that hurls memos
    if (e.state === 'chase'){
      if (d > 13) moveEnemy(e, nx*sp*dt, nz*sp*dt); else if (d < 8) moveEnemy(e, -nx*sp*1.1*dt, -nz*sp*1.1*dt); else moveEnemy(e, -nz*1.5*dt, nx*1.5*dt);
      if (e.atkCd <= 0 && d < 24){ e.state = 'windup'; e.t = 0; }
    } else if (e.state === 'windup'){
      if (e.t >= 0.7){
        e.state = 'attack'; e.t = 0; const tx = P.x-e.x, ty = (P.y+1.2)-1.4, tz = P.z-e.z, td = Math.hypot(tx,ty,tz) || 1;
        launchProjectile(e.x, 1.4, e.z, tx/td*13, ty/td*13, tz/td*13);
      }
    } else if (e.state === 'attack'){ if (e.t >= 0.3){ e.state = 'chase'; e.atkCd = 1.5 + Math.random(); } }
  }
  if (e.kind !== 'boss') for (const o of enemies) if (o !== e && o.state !== 'dying'){   // keep a little spacing (the boss shoves, never gets shoved)
    const ax = e.x-o.x, az = e.z-o.z, ad = Math.hypot(ax,az);
    if (ad > 0 && ad < o.rad+0.45) moveEnemy(e, ax/ad*dt*2, az/ad*dt*2);
  }
}
function syncEnemy(e){
  let st = 'walk', fr = Math.floor(e.anim*6)%2;
  if (e.state === 'windup'){ st = 'windup'; fr = 0; } else if (e.state === 'attack' || e.state === 'lunge'){ st = 'attack'; fr = 0; }
  else if (e.state === 'stagger' || e.state === 'dying'){ st = 'hurt'; fr = 0; }
  if (e.kind === 'boss'){ fr = Math.floor(e.anim*3)%2;
    st = (e.state === 'slam' || e.state === 'barrage' || (e.state === 'charge' && e.t < 0.55)) ? 'windup' : (e.state === 'grab' || e.state === 'pull' || e.state === 'smack' || e.state === 'charge') ? 'attack' : 'walk';
    if (st !== 'walk') fr = 0; }
  e.sprite.material.map = enemyTex(e.kind, st, fr, e.flash > 0);
  const S = e.state === 'spawn' ? Math.max(0.05, e.t/(e.kind === 'boss' ? 1.6 : 0.7)) : 1, H = e.h*S;
  e.sprite.scale.set(e.w*(e.state==='spawn'?Math.min(1,S*1.5):1), H, 1);
  e.sprite.position.set(e.x, e.y + H/2, e.z);
  e.sprite.material.opacity = e.fade; e.sprite.material.rotation = e.state === 'dying' ? e.t*2.4*(e.vx > 0 ? 1 : -1) : 0;
  e.shadow.position.set(e.x, 0.05, e.z); e.shadow.material.opacity = 0.35*e.fade;
  if (e.bubble) e.bubble.sprite.position.set(e.x, e.y + H + 0.3 + e.bubble.sprite.scale.y/2, e.z);
}
/* ---------- boss: the Hiring Manager ---------- */
const slamRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color:0xff5a4a, transparent:true, opacity:0.55, depthWrite:false, side:THREE.DoubleSide }));
slamRing.rotation.x = -Math.PI/2; slamRing.visible = false; fx.add(slamRing);
const grabGeo = new THREE.CylinderGeometry(0.1, 0.16, 1, 6); grabGeo.rotateX(Math.PI/2);
const grabLine = new THREE.Mesh(grabGeo, new THREE.MeshBasicMaterial({ color:0x6b8650 })); grabLine.visible = false; fx.add(grabLine);
const SLAM_R = 6.5;
function spawnBoss(){
  const b = spawnEnemy('boss'); if (!b) return;
  G.boss = b; b.abCd = 2.5; b.sum1 = b.sum2 = false;
  msg('BOSS:  THE HIRING MANAGER', 3.2, '#ff5a4a'); sfx.wave(); showBubble(b, 'Accept the offer letter!', 2.4);
}
function bossStart(e, s){
  e.state = s; e.t = 0; e.hitDone = false;
  const say = { slam:'No negotiations!', grab:'Mandatory onboarding!', barrage:'Sign it. SIGN IT.', charge:'Fast-track promotion!' }[s];
  if (say) showBubble(e, say, 1.6);
}
function summonRecruiters(e, n){ showBubble(e, 'Calling HR!', 1.8); for (let i=0;i<n;i++){ const a = Math.random()*6.28; spawnEnemy('grunt', { x:e.x+Math.cos(a)*3.5, z:e.z+Math.sin(a)*3.5 }); } }
/* abilities: SLAM (ground ring - jump it), GRAB (tentacle reel-in - dash out), BARRAGE (fan of offer letters - deflectable),
   CHARGE (rush), CALL HR (summons recruiters at 66% / 33% health). Parrying his melee staggers him. */
function updateBoss(e, dt, d, nx, nz, dy){
  const B = ENEMY.boss, hpF = e.hp/B.hp;
  if (!e.sum1 && hpF < 0.66){ e.sum1 = true; summonRecruiters(e, 3); }
  if (!e.sum2 && hpF < 0.33){ e.sum2 = true; summonRecruiters(e, 4); }
  e.abCd -= dt;
  switch (e.state){
    case 'chase':
      if (d > 2.6) moveEnemy(e, nx*B.speed*dt, nz*B.speed*dt);
      if (e.abCd <= 0){ const r = Math.random(); bossStart(e, d < 5 ? 'slam' : (d < 14 && r < 0.4) ? 'grab' : r < 0.75 ? 'barrage' : 'charge'); }
      break;
    case 'slam': {
      const k = Math.min(1, e.t/1.0); slamRing.visible = true; slamRing.position.set(e.x, 0.06, e.z); slamRing.scale.setScalar(SLAM_R*k); slamRing.material.opacity = 0.3 + 0.5*k;
      if (e.t >= 1.0){
        slamRing.visible = false; G.shake = Math.max(G.shake, 0.5); burst(e.x,0.3,e.z,24,0x6b8650,9); noise(0.3,0.4,180);
        if (d < SLAM_R && P.y - e.y < 0.6 && hurtPlayer(22, e.x, e.z, null)){ P.vx += nx*8; P.vz += nz*8; P.vy = 5; }
        bossStart(e,'recover');
      }
      break; }
    case 'grab':
      if (e.t >= 0.6){ if (d < 14 && dy < 3 && P.dashT <= 0 && P.iframes <= 0){ e.state = 'pull'; e.t = 0; msg('GRABBED!  DASH TO BREAK FREE!', 1.4, '#ff5a4a'); } else bossStart(e,'recover'); }
      break;
    case 'pull': {
      const ay = 2.6, by = P.y+1.1; grabLine.visible = true;
      grabLine.position.set((e.x+P.x)/2, (ay+by)/2, (e.z+P.z)/2); grabLine.lookAt(P.x, by, P.z); grabLine.scale.set(1, 1, Math.hypot(P.x-e.x, by-ay, P.z-e.z));
      if (P.dashT > 0){ grabLine.visible = false; msg('BROKE FREE!', 1, '#3cff8a'); bossStart(e,'recover'); break; }
      P.vx = -nx*9; P.vz = -nz*9; if (P.onGround) P.vy = 7;            // yanked off your feet, over low cover
      if (d < 2.8 || e.t > 1.2){ grabLine.visible = false; e.state = 'smack'; e.t = 0; }
      break; }
    case 'smack':
      if (e.t >= 0.25){ if (d < 3.4 && dy < 2.5) hurtPlayer(18, e.x, e.z, e); bossStart(e,'recover'); }
      break;
    case 'barrage':
      if (e.t >= 0.7){ const base = Math.atan2(nx, nz), vy = ((P.y+1.2)-2.6)/Math.max(1,d)*14;
        for (let i=-2;i<=2;i++){ const a = base + i*0.18; launchProjectile(e.x, 2.6, e.z, Math.sin(a)*14, vy, Math.cos(a)*14, 10); }
        sfx.swing(); bossStart(e,'recover'); }
      break;
    case 'charge':
      if (e.t < 0.55){ e.lx = nx; e.lz = nz; }
      else { moveEnemy(e, e.lx*13*dt, e.lz*13*dt);
        if (!e.hitDone && d < 2.4 && dy < 2.5){ e.hitDone = true; if (hurtPlayer(20, e.x, e.z, e)){ P.vx += e.lx*9; P.vz += e.lz*9; } }
        if (e.t > 1.35) bossStart(e,'recover'); }
      break;
    case 'recover':
      if (e.t >= 0.8){ e.state = 'chase'; e.abCd = 1.0 + Math.random()*1.2; }
      break;
    default: e.state = 'chase';
  }
}
const paperMap = paperTex();
function launchProjectile(x,y,z,vx,vy,vz,dmg){
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:paperMap, transparent:true })); sprite.scale.set(0.6,0.6,1); fx.add(sprite);
  projectiles.push({ x,y,z,vx,vy,vz, life:4, fromPlayer:false, sprite, dmg: dmg || 12 });
}
function updateProjectiles(dt){
  for (let i=projectiles.length-1;i>=0;i--){
    const p = projectiles[i]; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; p.life -= dt; let dead = p.life <= 0 || p.y < 0.05;
    for (const b of solids) if (p.x>b.minx && p.x<b.maxx && p.y>b.miny && p.y<b.maxy && p.z>b.minz && p.z<b.maxz){ dead = true; break; }
    if (!dead && p.fromPlayer){
      for (const e of enemies) if (e.state !== 'dying' && e.state !== 'spawn' && Math.hypot(e.x-p.x, e.z-p.z) < 0.35+e.rad && p.y < e.h){ const d = Math.hypot(p.vx,p.vz)||1; damageEnemy(e, 2, p.vx/d, p.vz/d, 6); dead = true; break; }
    } else if (!dead){
      if (Math.hypot(P.x-p.x, P.z-p.z) < 0.7 && p.y > P.y && p.y < P.y+P.h+0.2){
        if (P.blocking){ p.fromPlayer = true; const l = lookVec(); p.vx = l[0]*20; p.vy = l[1]*20; p.vz = l[2]*20; burst(p.x,p.y,p.z,6,0xffffff,4); sfx.parry(); msg('DEFLECT!',0.8,'#8fb4d0'); }
        else { hurtPlayer(p.dmg, p.x - p.vx, p.z - p.vz, null); dead = true; }
      }
    }
    p.sprite.position.set(p.x,p.y,p.z);
    if (dead){ fx.remove(p.sprite); p.sprite.material.dispose(); projectiles.splice(i,1); }
  }
}
const partPool = [];
for (let i=0;i<120;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ color:0xffffff })); s.scale.set(0.13,0.13,1); s.visible = false; fx.add(s); partPool.push({ s, vx:0,vy:0,vz:0, life:0 }); }
function burst(x,y,z,n,color,spd){
  for (let i=0;i<n;i++){
    const p = partPool.find(q => q.life <= 0); if (!p) return;
    p.life = 0.4 + Math.random()*0.5; p.vx = (Math.random()-0.5)*spd*1.6; p.vy = Math.random()*spd; p.vz = (Math.random()-0.5)*spd*1.6;
    p.s.material.color.setHex(color); p.s.position.set(x,y,z); p.s.visible = true;
  }
}
function updateParticles(dt){
  for (const p of partPool){
    if (p.life <= 0) continue; p.life -= dt; p.vy -= 14*dt;
    p.s.position.x += p.vx*dt; p.s.position.y = Math.max(0.07, p.s.position.y + p.vy*dt); p.s.position.z += p.vz*dt;
    if (p.s.position.y <= 0.07){ p.vx *= 0.8; p.vz *= 0.8; p.vy = 0; }
    if (p.life <= 0) p.s.visible = false;
  }
}

/* ============================ waves, objective, saving ============================ */
const Wave = { n:0, state:'break', breakT:2.5, queue:[], spawnT:0 };
const OBJ = { phase:'goto', x:20, z:-27.6, doorZ:-29.2, t:0, arr:undefined, r:0, seen:false };   // arrive | goto | cut | survive | open | endless       // the convenience store (north-east facade)
function beamTex(){
  const c = mkCanvas(16,64), g = c.getContext('2d'), gr = g.createLinearGradient(0,64,0,0); gr.addColorStop(0,'rgba(255,225,74,.95)'); gr.addColorStop(1,'rgba(255,225,74,0)');
  g.fillStyle = gr; g.fillRect(3,0,10,64); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(7,0,2,64); return makeTex(c,false);
}
const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map:beamTex(), transparent:true, depthWrite:false, fog:false }));
beacon.scale.set(3,18,1); beacon.position.set(OBJ.x, 9, OBJ.z); beacon.visible = false; fx.add(beacon);
function signTex(a, b, col){
  const c = mkCanvas(80,32), g = c.getContext('2d'); g.fillStyle = NAVY; g.fillRect(0,0,80,32); g.fillStyle = '#f4f1ea'; g.fillRect(2,2,76,28);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 15px "Courier New",monospace'; g.fillStyle = col; g.fillText(a, 40, 12); g.font = 'bold 10px "Courier New",monospace'; g.fillStyle = '#3f4658'; g.fillText(b, 40, 24);
  return makeTex(c,false);
}
const closedTex = signTex('CLOSED','OPENS 9 AM','#b5463f'), openTex = signTex('OPEN','COME ON IN','#2f7a4f');
/* hung on the store door: always there, CLOSED until the waves are cleared, then OPEN */
const signSprite = new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.6), new THREE.MeshBasicMaterial({ map:closedTex, transparent:true, alphaTest:0.5, fog:true }));
signSprite.position.set(OBJ.x, 1.7, -29.93); scene.add(signSprite);
/* first visit: the player walks up, rattles the door, finds out MOO-MART is closed until 9 AM, then the waves begin */
/* jump pads: launch onto the rooftops - vertical routes for a movement-heavy fight */
const PADS = [ { x:-20, z:-25, vx:0, vy:24, vz:-6.5 }, { x:25, z:-4, vx:7, vy:22.5, vz:0 }, { x:-25, z:4, vx:-7.5, vy:24, vz:0 },
               { x:14, z:25, vx:0, vy:21, vz:7 }, { x:0, z:3, vx:0, vy:17, vz:0 } ];
const padGeo = new THREE.CylinderGeometry(0.9, 1.0, 0.16, 16), padCore = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 12);
const padMat = new THREE.MeshBasicMaterial({ color:0xffe14a }), padCoreMat = new THREE.MeshBasicMaterial({ color:0xe0a050 });
for (const p of PADS){ const m = new THREE.Mesh(padGeo, padMat); m.position.set(p.x, 0.08, p.z); scene.add(m); const c = new THREE.Mesh(padCore, padCoreMat); c.position.set(p.x, 0.1, p.z); scene.add(c); }
let padCd = 0;
function updatePads(dt){
  padCd -= dt; if (padCd > 0 || P.y > 0.4) return;
  for (const p of PADS) if (Math.abs(P.x-p.x) < 1 && Math.abs(P.z-p.z) < 1){
    P.vx += p.vx*0.6; P.vz += p.vz*0.6; P.vy = p.vy;                    // keep all the momentum you ran in with; the pad adds a lift + a gentle nudge toward its rooftop
    { const hs = Math.hypot(P.vx,P.vz); if (hs > MAXH){ P.vx *= MAXH/hs; P.vz *= MAXH/hs; } } P.onGround = false; P.coyote = 0; P.sliding = false; P.airJumps = 1; padCd = 0.5;
    tone('square', 300, 900, 0.25, 0.15); burst(p.x, 0.3, p.z, 14, 0xffe14a, 6); G.fovPunch = 1; G.style += 4; break;
  }
}
/* healing 1: coffee - recruiters sometimes drop a cup (the boss drops 3); it drifts to you when you're hurt (pooled sprites) */
function coffeeTex(){ const c = mkCanvas(12,16), g = c.getContext('2d'); px(g,1,3,10,12,NAVY); px(g,2,4,8,10,'#f4f1ea'); px(g,2,7,8,4,'#8f5a3a'); px(g,0,2,12,3,NAVY); px(g,1,2,10,2,'#b5463f'); px(g,5,0,2,2,'#e8e6e0'); return makeTex(c,false); }
const coffeeMat = new THREE.SpriteMaterial({ map:coffeeTex(), transparent:true, alphaTest:0.4 });
const coffees = [];
for (let i=0;i<12;i++){ const s = new THREE.Sprite(coffeeMat); s.scale.set(0.5,0.66,1); s.visible = false; fx.add(s); coffees.push({ s, x:0, z:0, life:0 }); }
function dropCoffee(e){
  const n = e.kind === 'boss' ? 3 : (Math.random() < 0.22 ? 1 : 0);
  for (let i=0;i<n;i++){ const c = coffees.find(q => q.life <= 0); if (!c) return; c.x = e.x+(Math.random()-0.5)*1.5; c.z = e.z+(Math.random()-0.5)*1.5; c.life = 15; c.s.visible = true; }
}
function updateCoffee(dt){
  for (const c of coffees){
    if (c.life <= 0) continue; c.life -= dt;
    const dx = P.x-c.x, dz = P.z-c.z, d = Math.hypot(dx,dz) || 1;
    if (d < 2.2 && P.hp < P.maxHp){ const k = Math.min(d, 9*dt); c.x += dx/d*k; c.z += dz/d*k; }
    if (d < 0.8 && P.y < 1.5 && P.hp < P.maxHp){ P.hp = Math.min(P.maxHp, P.hp+15); c.life = 0; msg('+15 COFFEE', 0.8, '#3cff8a'); tone('sine', 500, 900, 0.12, 0.12); }
    c.s.visible = c.life > 0 && (c.life > 3 || Math.floor(c.life*6)%2 === 0); c.s.position.set(c.x, 0.45 + Math.sin(G.time*4 + c.x)*0.08, c.z);
  }
}
/* healing 2: the vending machines on the south sidewalk - walk into one for +40 HP, restocked every wave */
const VEND = [ { x:-9, z:26.5, ok:true }, { x:9, z:26.5, ok:true } ];
const vendOn = signTex('DRINKS','+40 HP','#2f7a4f'), vendOff = signTex('SOLD OUT','NEXT WAVE','#7d8597');
for (const v of VEND){ v.s = new THREE.Sprite(new THREE.SpriteMaterial({ map:vendOn, transparent:true })); v.s.scale.set(1.3,0.52,1); v.s.position.set(v.x, 2.5, 27.2); fx.add(v.s); }
function updateVending(){
  for (const v of VEND) if (v.ok && P.hp < P.maxHp && Math.abs(P.x-v.x) < 1.1 && P.z > v.z-0.9 && P.y < 1){
    v.ok = false; v.s.material.map = vendOff; P.hp = Math.min(P.maxHp, P.hp+40); msg('+40 HP   (RESTOCKS NEXT WAVE)', 1.6, '#3cff8a'); tone('square', 400, 800, 0.2, 0.15);
  }
}
function restockVending(){ for (const v of VEND){ v.ok = true; v.s.material.map = vendOn; } }
function startStoreCut(){
  OBJ.phase = 'cut'; OBJ.t = 0; OBJ.arr = undefined; OBJ.r = 0; OBJ.seen = true; beacon.visible = false; signSprite.material.map = closedTex;
  for (const e of enemies.slice()) removeEnemy(e);
  P.vx = P.vz = P.vy = 0; P.sliding = false; P.blocking = false; atk.state = 'idle'; P.spin = 0;
}
/* store is open: walk to the door, pull it, chime, fade to black, then the isometric store fades in */
function startEnterStore(){
  startStoreCut(); OBJ.phase = 'enter'; OBJ.seen = true; signSprite.material.map = openTex;
}
/* first-person arm reaching for the door handle (used instead of the sword during the door scenes) */
function drawDoorHand(g){
  const a = OBJ.arr === undefined ? -1 : OBJ.t - OBJ.arr, en = OBJ.phase === 'enter';
  let reach = a < 0 ? 0 : Math.min(1, a/0.35); if (!en && a > 2.1) reach = Math.max(0, 1 - (a-2.1)/0.4);
  if (reach <= 0){ vm.x = 388; vm.y = 300; vm.a = 0.3; return; }                 // keep the sword down so it slides back up afterwards
  let hx = LW/2 + 34, hy = LH + 20 - reach*(LH*0.5 - 4);
  if (!en) for (const tr of [0.5, 1.0, 1.5]){ const d = a - tr; if (d > 0 && d < 0.24){ const s = Math.sin(d/0.24*Math.PI); hx += s*7*(tr === 1.0 ? -1 : 1); hy -= s*10; } }
  else if (a > 0.45 && a < 1.0){ const s = Math.sin((a-0.45)/0.55*Math.PI); hy -= s*16; hx -= s*8; }
  const skin = SKIN_C[CHAR.skin], hand = CHAR.gloves ? GLOVE_C[CHAR.gloves] : skin, base = TOP_C[CHAR.topCol];
  const armCol = CHAR.outer ? (CHAR.outer === 3 ? '#efe3cf' : OUTER_C[CHAR.outerCol||0]) : CHAR.top === 1 ? skin : CHAR.top === 4 ? shade(base,.75) : base;
  g.save(); g.lineCap = 'butt'; g.lineJoin = 'round';
  seg(g, hx-24, hy+6, hx+22, hy+6, 8, NAVY); seg(g, hx-24, hy+6, hx+22, hy+6, 4, '#a3aab8');          // the door handle
  const ax = hx + 70, ay = LH + 90;
  seg(g, hx, hy, ax, ay, 40, NAVY); seg(g, hx, hy, ax, ay, 33, armCol);
  g.fillStyle = NAVY; g.beginPath(); g.arc(hx, hy, 13, 0, 6.3); g.fill(); g.fillStyle = hand; g.beginPath(); g.arc(hx, hy, 10, 0, 6.3); g.fill();
  seg(g, hx-7, hy-2, hx+7, hy-2, 3, shade(hand, .75));                                                   // knuckles
  g.restore();
}
function rattle(){ G.shake = Math.max(G.shake, 0.3); noise(0.1,0.35,500); tone('square',100,60,0.1,0.22); }
function updateCut(dt){
  OBJ.t += dt; P.vx = P.vz = P.vy = 0;
  while (P.yaw > Math.PI) P.yaw -= 6.2832; while (P.yaw < -Math.PI) P.yaw += 6.2832;
  P.yaw += (0 - P.yaw)*Math.min(1,dt*5); P.pitch += (0.04 - P.pitch)*Math.min(1,dt*5);
  const dx = OBJ.x-P.x, dz = OBJ.doorZ-P.z, d = Math.hypot(dx,dz);
  if (d > 0.12){ const sp = Math.min(4.5, d/dt); P.x += dx/d*sp*dt; P.z += dz/d*sp*dt; P.bobT += dt*7; }
  else if (OBJ.arr === undefined) OBJ.arr = OBJ.t;
  if (OBJ.arr !== undefined){
    const a = OBJ.t - OBJ.arr;
    if (a > 0.5 && OBJ.r < 1){ OBJ.r = 1; rattle(); } if (a > 1.0 && OBJ.r < 2){ OBJ.r = 2; rattle(); } if (a > 1.5 && OBJ.r < 3){ OBJ.r = 3; rattle(); }
    if (OBJ.phase === 'enter'){
      if (a > 0.5 && OBJ.r < 1){ OBJ.r = 1; noise(0.1,0.3,700); tone('sine',1320,1320,0.35,0.12); tone('sine',880,880,0.5,0.12); }   // door opens + bell
      if (a > 0.8 && OBJ.r < 2){ OBJ.r = 2; fadeTo(1, 0.9, () => { OBJ.phase = 'open'; beacon.visible = false; saveProgress(); startStore(); FADE.a = 1; fadeTo(0, 1.1); }); }
      return;
    }
    if (a > 2.0 && OBJ.r < 4){ OBJ.r = 4; signSprite.visible = true; sfx.parry(); msg('CLOSED.  OPENS AT 9 AM.', 3, '#ff5a4a'); }
    if (a > 4.2){ OBJ.phase = 'survive'; Wave.n = 0; Wave.state = 'break'; Wave.breakT = 2.0; msg('SURVIVE UNTIL THE STORE OPENS!', 3.6, '#ffe14a'); }
  }
}
function openStore(announce){
  OBJ.phase = 'open'; beacon.visible = true; signSprite.material.map = openTex; signSprite.visible = true;
  if (announce) setTimeout(() => msg('IT IS 9 AM - THE STORE IS OPEN!  GET THE MILK!', 3.4, '#ffe14a'), 2600);
}
function clockText(){
  let cleared = Wave.state === 'fight' ? Wave.n-1 : Wave.n; if (OBJ.phase === 'open' || OBJ.phase === 'endless') cleared = 3;
  let frac = cleared; if (Wave.state === 'fight' && Wave.total) frac += Math.max(0, 1 - (enemies.length+Wave.queue.length)/Wave.total);
  const mins = Math.floor(30*Math.min(3,frac)/3); return mins >= 30 ? '9:00' : '8:'+(30+mins);
}
function objText(){
  const dist = Math.round(Math.hypot(P.x-OBJ.x, P.z-OBJ.z));
  if (OBJ.phase === 'goto') return 'GET TO THE STORE NOW!   MOO-MART, NORTH-EAST   ('+dist+'m)';
  if (OBJ.phase === 'survive') return 'SURVIVE UNTIL THE STORE OPENS AT 9:00 AM     (NOW '+clockText()+')';
  if (OBJ.phase === 'open') return 'THE STORE IS OPEN - GET THE MILK!   ('+dist+'m)';
  if (OBJ.phase === 'endless') return 'KEEP FIGHTING';
  if (OBJ.phase === 'home') return 'GOT THE MILK - NOW GET HOME   (next chapter coming soon)';
  return '';
}
/* mood swap: 'real' = washed-out street, horror = crimson gig world (palette + fog + sky tint) */
function setMood(horror){
  /* waves keep the normal palette and fog distance (a palette swap + thick fog made colour bands crawl across
     the screen); the only mood change is a soft dusk-pink sky and haze */
  Music.intense = horror;
  const c = horror ? 0xd9b4b8 : SKY_COL;
  scene.fog.color.setHex(c); scene.fog.near = 34; scene.fog.far = 150; scene.background.setHex(c);
  if (skyDome) skyDome.material.color.setHex(horror ? 0xffc4c4 : 0xffffff);
}
function hasSave(){ try { const s = JSON.parse(localStorage.getItem('deadend_save')); return s && s.wave > 0 ? s : null; } catch(e){ return null; } }
function saveProgress(){ try { localStorage.setItem('deadend_save', JSON.stringify({ wave:Wave.n, kills:G.kills, prog, phase:OBJ.phase })); } catch(e){} }
function clearSave(){ try { localStorage.removeItem('deadend_save'); } catch(e){} }
function startWave(){
  Wave.n++; Wave.queue = []; restockVending(); P.swUsed = false;
  const n = Wave.n;
  for (let i=0;i<5+n*3;i++) Wave.queue.push('grunt');
  if (n >= 2) for (let i=0;i<n+1;i++) Wave.queue.push('runner');
  if (n >= 2) for (let i=0;i<Math.floor(n/2)+1;i++) Wave.queue.push('thrower');
  Wave.bossT = -1;
  if (n === 3 || (n > 3 && n % 5 === 0)){ Wave.queue.length = Math.max(4, Math.floor(Wave.queue.length*0.5)); Wave.bossT = 2.5; }
  Wave.queue.sort(() => Math.random()-0.5); Wave.total = Wave.queue.length + (Wave.bossT > 0 ? 1 : 0); Wave.state = 'fight'; Wave.spawnT = 0.3; setMood(true);
  msg('WAVE '+n+' - RECRUITERS INCOMING', 2.4, '#ffe14a'); sfx.wave();
}
function updateWaves(dt){
  if (Wave.state === 'fight'){
    Wave.spawnT -= dt;
    if (Wave.queue.length && enemies.length < 14 && Wave.spawnT <= 0){ spawnEnemy(Wave.queue.pop()); Wave.spawnT = 0.55; }
    if (Wave.bossT > 0){ Wave.bossT -= dt; if (Wave.bossT <= 0) spawnBoss(); }
    if (!Wave.queue.length && enemies.length === 0 && Wave.bossT <= 0){
      Wave.state = 'break'; Wave.breakT = 6; setMood(false); P.hp = Math.min(P.maxHp, P.hp+25);
      msg('WAVE CLEARED  +25 HP  +30 XP', 2.8, '#3cff8a'); gainXp(30); saveProgress();
      if (Wave.n >= 3 && OBJ.phase === 'survive') openStore(true);
    }
  } else { Wave.breakT -= dt; if (Wave.breakT <= 0) startWave(); }
}
/* from the menu: Continue (skips the intro). New games run the intro, which calls beginGame(null) when it ends. */
function newGame(cont){ if (!cont){ startIntro(); return; } beginGame(hasSave()); }
function beginGame(sv, keepProg){
  for (const e of enemies.slice()) removeEnemy(e);
  for (const p of projectiles) fx.remove(p.sprite); projectiles.length = 0;
  Object.assign(G, { kills: sv ? sv.kills : 0, combo:0, comboT:0, shake:0, hitstop:0, vign:0, msgs:[], fovPunch:0, nums:[], hits:[], boss:null, style:0 });
  Object.assign(atk, { state:'idle', combo:0, windowT:0, buffer:0, cd:0, hold:0, charging:false, wwCd:0 });
  if (sv && sv.prog){ prog.points = sv.prog.points; prog.level = sv.prog.level||1; prog.xp = sv.prog.xp||0; prog.ranks = migrateProg(sv.prog); }
  else if (!keepProg){ prog.points = 0; prog.level = 1; prog.xp = 0; prog.ranks = {}; }
  Wave.n = sv ? sv.wave : 0; Wave.state = 'break'; Wave.breakT = 2.5; Wave.queue = []; setMood(false);
  pauseFrom = 'play';
  OBJ.phase = sv ? ((sv.phase === 'endless' || sv.phase === 'home') ? sv.phase : Wave.n >= 3 ? 'open' : 'survive') : (OBJ.seen ? 'survive' : keepProg ? 'goto' : 'arrive');   // a brand-new run opens on the arrival shot
  beacon.visible = OBJ.phase === 'goto'; signSprite.visible = true; signSprite.material.map = closedTex; if (OBJ.phase === 'open' || OBJ.phase === 'endless'){ signSprite.material.map = openTex; if (OBJ.phase === 'open') openStore(false); }
  for (const c of coffees){ c.life = 0; c.s.visible = false; } restockVending(); padCd = 0;
  if (!sv && !keepProg) clearSave();
  P.maxHp = 100; applyStats(); resetPlayer(); P.hp = P.maxHp; state = 'play'; lockPointer();
  if (OBJ.phase === 'arrive') startArrive();
  else msg(sv ? 'WELCOME BACK, '+CHAR.name.toUpperCase() : OBJ.phase === 'goto' ? 'GET TO THE STORE - NOW!' : 'SURVIVE UNTIL THE STORE OPENS!', 3.2, '#efe3cf');
}
/* arrival: wide isometric-style shot of you on the street (long lens = almost no perspective), one line,
   then the camera glides down into your head and you're in first person */
const ARR = { t:0, stage:0, lineT:0, sprite:null, p0:new THREE.Vector3(), p1:new THREE.Vector3(), q0:new THREE.Quaternion(), q1:new THREE.Quaternion(), white:0 };
const ARR_LINE = 'Alright. Time to get that milk.';
function startArrive(){
  OBJ.phase = 'arrive'; ARR.t = 0; ARR.stage = 0; ARR.lineT = 0; ARR.white = 1;
  const tex = makeTex(personCanvas(CHAR, 'stand', true), false);                    // you, seen from behind
  if (!ARR.sprite){ ARR.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, alphaTest:0.4 })); fx.add(ARR.sprite); }
  else { ARR.sprite.material.map.dispose(); ARR.sprite.material.map = tex; }
  const H = 1.8*78/64; ARR.sprite.scale.set(H*42/78, H, 1); ARR.sprite.position.set(P.x, H/2, P.z); ARR.sprite.material.opacity = 1; ARR.sprite.visible = true;
  ARR.p0.set(P.x+15, 17.5, P.z+15); ARR.p1.set(P.x, P.y+P.eye, P.z);
  camera.position.copy(ARR.p0); camera.lookAt(P.x, 1.2, P.z); ARR.q0.copy(camera.quaternion);
  ARR.q1.setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'));
  camera.fov = 18; camera.updateProjectionMatrix();
}
function updateArrive(dt){
  ARR.t += dt; ARR.white = Math.max(0, 1 - ARR.t/0.7);
  if (ARR.stage === 0){ camera.position.copy(ARR.p0); camera.quaternion.copy(ARR.q0); if (ARR.t > 0.8) ARR.stage = 1; }
  else if (ARR.stage === 1){
    ARR.lineT += dt; IN.dlg = { who:'YOU', text:ARR_LINE, shown:Math.min(ARR_LINE.length, ARR.lineT*30), shout:false };
    const done = IN.dlg.shown >= ARR_LINE.length;
    if (pressed.Enter || pressed.Space || pressed.Mouse0){ if (!done) ARR.lineT = 99; else ARR.lineT = 999; }
    if (done && (ARR.lineT > ARR_LINE.length/30 + 1.6 || ARR.lineT >= 999)){ IN.dlg = null; ARR.stage = 2; ARR.t = 0; }
  } else {
    const k = Math.min(1, ARR.t/2.4), e = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2;   // ease in-out
    camera.position.lerpVectors(ARR.p0, ARR.p1, e); camera.quaternion.copy(ARR.q0).slerp(ARR.q1, e);
    camera.fov = 18 + (settings.fov-18)*e; camera.updateProjectionMatrix();
    ARR.sprite.material.opacity = k < 0.6 ? 1 : Math.max(0, 1-(k-0.6)/0.3);
    if (k >= 1){
      ARR.sprite.visible = false; P.yaw = 0; P.pitch = 0; P.fov = settings.fov; OBJ.phase = 'goto'; beacon.visible = true;
      msg('GET TO THE STORE - NOW!', 3.2, '#efe3cf');
    }
  }
}
function drawArriveHUD(){
  if (ARR.white > 0){ dctx.globalAlpha = ARR.white; HR(0,0,DW,DH,'#fdf6e3'); dctx.globalAlpha = 1; }
  if (IN.dlg) drawDialogue();
  HT('HOLD F: fast-forward', DW-16, 24, 13, keys.KeyF ? '#ffe14a' : '#a3aab8', 'right');
}
function resumeFromPause(){ state = pauseFrom === 'store' ? 'store' : 'play'; if (state === 'play') lockPointer(); }
function openPause(){ pauseFrom = state === 'store' ? 'store' : 'play'; state = 'paused'; menuIdx = 0; for (const k in keys) keys[k] = false; }
function exitGame(){ try { window.close(); } catch(e){} setTimeout(() => { state = 'exited'; }, 120); }

/* ============================ main update ============================ */
function update(dt, real){
  if (OBJ.phase === 'arrive'){ updateArrive(real*(keys.KeyF ? 4 : 1)); return; }
  if (dt > 0){
    if (OBJ.phase === 'cut' || OBJ.phase === 'enter') updateCut(dt*(keys.KeyF ? 4 : 1)); else { updatePlayer(dt); updateCombat(dt); }
    for (const e of enemies.slice()) updateEnemy(e, dt);
    updateProjectiles(dt); updateParticles(dt); updateCoffee(dt); updatePads(dt); updateVending(); if (OBJ.phase === 'survive' || OBJ.phase === 'endless' || OBJ.phase === 'home') updateWaves(dt);
    G.time += dt; G.style = Math.max(0, Math.min(100, G.style - dt*(G.speed < 3 && P.onGround ? 10 : 4))); G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; G.vign = Math.max(0, G.vign - dt*1.6);
    for (const m of G.msgs) m.t -= dt; G.msgs = G.msgs.filter(m => m.t > 0);
    for (const n of G.nums) n.t += dt; if (G.nums.length && G.nums[0].t > 0.9) G.nums = G.nums.filter(n => n.t < 0.9);
    for (const h of G.hits) h.t -= dt; if (G.hits.length && G.hits[0].t <= 0) G.hits = G.hits.filter(h => h.t > 0);
    if (Math.hypot(P.x-OBJ.x, P.z-OBJ.z) < 2.8 && P.y < 2){
      if (OBJ.phase === 'goto') startStoreCut();
      else if (OBJ.phase === 'open') startEnterStore();   // chapter 2: walk in, door animation, fade, inside MOO-MART
    }
  }
  updateCamera(dt, real);
}

/* ============================ first-person sword (drawn into the low-res buffer) ============================ */
const vm = { x:388, y:218, a:0.3 };
const SWING_PATH = [ { x0:330,y0:120,a0:0.2,  x1:110,y1:215,a1:-2.0 }, { x0:150,y0:150,a0:-0.4, x1:400,y1:215,a1:2.0 },
                     { x0:265,y0:40, a0:0.1,  x1:250,y1:230,a1:3.0 } ];
const SLIDE_PATH = { x0:430,y0:240,a0:1.5, x1:200,y1:230,a1:-1.2 };
function vmTarget(){
  if (atk.charging || (atk.hold > 0.2 && hasSkill('whirlwind'))) return { x:420, y:236, a:1.55 };
  if (P.blocking) return { x:236, y:204, a:-0.04 };
  if (P.sliding) return { x:398, y:238, a:1.25 };
  if (P.dashT > 0) return { x:424, y:250, a:1.5 };
  if (P.wall.on) return { x:300, y:250, a:0.9 };
  const hs = Math.hypot(P.vx,P.vz);
  if (hs > 7.5 && P.onGround){ const b = Math.sin(P.bobT*2); return { x:396+b*4, y:234+Math.abs(b)*5, a:0.85 }; }
  const b = Math.sin(P.bobT*2)*Math.min(1,hs/6); return { x:388+b*3, y:218+Math.abs(b)*3, a:0.3 };
}
function swordPose(){
  if (atk.state === 'whirl'){ const k = Math.min(1, atk.t/0.5); vm.x = 300; vm.y = 185; vm.a = 1.5 + k*6.28*1.1; return vm; }
  if (atk.state === 'swing'){
    const s = SWING[atk.idx], p = Math.min(1, atk.t/s.dur), path = atk.slide ? SLIDE_PATH : SWING_PATH[atk.idx];
    const e = p < 0.18 ? -0.12*(p/0.18) : -0.12 + 1.12*(1-Math.pow(1-(p-0.18)/0.82, 3));
    const pose = { x:path.x0+(path.x1-path.x0)*e, y:path.y0+(path.y1-path.y0)*e, a:path.a0+(path.a1-path.a0)*e };
    vm.x = pose.x; vm.y = pose.y; vm.a = pose.a; return pose;
  }
  const t = vmTarget(), k = 0.3; vm.x += (t.x-vm.x)*k; vm.y += (t.y-vm.y)*k; vm.a += (t.a-vm.a)*k; return vm;
}
function seg(g, x0,y0,x1,y1, w, c){ g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); }
function drawSword(g, hx, hy, a){
  const dx = Math.sin(a), dy = -Math.cos(a), tx = Math.cos(a), ty = Math.sin(a);
  const pt = (o, s) => [hx+dx*o+tx*(s||0), hy+dy*o+ty*(s||0)];
  const skin = SKIN_C[CHAR.skin], hand = CHAR.gloves ? GLOVE_C[CHAR.gloves] : skin, base = TOP_C[CHAR.topCol];
  const armCol = CHAR.outer ? (CHAR.outer === 3 ? '#efe3cf' : OUTER_C[CHAR.outerCol||0]) : CHAR.top === 1 ? skin : CHAR.top === 4 ? shade(base,.75) : base;
  const ax = hx + (LW+40-hx)*0.5, ay = LH+80, len = Math.hypot(ax-hx, ay-hy), ux = (ax-hx)/len, uy = (ay-hy)/len;
  g.lineCap = 'butt'; g.lineJoin = 'round';
  seg(g, hx, hy, ax, ay, 40, NAVY); seg(g, hx, hy, ax, ay, 33, armCol);
  if (CHAR.top !== 3) seg(g, hx+ux*34-uy*16, hy+uy*34+ux*16, hx+ux*34+uy*16, hy+uy*34-ux*16, 5, NAVY);
  const h0 = pt(-16), h1 = pt(8);
  seg(g, h0[0],h0[1],h1[0],h1[1], 9, NAVY); seg(g, h0[0],h0[1],h1[0],h1[1], 5, '#8f5a3a');
  g.fillStyle = NAVY; g.beginPath(); g.arc(hx,hy,13,0,6.3); g.fill(); g.fillStyle = hand; g.beginPath(); g.arc(hx,hy,10,0,6.3); g.fill();
  const g0 = pt(8,-12), g1 = pt(8,12); seg(g, g0[0],g0[1],g1[0],g1[1], 8, NAVY); seg(g, g0[0],g0[1],g1[0],g1[1], 4, '#a3aab8');
  const L = 128, poly_ = [pt(10,-5), pt(L-12,-5), pt(L,0), pt(L-12,5), pt(10,5)];
  g.beginPath(); poly_.forEach((p,i) => i ? g.lineTo(p[0],p[1]) : g.moveTo(p[0],p[1])); g.closePath();
  g.strokeStyle = NAVY; g.lineWidth = 5; g.stroke(); g.fillStyle = '#e8e6e0'; g.fill();
  g.beginPath(); [pt(10,0), pt(L,0), pt(L-12,5), pt(10,5)].forEach((p,i) => i ? g.lineTo(p[0],p[1]) : g.moveTo(p[0],p[1])); g.closePath(); g.fillStyle = '#a3aab8'; g.fill();
  return pt(L,0);
}
function drawViewmodel(){
  if (P.mant) return;
  if (camPull > 0.1) return;                                                  // panned out during a flip: no first-person arm
  if (OBJ.phase === 'cut' || OBJ.phase === 'enter'){ drawDoorHand(vctx); return; }
  const pose = swordPose(), g = vctx;
  g.save();
  const tip = drawSword(g, pose.x, pose.y, pose.a);
  if (atk.state === 'swing' || atk.state === 'whirl'){ swingTrail.push(tip); if (swingTrail.length > 12) swingTrail.shift(); }
  else if (swingTrail.length) swingTrail.shift();
  for (let i=1;i<swingTrail.length;i++){ g.globalAlpha = i/swingTrail.length*0.85; seg(g, swingTrail[i-1][0],swingTrail[i-1][1], swingTrail[i][0],swingTrail[i][1], 2+i*1.4, '#f6d5cf'); }
  g.globalAlpha = 1; g.restore();
}
function drawVignetteLo(){
  const lowHp = P.hp < 30 && state !== 'menu' ? (0.25+0.15*Math.sin(G.time*8)) : 0, a = Math.max(G.vign*0.55, lowHp);
  if (a <= 0.01) return;
  const gr = vctx.createRadialGradient(LW/2,LH/2,LH*0.3,LW/2,LH/2,LW*0.62); gr.addColorStop(0,'rgba(165,42,63,0)'); gr.addColorStop(1,'rgba(165,42,63,'+a+')');
  vctx.fillStyle = gr; vctx.fillRect(0,0,LW,LH);
}

/* ============================ depth-edge outlines (navy, like the show's pixel art) ============================ */
/* One GPU pass does it all, with no CPU readback (that was the main lag source):
   scene colour + depth -> composite the 2D overlay (sword arm, vignette) -> snap to the palette via a LUT ->
   navy outline on the far side of depth steps. Enemies write depth, so outlines never show through them. */
const sceneRT = new THREE.WebGLRenderTarget(LW, LH, { minFilter:THREE.NearestFilter, magFilter:THREE.NearestFilter });
sceneRT.depthTexture = new THREE.DepthTexture(LW, LH); sceneRT.depthTexture.type = THREE.UnsignedIntType;
const vmc = mkCanvas(LW, LH), vctx = vmc.getContext('2d');                  // 2D overlay layer (viewmodel + vignette)
const overlayTex = new THREE.CanvasTexture(vmc); overlayTex.minFilter = overlayTex.magFilter = THREE.NearestFilter; overlayTex.generateMipmaps = false;
const lutCache = {};
function paletteLUT(name){                                                    // 32x32x32 colour cube flattened to 1024x32
  if (lutCache[name]) return lutCache[name];
  const p = getPal(name), data = new Uint8Array(1024*32*4);
  for (let g=0; g<32; g++) for (let b=0; b<32; b++) for (let r=0; r<32; r++){
    const c = p.cols[p.lut[(r<<10)|(g<<5)|b]], i = (g*1024 + b*32 + r)*4; data[i]=c[0]; data[i+1]=c[1]; data[i+2]=c[2]; data[i+3]=255;
  }
  const t = new THREE.DataTexture(data, 1024, 32, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return lutCache[name] = t;
}
const postMat = new THREE.ShaderMaterial({
  uniforms:{ tColor:{ value:sceneRT.texture }, tDepth:{ value:sceneRT.depthTexture }, tOver:{ value:overlayTex }, tLut:{ value:paletteLUT('real') },
             near:{ value:camera.near }, far:{ value:camera.far }, px:{ value:new THREE.Vector2(1/LW, 1/LH) } },
  vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader:[
    'precision highp float;',
    'uniform sampler2D tColor, tDepth, tOver, tLut; uniform float near, far; uniform vec2 px; varying vec2 vUv;',
    'float invz(vec2 uv){ float z = texture2D(tDepth, uv).x*2.0-1.0; return (far+near-z*(far-near))/(2.0*near*far); }',
    'void main(){',
    '  vec4 o = texture2D(tOver, vUv);',
    '  vec3 c = mix(texture2D(tColor, vUv).rgb, o.rgb, o.a);',
    '  vec3 q = min(floor(clamp(c,0.0,1.0)*31.875), vec3(31.0));',
    '  vec3 outc = texture2D(tLut, vec2((q.r + q.b*32.0 + 0.5)/1024.0, (q.g + 0.5)/32.0)).rgb;',
    '  if (o.a < 0.5){',
    '    float w = invz(vUv);',
    '    if (w > 1.0/60.0){',                                                  // no outlines past 60 m (they shimmer)
    '      float thr = 0.09*w + 0.0004;',
    '      float lx = invz(vUv-vec2(px.x,0.0)) + invz(vUv+vec2(px.x,0.0)) - 2.0*w;',
    '      float ly = invz(vUv-vec2(0.0,px.y)) + invz(vUv+vec2(0.0,px.y)) - 2.0*w;',
    '      if (lx > thr || ly > thr) outc = vec3(27.0,31.0,46.0)/255.0;',
    '    }',
    '  }',
    '  gl_FragColor = vec4(outc, 1.0);',
    '}'].join('\n'),
  depthTest:false, depthWrite:false });
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), postMat));
/* ============================ HUD + menus (drawn at full res, after quantize) ============================ */
function HT(s,x,y,size,color,align){
  dctx.font = 'bold '+size+'px "Courier New",monospace'; dctx.textAlign = align||'left'; dctx.textBaseline = 'alphabetic';
  dctx.lineJoin = 'round'; dctx.lineWidth = 5; dctx.strokeStyle = NAVY; if (color !== '#1b1f2e') dctx.strokeText(s,x,y); dctx.fillStyle = color||'#e8e6e0'; dctx.fillText(s,x,y);   // dark text on a light button gets no outline
}
function HR(x,y,w,h,c){ dctx.fillStyle = c; dctx.fillRect(x,y,w,h); }
function box(x,y,w,h,fill){ HR(x-4,y-4,w+8,h+8,NAVY); HR(x,y,w,h,fill); }
function drawHUD(){
  const hs = G.speed;
  box(24,22,280,20,'#2e1520'); HR(24,22,280*P.hp/P.maxHp,20,P.hp<30?'#ff5a4a':'#b5463f'); HR(24,22,280*P.hp/P.maxHp,5,'#e07585');
  HT('HP '+Math.ceil(P.hp), 30, 38, 15, '#fff');
  box(24,52,280,8,'#1f1018'); HR(24,52,280*Math.min(1,prog.xp/xpNeed(prog.level)),8,'#8fb4d0'); HT('LV '+prog.level, 316, 61, 13, '#8fb4d0');
  HT('WAVE '+Math.max(1,Wave.n), DW-24, 40, 24, '#ffe14a', 'right'); HT('KILLS '+G.kills, DW-24, 66, 16, '#efe3cf', 'right');
  if (Wave.state === 'fight') HT('RECRUITERS '+(enemies.length+Wave.queue.length), DW-24, 88, 14, '#8fa66a', 'right');
  else HT('NEXT WAVE IN '+Math.ceil(Math.max(0,Wave.breakT)), DW-24, 88, 14, '#8fb4d0', 'right');
  HT('SKILL POINTS '+prog.points, DW-24, 108, 14, prog.points ? '#ffe14a' : '#a3aab8', 'right');
  const obj = objText(); if (obj) HT(obj, DW/2, 76, 13, (OBJ.phase === 'survive' || OBJ.phase === 'endless') ? '#c9cdd6' : '#ffe14a', 'center');
  box(24,DH-52,200,14,'#2c3142'); HR(24,DH-52,200*Math.min(1,hs/MAXH),14,hs>12?'#ffe14a':'#8fb4d0');
  HT('SPEED '+hs.toFixed(1)+' m/s', 24, DH-62, 14, '#e8e6e0');
  let st = []; if (P.sliding) st.push('SLIDE'); if (P.wall.on) st.push('WALL RUN'); st.push('DASH ' + '#'.repeat(P.dashCharges) + '-'.repeat(2-P.dashCharges)); if (!P.onGround && P.airJumps > 0) st.push('AIR JUMP'); if (P.blocking) st.push('GUARD');
  if (hasSkill('wallflip') && P.wfWin > 0 && !P.onGround) st.push('FLIP: '+codeName(binds.flip)+' + WASD');
  HT(st.join('  '), 24, DH-22, 14, '#ffe14a');
  const sr = styleRank();
  if (G.style > 1){ HT('STYLE', DW-24, 138, 13, '#a3aab8', 'right'); HT('DCBAS'[sr], DW-24, 182, 44, ['#a3aab8','#8fb4d0','#3cff8a','#ffe14a','#ff5a4a'][sr], 'right');
    box(DW-104, 192, 80, 6, '#1f1018'); HR(DW-104, 192, 80*(sr === 4 ? 1 : (G.style%20)/20), 6, '#ffe14a'); }
  const mo = momentum(); if (mo > 1.05) HT('MOMENTUM  x'+mo.toFixed(1), 24, DH-84, 15, '#ffe14a');
  if (G.combo >= 2){ const names = ['','','HUSTLE','GRIND','OVERTIME','CRUNCH TIME','WORKAHOLIC']; HT(G.combo+' HIT  '+names[Math.min(6,G.combo)], DW-24, DH-24, 22, '#ffe14a', 'right'); }
  HR(DW/2-1,DH/2-9,2,6,'#efe3cf'); HR(DW/2-1,DH/2+3,2,6,'#efe3cf'); HR(DW/2-9,DH/2-1,6,2,'#efe3cf'); HR(DW/2+3,DH/2-1,6,2,'#efe3cf');
  if (hasSkill('whirlwind') && atk.hold > 0.12 && atk.wwCd <= 0){
    const k = Math.min(1, atk.hold/0.45); dctx.strokeStyle = NAVY; dctx.lineWidth = 8; dctx.beginPath(); dctx.arc(DW/2,DH/2,30,-1.57,-1.57+6.28,false); dctx.stroke();
    dctx.strokeStyle = k >= 1 ? '#ffe14a' : '#8fb4d0'; dctx.lineWidth = 4; dctx.beginPath(); dctx.arc(DW/2,DH/2,30,-1.57,-1.57+6.28*k,false); dctx.stroke();
    if (k >= 1) HT('RELEASE!', DW/2, DH/2+58, 16, '#ffe14a', 'center');
  }
  for (const n of G.nums){                                           // floating damage numbers
    tmpV.set(n.x, n.y, n.z).project(camera); if (tmpV.z > 1) continue;
    dctx.globalAlpha = Math.max(0, 1-n.t/0.9); HT(String(n.v), (tmpV.x+1)/2*DW, (1-tmpV.y)/2*DH - n.t*60, n.big ? 26 : 18, n.c, 'center');
  }
  dctx.globalAlpha = 1;
  if (G.hits.length){ const fa = Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw));   // red arcs point at whoever hit you
    for (const h of G.hits){ let rel = h.ang - fa; while (rel > Math.PI) rel -= 6.2832; while (rel < -Math.PI) rel += 6.2832; const a = -Math.PI/2 - rel;
      dctx.globalAlpha = Math.min(1, h.t/0.4); dctx.strokeStyle = NAVY; dctx.lineWidth = 14; dctx.beginPath(); dctx.arc(DW/2, DH/2, 118, a-0.36, a+0.36); dctx.stroke();
      dctx.strokeStyle = '#ff5a4a'; dctx.lineWidth = 8; dctx.beginPath(); dctx.arc(DW/2, DH/2, 118, a-0.33, a+0.33); dctx.stroke(); }
    dctx.globalAlpha = 1; }
  if (G.boss && G.boss.state !== 'dying'){ const f = Math.max(0, G.boss.hp/ENEMY.boss.hp);
    HT('THE HIRING MANAGER', DW/2, DH-90, 18, '#ff5a4a', 'center'); box(DW/2-240, DH-80, 480, 14, '#2e1520'); HR(DW/2-240, DH-80, 480*f, 14, '#b5463f'); HR(DW/2-240, DH-80, 480*f, 4, '#e07585'); }
  if (OBJ.phase === 'cut') HT('HOLD F: fast-forward', DW-16, DH-14, 13, keys.KeyF ? '#ffe14a' : '#a3aab8', 'right');
  G.msgs.forEach((m,i) => { dctx.globalAlpha = Math.min(1, m.t/0.5); HT(m.text, DW/2, 120+i*30, i===G.msgs.length-1?26:20, m.color, 'center'); dctx.globalAlpha = 1; });
}

let menuIdx = 0, uiRects = [];
function menuItems(){
  if (state === 'dead') return deadT > 1.4 ? [ { label:'NEW GAME', act:() => newGame(false) }, { label:'EXIT', act:exitGame } ] : [];
  const sv = hasSave();
  if (state === 'menu') return [
    { label:'START', act:() => newGame(false) },
    { label: sv ? 'CONTINUE  (WAVE '+(sv.wave+1)+')' : 'CONTINUE', en:!!sv, act:() => newGame(true) },
    { label:'OPTIONS', act:() => { optionsFrom = 'menu'; state = 'options'; menuIdx = 0; } },
    { label:'EXIT', act:exitGame } ];
  return [
    { label:'RESUME', act:resumeFromPause },
    { label:'SKILLS' + (prog.points ? '  ('+prog.points+' SP)' : ''), act:() => { skillsFrom = 'paused'; state = 'skills'; menuIdx = 0; } },
    { label:'OPTIONS', act:() => { optionsFrom = 'paused'; state = 'options'; menuIdx = 0; } },
    { label:'SAVE & MAIN MENU', act:() => { if (Wave.n > 0) saveProgress(); state = 'menu'; pauseFrom = 'play'; menuIdx = 0; setMood(false); } } ];
}
const ADJ = { sens:{ key:'sens', step:0.1, min:0.3, max:3, fmt:v => v.toFixed(1)+'x' }, fov:{ key:'fov', step:5, min:60, max:110, fmt:v => Math.round(v)+' deg' },
              music:{ key:'music', step:1, min:0, max:10, fmt:v => Math.round(v)+' / 10', after:() => setMusicVolume() },
              sfx:{ key:'sfx', step:1, min:0, max:10, fmt:v => Math.round(v)+' / 10' } };
function adjust(a, d){ settings[a.key] = Math.max(a.min, Math.min(a.max, Math.round(settings[a.key]/a.step + d)*a.step)); saveSettings(); if (a.after) a.after(); }
function optionRows(){
  const rows = ACTIONS.map(([a,l]) => ({ label:l, action:a, act:() => { capture = a; } }));
  rows.push({ label:'MOUSE SENSITIVITY', adj:ADJ.sens });
  rows.push({ label:'FIELD OF VIEW', adj:ADJ.fov });
  rows.push({ label:'MUSIC VOLUME', adj:ADJ.music });
  rows.push({ label:'SOUND FX VOLUME', adj:ADJ.sfx });
  rows.push({ label:'RESET TO DEFAULTS', btn:true, act:() => { Object.assign(binds, DEFAULT_BINDS); settings.sens = 1; settings.fov = 80; settings.music = 6; settings.sfx = 8; saveSettings(); setMusicVolume(); } });
  rows.push({ label:'BACK', btn:true, act:() => { state = optionsFrom; menuIdx = 0; } });
  return rows;
}
function skillRows(){
  const rows = treeNodes().map(n => ({ n, act:() => buyNode(n) }));
  rows.push({ label:'RESET TREE', btn:true, act:respecTree });
  rows.push({ label:'BACK', btn:true, act:() => { state = skillsFrom; menuIdx = 0; } });
  return rows;
}
/* arrow keys / WASD move around the tree grid; down past a branch's last node reaches the buttons */
function treeNav(items){
  const nodes = treeNodes(), dx = (pressed.ArrowRight||pressed.KeyD?1:0)-(pressed.ArrowLeft||pressed.KeyA?1:0), dy = (pressed.ArrowDown||pressed.KeyS?1:0)-(pressed.ArrowUp||pressed.KeyW?1:0);
  if (dx || dy){
    const cur = nodes[menuIdx];
    if (!cur){ if (dy < 0) menuIdx = 0; else if (dx) menuIdx = menuIdx === nodes.length ? nodes.length+1 : nodes.length; }
    else if (dy > 0 && !dx && !nodes.some(n => n.col === cur.col && n.row === cur.row+1)) menuIdx = nodes.length+1;
    else { const col = Math.max(0, Math.min(2, cur.col+dx)), row = cur.row+dy; let best = menuIdx, bd = 99;
      nodes.forEach((n,i) => { if (n.col !== col) return; const d = Math.abs(n.row-row); if (d < bd){ bd = d; best = i; } }); menuIdx = best; }
  }
  if ((pressed.Enter || pressed.Space) && items[menuIdx]) items[menuIdx].act();
  if (pressed.Escape){ state = skillsFrom; menuIdx = 0; }
}function clickUI(){
  for (const r of uiRects) if (mouse.x>=r.x && mouse.x<=r.x+r.w && mouse.y>=r.y && mouse.y<=r.y+r.h && r.en !== false){
    if (r.adjD){ adjust(r.adj, r.adjD); }
    else if (r.act) r.act();
    return;
  }
}
function menuNav(){
  const items = state === 'options' ? optionRows() : state === 'skills' ? skillRows() : (state === 'menu' || state === 'paused' || state === 'dead') ? menuItems() : [];
  if (!items.length) return;
  if (state === 'skills'){ treeNav(items); return; }
  const side = state === 'dead' ? (pressed.ArrowRight||pressed.KeyD?1:0) - (pressed.ArrowLeft||pressed.KeyA?1:0) : 0;   // game-over buttons sit side by side
  const dir = (pressed.ArrowDown||pressed.KeyS?1:0) - (pressed.ArrowUp||pressed.KeyW?1:0) + side;
  if (dir){ do { menuIdx = (menuIdx+dir+items.length)%items.length; } while (items[menuIdx].en === false); }
  if (state === 'options' && items[menuIdx].adj){ const d = (pressed.ArrowRight||pressed.KeyD?1:0)-(pressed.ArrowLeft||pressed.KeyA?1:0); if (d) adjust(items[menuIdx].adj, d); }
  if ((pressed.Enter || pressed.Space) && items[menuIdx].act && items[menuIdx].en !== false) items[menuIdx].act();
  if (pressed.Escape){
    if (state === 'options'){ state = optionsFrom; menuIdx = 0; } else if (state === 'skills'){ state = skillsFrom; menuIdx = 0; }
    else if (state === 'paused') resumeFromPause();
  }
}
function button(x,y,w,h,label,idx,en,act,extra){
  const hover = mouse.x>=x && mouse.x<=x+w && mouse.y>=y && mouse.y<=y+h && en !== false;
  if (hover && !locked() && (mouse._lx !== mouse.x || mouse._ly !== mouse.y)) menuIdx = idx;
  const sel = menuIdx === idx;
  box(x,y,w,h, en === false ? '#2c3142' : sel ? '#e0a050' : '#3f4658');
  HR(x,y,w,4, en === false ? '#3f4658' : sel ? '#ffe14a' : '#5a6275');
  HT(label, x+w/2, y+h/2+8, extra && extra.size || 22, en === false ? '#5a6275' : sel ? '#1b1f2e' : '#efe3cf', 'center');
  uiRects.push({ x,y,w,h,en,act });
}
function drawMenus(){
  uiRects = [];
  if (state === 'menu' || state === 'paused'){
    HR(0,0,DW,DH,'rgba(18,10,16,.42)'); HR(0,0,430,DH,'rgba(18,10,16,.55)');
    HT('THE SUPER', 62, 128, 40, '#ffe14a'); HT('SLASHER 5000', 60, 188, 52, '#e07585');
    HT(state === 'paused' ? 'PAUSED' : 'a first-person hack & slash', 62, 232, 18, '#efe3cf');
    menuItems().forEach((it,i) => button(60, 258+i*60, 330, 50, it.label, i, it.en, it.act));
    HT('W/S or mouse to choose  -  ENTER to select', 62, DH-18, 13, '#a3aab8');
  } else if (state === 'options'){
    HR(0,0,DW,DH,'rgba(18,10,16,.78)'); HT('OPTIONS - CONTROLS', DW/2, 50, 32, '#ffe14a', 'center');
    HT('Click a row, then press the new key or mouse button  (ESC cancels).  Conflicts swap automatically.', DW/2, 74, 13, '#c9cdd6', 'center');
    optionRows().forEach((r,i) => {
      const y = 92 + i*25;
      if (r.action){
        const sel = menuIdx === i, capt = capture === r.action;
        const hover = mouse.x>=120 && mouse.x<=840 && mouse.y>=y && mouse.y<=y+24; if (hover && (mouse._lx !== mouse.x || mouse._ly !== mouse.y)) menuIdx = i;
        box(120,y,720,24, sel ? '#5a6275' : '#2c3142'); HT(r.label, 136, y+18, 16, '#efe3cf');
        box(620,y+2,200,20, capt ? '#a52a3f' : '#1f1018'); HT(capt ? (Math.floor(performance.now()/300)%2 ? 'PRESS A KEY...' : '') : codeName(binds[r.action]), 720, y+18, 15, capt ? '#fff' : '#ffe14a', 'center');
        uiRects.push({ x:120,y,w:720,h:24, act:r.act });
      } else if (r.adj){
        const sel = menuIdx === i; box(120,y,720,24, sel ? '#5a6275' : '#2c3142'); HT(r.label, 136, y+18, 16, '#efe3cf');
        HT(r.adj.fmt(settings[r.adj.key]), 720, y+18, 16, '#ffe14a', 'center');
        box(620,y+2,34,20,'#3f4658'); HT('-', 637, y+18, 18, '#efe3cf', 'center'); box(786,y+2,34,20,'#3f4658'); HT('+', 803, y+18, 18, '#efe3cf', 'center');
        uiRects.push({ x:620,y:y+2,w:34,h:20, adj:r.adj, adjD:-1 }); uiRects.push({ x:786,y:y+2,w:34,h:20, adj:r.adj, adjD:1 });
      } else button(r.label === 'BACK' ? 520 : 200, 476, 240, 40, r.label, i, true, r.act, { size:18 });
    });
  } else if (state === 'skills'){
    HR(0,0,DW,DH,'rgba(18,10,16,.86)');
    HT('SKILL TREE - '+(CHAR.weapon||'sword').toUpperCase(), DW/2, 40, 30, '#ffe14a', 'center');
    HT('LEVEL '+prog.level+'     XP '+prog.xp+' / '+xpNeed(prog.level)+'     SKILL POINTS: '+prog.points, DW/2, 64, 15, prog.points ? '#3cff8a' : '#a3aab8', 'center');
    const nodes = treeNodes(), NX = c => 190 + c*290, NY = r => 104 + r*76, W = 220, NH = 58;
    BRANCHES.forEach((b,c) => HT(b, NX(c), 92, 13, '#8fb4d0', 'center'));
    for (const n of nodes) if (n.req){                                   // links: lit once the requirement is met
      const pn = nodes.find(q => q.id === n.req[0]), met = rank(pn.id) >= n.req[1], col = met ? '#ffe14a' : '#3f4658', cx = NX(n.col);
      if (n.row - pn.row === 1) HR(cx-2, NY(pn.row)+NH, 4, NY(n.row)-NY(pn.row)-NH, col);
      else { const lx = cx - W/2 - 16, y0 = NY(pn.row)+NH/2, y1 = NY(n.row)+NH/2; HR(lx, y0, 4, y1-y0, col); HR(lx, y0, 16, 4, col); HR(lx, y1, 16, 4, col); }
      HT('R'+n.req[1], n.row - pn.row === 1 ? cx+10 : cx-W/2-22, n.row - pn.row === 1 ? NY(n.row)-3 : NY(n.row)+NH/2-6, 11, met ? '#ffe14a' : '#7d8597', n.row - pn.row === 1 ? 'left' : 'right');
    }
    nodes.forEach((n,i) => {
      const x = NX(n.col)-W/2, y = NY(n.row), st = nodeState(n), r = rank(n.id), sel = menuIdx === i;
      if (mouse.x>=x && mouse.x<=x+W && mouse.y>=y && mouse.y<=y+NH && (mouse._lx !== mouse.x || mouse._ly !== mouse.y)) menuIdx = i;
      const fill = st === 'locked' ? '#1f1018' : r ? '#1f3a2a' : '#2c3142', edge = st === 'max' ? '#ffe14a' : st === 'buy' ? '#3cff8a' : r ? '#4be08a' : '#3f4658';
      box(x,y,W,NH, sel ? '#5a6275' : fill); HR(x,y,W,4,edge);
      if (sel){ dctx.strokeStyle = '#ffe14a'; dctx.lineWidth = 2; dctx.strokeRect(x-6,y-6,W+12,NH+12); }
      HT(n.name, x+10, y+24, 16, st === 'locked' ? '#5a6275' : '#efe3cf');
      for (let k=0;k<n.max;k++) HR(x+10+k*14, y+34, 10, 12, k < r ? '#ffe14a' : '#1f1018');
      HT(st === 'max' ? 'MAX' : st === 'locked' ? 'LOCKED' : n.cost+' SP', x+W-10, y+46, 12, st === 'max' ? '#ffe14a' : st === 'buy' ? '#3cff8a' : '#7d8597', 'right');
      uiRects.push({ x,y,w:W,h:NH, act:() => { menuIdx = i; buyNode(n); } });
    });
    const sn = nodes[menuIdx];                                            // details for the selected node
    box(60, 410, 840, 58, '#1f1018');
    if (sn){
      const pn = sn.req && nodes.find(q => q.id === sn.req[0]), st = nodeState(sn);
      HT(sn.name + (sn.max > 1 ? '   RANK '+rank(sn.id)+' / '+sn.max : ''), 74, 430, 15, '#ffe14a');
      dctx.font = 'bold 12px "Courier New",monospace'; wrapText(sn.desc, 560).slice(0,2).forEach((l,j) => HT(l.trim(), 74, 449+j*13, 12, '#c9cdd6'));
      HT(st === 'locked' ? 'REQUIRES '+pn.name+' RANK '+sn.req[1] : st === 'poor' ? 'NEEDS '+sn.cost+' SP' : st === 'max' ? 'MAXED' : 'ENTER / CLICK TO BUY  ('+sn.cost+' SP)',
         886, 430, 13, st === 'buy' ? '#3cff8a' : st === 'locked' ? '#ff5a4a' : '#a3aab8', 'right');
    } else HT(menuIdx === nodes.length ? 'Refund every point you spent on this tree.' : 'Back to the pause menu.', 74, 444, 14, '#c9cdd6');
    button(240, 482, 220, 36, 'RESET TREE', nodes.length, true, respecTree, { size:16 });
    button(500, 482, 220, 36, 'BACK', nodes.length+1, true, () => { state = skillsFrom; menuIdx = 0; }, { size:16 });
    HT('OTHER WEAPONS GET THEIR OWN TREES:  CHAIN - BATTLE AXE - GREATSWORD - GAUNTLET - AUTO CROSSBOWS  (COMING SOON)', DW/2, DH-6, 10, '#7d8597', 'center');  } else if (state === 'dead'){                                                    // game over: the cubicle scene is drawn behind this
    HR(0,0,DW,118,'rgba(18,10,16,.72)'); HR(0,DH-110,DW,110,'rgba(18,10,16,.72)');
    dctx.globalAlpha = Math.min(1, Math.max(0, (deadT-0.6)/0.8));
    HT('YOU WERE HIRED.', DW/2, 72, 56, '#ff5a4a', 'center');
    HT('Welcome to BizNes Corp, '+CHAR.name.toUpperCase()+'. Your shift starts now. It never ends.', DW/2, 102, 15, '#efe3cf', 'center');
    HT('Made it to wave '+Math.max(1,Wave.n)+'   -   '+G.kills+' recruiters sent packing', DW/2, DH-86, 14, '#a3aab8', 'center');
    dctx.globalAlpha = 1;
    menuItems().forEach((it,i) => button(DW/2-250+i*270, DH-66, 230, 46, it.label, i, it.en, it.act));
  } else if (state === 'exited'){
    HR(0,0,DW,DH,'#120a10'); HT('GAME CLOSED', DW/2, 250, 48, '#ffe14a', 'center'); HT('You can close this tab now.', DW/2, 292, 18, '#efe3cf', 'center');
  }
  mouse._lx = mouse.x; mouse._ly = mouse.y;
}

/* ============================ render + loop ============================ */
function blit(){ dctx.imageSmoothingEnabled = false; dctx.drawImage(lo, 0, 0, DW, DH); }   // intro/card only (2D scenes)
/* ============================ debug mode ( ` ) ============================ */
const DBG = { on:false, god:false, scale:1, ms:0, fps:60, note:'', noteT:0 };
const DBG_SCALES = [1, 0.5, 0.25, 2];
const DBG_KEYS = ['1 GOD MODE', '2 +5 SKILL POINTS', '3 SPAWN RECRUITER', '4 SPAWN BOSS', '5 KILL ALL', '6 NEXT WAVE', '7 MAX ALL SKILLS', '8 FULL HEAL', '9 TELEPORT TO STORE', '0 TIME SCALE'];
function dbgNote(s){ DBG.note = s; DBG.noteT = 1.5; }
function debugActions(){
  const k = c => pressed['Digit'+c];
  if (k(1)){ DBG.god = !DBG.god; dbgNote('GOD MODE ' + (DBG.god ? 'ON' : 'OFF')); }
  if (k(0)){ DBG.scale = DBG_SCALES[(DBG_SCALES.indexOf(DBG.scale)+1) % DBG_SCALES.length]; dbgNote('TIME x' + DBG.scale); }
  if (state === 'store'){                                                // inside MOO-MART
    if (k(5)){ for (const gd of ST.guards) if (gd.state !== 'down'){ gd.state = 'down'; gd.downT = 0; } dbgNote('ALL GUARDS DOWN'); }
    if (k(6)){ ST.hasMilk = true; ST.paid = true; dbgNote('MILK + PAID - WALK OUT THE EXIT'); }
    if (k(8)){ P.hp = P.maxHp; dbgNote('FULL HEAL'); }
    if (k(3) && ST.guards.length){ startBattle(ST.guards.find(g => g.state !== 'down') || ST.guards[0]); dbgNote('BATTLE'); }
    return;
  }
  if (state !== 'play') return;                                          // the rest need a running game
  if (k(2)){ prog.points += 5; saveProgress(); dbgNote('+5 SKILL POINTS'); }
  if (k(3)){ const e = spawnEnemy(Math.random() < 0.5 ? 'grunt' : Math.random() < 0.5 ? 'runner' : 'thrower'); dbgNote(e ? 'SPAWNED ' + e.kind.toUpperCase() : 'NO FREE SPOT'); }
  if (k(4)){ if (G.boss) dbgNote('BOSS ALREADY OUT'); else { spawnBoss(); dbgNote(G.boss ? 'BOSS SPAWNED' : 'NO FREE SPOT'); } }
  if (k(5)){ let n = 0; for (const e of enemies.slice()) if (e.state !== 'dying'){ damageEnemy(e, 9999, 0, 1, 0); n++; } dbgNote('KILLED ' + n); }
  if (k(6)){
    if (OBJ.phase === 'goto' || OBJ.phase === 'cut' || OBJ.phase === 'arrive'){
      if (OBJ.phase === 'arrive'){ ARR.sprite.visible = false; IN.dlg = null; P.yaw = 0; P.pitch = 0; }
      OBJ.phase = 'survive'; OBJ.seen = true; beacon.visible = false; signSprite.material.map = closedTex; Wave.state = 'break'; Wave.breakT = 0.1; dbgNote('SKIPPED TO WAVES');
    } else if (OBJ.phase === 'survive' || OBJ.phase === 'endless'){
      for (const e of enemies.slice()) removeEnemy(e); Wave.queue.length = 0; Wave.bossT = -1;
      if (Wave.state === 'break') Wave.breakT = 0.1; dbgNote('WAVE ' + Wave.n + ' SKIPPED');
    } else if (OBJ.phase === 'open'){ startEnterStore(); dbgNote('ENTERING THE STORE'); }
    else dbgNote('NOTHING TO SKIP HERE');
  }
  if (k(7)){ for (const n of treeNodes()) prog.ranks[n.id] = n.max; applyStats(); saveProgress(); dbgNote('ALL SKILLS MAXED'); }
  if (k(8)){ P.hp = P.maxHp; dbgNote('FULL HEAL'); }
  if (k(9)){ P.x = OBJ.x; P.z = OBJ.z + 2.5; P.y = 0; P.vx = P.vz = P.vy = 0; dbgNote('TELEPORTED TO THE STORE'); }
}
function drawDebug(){
  const x = 16, y = 128, w = 300, rows = [
    'FRAME ' + DBG.ms.toFixed(2) + ' ms   FPS ' + Math.round(DBG.fps),
    'STATE ' + state + '   PHASE ' + OBJ.phase,
    'WAVE ' + Wave.n + ' (' + Wave.state + ')   ENEMIES ' + enemies.length + '   QUEUE ' + Wave.queue.length,
    'POS ' + P.x.toFixed(1) + ', ' + P.y.toFixed(1) + ', ' + P.z.toFixed(1) + '   SPD ' + G.speed.toFixed(1),
    'GROUND ' + (P.onGround ? 'Y' : 'N') + '  DASH ' + P.dashCharges + '  AIRJ ' + P.airJumps + '  STYLE ' + Math.round(G.style),
    'HP ' + Math.ceil(P.hp) + '/' + P.maxHp + '   LV ' + prog.level + '   SP ' + prog.points,
    'GOD ' + (DBG.god ? 'ON' : 'off') + '   TIME x' + DBG.scale ];
  HR(x, y, w, 30 + rows.length*15 + DBG_KEYS.length*14, 'rgba(18,10,16,.78)'); HR(x, y, w, 3, '#3cff8a');
  HT('DEBUG  ( ` to close )', x+10, y+18, 13, '#3cff8a');
  rows.forEach((s,i) => HT(s, x+10, y+36+i*15, 11, '#efe3cf'));
  const ky = y + 40 + rows.length*15;
  DBG_KEYS.forEach((s,i) => HT(s, x+10, ky+i*14, 11, (i === 0 && DBG.god) ? '#ffe14a' : '#a3aab8'));
  if (DBG.noteT > 0) HT(DBG.note, DW/2, DH/2+90, 18, '#3cff8a', 'center');
}

function render(now){
  if (state === 'card'){ drawCard(); drawIntroHUD(); return; }          // prologue stills are pre-painted: no per-frame quantize
  if (state === 'intro'){
    drawIntroScene(lctx); quantize(lctx, LW, LH); blit(); drawIntroHUD(); return;
  }
  if (state === 'dead'){ drawCubicle(lctx, deadT); quantize(lctx, LW, LH); blit(); drawMenus(); return; }
  if (state === 'store' || (pauseFrom === 'store' && (state === 'paused' || state === 'skills' || state === 'options'))){
    drawStore(lctx); quantize(lctx, LW, LH); blit();
    if (state === 'store') drawStoreHUD(); else { HR(0,0,DW,DH,'rgba(18,10,16,.35)'); drawMenus(); }
    return;
  }   // YOU WERE HIRED.
  if (FLIP.sprite) FLIP.sprite.visible = camPull > 0.3 && state === 'play';
  if (skyDome) skyDome.position.copy(camera.position);
  renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
  vctx.clearRect(0, 0, LW, LH);
  if ((state === 'play' || state === 'paused' || state === 'skills') && OBJ.phase !== 'arrive') drawViewmodel();
  drawVignetteLo();
  overlayTex.needsUpdate = true;
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  dctx.imageSmoothingEnabled = false; dctx.drawImage(renderer.domElement, 0, 0, DW, DH);
  if (state === 'play'){ if (OBJ.phase === 'arrive') drawArriveHUD(); else drawHUD(); }
  else if (state === 'paused'){ drawHUD(); drawMenus(); }
  else drawMenus();
}
function idleCamera(real){
  if (state === 'menu' || state === 'options' || state === 'exited'){
    const t = performance.now()/1000;
    camera.position.set(Math.sin(t*0.12)*7, 2.2+Math.sin(t*0.2)*0.3, 19); camera.rotation.set(0.12, Math.sin(t*0.12)*-0.12, 0);
    if (camera.fov !== 80){ camera.fov = 80; camera.updateProjectionMatrix(); }
    for (const e of enemies.slice()) removeEnemy(e);
  }
}
/* screen fade (black), drawn over everything; fadeTo(1, dur, cb) fades out then calls cb once */
const FADE = { a:0, target:0, speed:1, cb:null };
function fadeTo(target, dur, cb){ FADE.target = target; FADE.speed = 1/Math.max(0.05, dur); FADE.cb = cb || null; }
function updateFade(dt){
  if (FADE.a === FADE.target) return;
  FADE.a += Math.sign(FADE.target-FADE.a)*Math.min(Math.abs(FADE.target-FADE.a), FADE.speed*dt);
  if (FADE.a === FADE.target && FADE.cb){ const cb = FADE.cb; FADE.cb = null; cb(); }
}
let lastT = performance.now();
function frame(now){ try { tick(now); } catch(e){ console.error(e); } requestAnimationFrame(frame); }   // an error in one frame must never kill the loop (that was the "freeze")
function tick(now){
  /* game speed = real elapsed time, never the monitor's refresh rate. Long frames (tab switch, hitch) are capped at 0.1 s so nothing
     teleports, and gameplay runs in fixed sub-steps of at most 1/60 s so physics behaves the same at 30, 60 or 144 Hz. */
  const t0 = performance.now(), raw = (now-lastT)/1000; lastT = now;
  const real = Math.max(0, Math.min(0.1, raw))*DBG.scale;
  if (DBG.on){ debugActions(); if (raw > 0) DBG.fps += (1/raw - DBG.fps)*0.1; DBG.noteT -= raw; }
  if (state === 'intro' || state === 'card') introUpdate(real*(keys.KeyF ? 4 : 1));   // hold F to fast-forward
  else if (state === 'store') updateStore(real);
  else {
    if (state === 'play' && pressed.Escape) openPause();
    if (state === 'play'){
      const steps = Math.max(1, Math.ceil(real/(1/60) - 1e-6)), h = real/steps;
      for (let i=0; i<steps && state === 'play'; i++){
        let dt = h; if (G.hitstop > 0){ G.hitstop -= h; dt = 0; }
        update(dt, h);
        if (i === 0) for (const k in pressed) delete pressed[k];          // one-shot key presses act on the first sub-step only
      }
    } else {
      menuNav(); idleCamera(real);
      if (state === 'dead') deadT += real;
    }
  }
  updateFade(Math.min(0.1, Math.max(0, raw)));
  for (const e of enemies) syncEnemy(e);
  render(now); drawTouchUI();
  if (FADE.a > 0.003){ dctx.globalAlpha = FADE.a; dctx.fillStyle = '#000'; dctx.fillRect(0, 0, DW, DH); dctx.globalAlpha = 1; }
  if (DBG.on){ DBG.ms += (performance.now()-t0 - DBG.ms)*0.1; drawDebug(); }
  for (const k in pressed) delete pressed[k];
}
function boot(){ requestAnimationFrame(frame); }
