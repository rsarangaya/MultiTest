"use strict";
/* ============================================================================
   STORE  -  chapter 2: inside MOO-MART 24 (isometric stealth).
   Recruiters patrol with vision cones; shelves block sight. Sneak (C) = quieter + harder
   to spot, run (Shift) = loud. Space from behind = instant takedown. Get spotted = a small
   turn-based battle. Goal: milk from the dairy fridges -> pay at the register -> leave.
   Cost: the floor/walls are pre-rendered once; per frame only the ~35 objects + actors are
   sorted and drawn, plus a few short grid raycasts per guard for the cones.
   ============================================================================ */
const SM = [                       // 14 x 10.  # shelf (tall, blocks sight)  F dairy fridge  P produce bin (low)  C counter (low)
  'PP.PP..FFFFFF.',
  '..............',
  '.##.##.##.##..',
  '.##.##.##.##..',
  '..............',
  '.##.##.##.##..',
  '..............',
  'CCC...........',
  '..............',
  '..............' ];
const SW = 14, SH = 10;
const scell = (x,y) => (x < 0 || y < 0 || x >= SW || y >= SH) ? '#' : SM[Math.floor(y)][Math.floor(x)];
const ssolid = (x,y) => scell(x,y) !== '.';
const stall = (x,y) => { const c = scell(x,y); return c === '#' || c === 'F'; };
const SP = (x,y,z) => [208+(x-y)*16, 66+(x+y)*8-(z||0)];          // store projector (whole store fits on screen: no scrolling)
function sbox(g, x,y,z, w,d,h, base, topc){
  poly(g,[SP(x,y,z+h),SP(x+w,y,z+h),SP(x+w,y+d,z+h),SP(x,y+d,z+h)], topc || shade(base,1.12));
  poly(g,[SP(x,y+d,z),SP(x+w,y+d,z),SP(x+w,y+d,z+h),SP(x,y+d,z+h)], base);
  poly(g,[SP(x+w,y,z),SP(x+w,y+d,z),SP(x+w,y+d,z+h),SP(x+w,y,z+h)], shade(base,.74));
}
const STORE_SCALE = 0.5;
function drawCellObj(g, c, x, y){
  if (c === '#'){ sbox(g,x+0.05,y+0.05,0,0.9,0.9,30,'#a3aab8','#c9cdd6');
    for (let r=0;r<3;r++) for (let i=0;i<3;i++){ const col = ST.prods[(y*SW+x)*6+r*2+(i%2)], z = 5+r*8;
      poly(g,[SP(x+0.1+i*0.27,y+0.95,z),SP(x+0.3+i*0.27,y+0.95,z),SP(x+0.3+i*0.27,y+0.95,z+5),SP(x+0.1+i*0.27,y+0.95,z+5)], col, false);
      poly(g,[SP(x+0.95,y+0.1+i*0.27,z),SP(x+0.95,y+0.3+i*0.27,z),SP(x+0.95,y+0.3+i*0.27,z+5),SP(x+0.95,y+0.1+i*0.27,z+5)], shade(col,.8), false); } }
  else if (c === 'F'){ sbox(g,x,y,0,1,0.8,36,'#e8e6e0','#c9cdd6'); poly(g,[SP(x+0.08,y+0.8,4),SP(x+0.92,y+0.8,4),SP(x+0.92,y+0.8,32),SP(x+0.08,y+0.8,32)], '#bcd6e8');
    for (let r=0;r<3;r++) for (let i=0;i<3;i++) poly(g,[SP(x+0.15+i*0.26,y+0.8,7+r*8),SP(x+0.3+i*0.26,y+0.8,7+r*8),SP(x+0.3+i*0.26,y+0.8,12+r*8),SP(x+0.15+i*0.26,y+0.8,12+r*8)], r === 1 ? '#5f89ab' : '#f4f1ea', false); }
  else if (c === 'P'){ sbox(g,x+0.05,y+0.05,0,0.9,0.9,10,'#8f5a3a'); for (let i=0;i<5;i++){ const [fx,fy] = SP(x+0.25+(i%3)*0.25, y+0.3+Math.floor(i/3)*0.3, 11); g.fillStyle = ['#6b8650','#b5463f','#e0a050'][(x+i)%3]; g.fillRect(fx-2,fy-2,4,3); } }
  else { sbox(g,x,y+0.15,0,1,0.7,14,'#b5463f','#e8e6e0'); if (x === 1) sbox(g,x+0.3,y+0.3,14,0.4,0.35,7,'#2c3142'); }
}
/* bake each static object into its own small canvas once; per frame they are just stamped in depth order */
function bakeStatics(){
  ST.statics = [];
  for (let y=0;y<SH;y++) for (let x=0;x<SW;x++){
    const c = SM[y][x]; if (c === '.') continue;
    const x0 = Math.floor(SP(x, y+1, 0)[0]) - 2, x1 = Math.ceil(SP(x+1, y, 0)[0]) + 2, y0 = Math.floor(SP(x, y, 44)[1]) - 2, y1 = Math.ceil(SP(x+1, y+1, 0)[1]) + 2;
    const cv = mkCanvas(x1-x0, y1-y0), cg = cv.getContext('2d'); cg.translate(-x0, -y0); drawCellObj(cg, c, x, y);
    ST.statics.push({ k:x+y+2, f:() => lctx.drawImage(cv, x0, y0) });
  }
}
function sspr(g, cv, x, y, z, flip, alpha, rot){
  const [sx,sy] = SP(x,y,z||0), w = cv.width*STORE_SCALE, h = cv.height*STORE_SCALE;
  g.save(); g.translate(sx,sy); if (rot) g.rotate(rot); if (flip) g.scale(-1,1); if (alpha !== undefined) g.globalAlpha = alpha;
  g.imageSmoothingEnabled = true; g.drawImage(cv, -w/2, -h+STORE_SCALE, w, h); g.restore();
}

/* ---------- state ---------- */
const ST = { statics:[], bg:null, gfx:null, p:null, guards:[], hasMilk:false, paid:false, coffee:1, pickups:[], battle:null, t:0, msgT:0, payT:0, prods:null };
const CASHIER = { hair:5, hairCol:4, skin:2, face:2, eyes:1, brows:2, mouth:0, facial:0, marks:0, top:1, topCol:6, pattern:0, outer:0, outerCol:0, bottom:2, botCol:1, belt:0, acc:2, accCol:3, shoes:0, shoeCol:2, gloves:0, bag:0, apron:true };
function storeGfx(){
  if (ST.gfx) return ST.gfx;
  const cup = mkCanvas(12,16), cg = cup.getContext('2d');
  px(cg,1,3,10,12,NAVY); px(cg,2,4,8,10,'#f4f1ea'); px(cg,2,7,8,4,'#8f5a3a'); px(cg,0,2,12,3,NAVY); px(cg,1,2,10,2,'#b5463f');
  return ST.gfx = { w0:outlined(paintEnemyRaw('grunt','walk',0)), w1:outlined(paintEnemyRaw('grunt','walk',1)), alert:outlined(paintEnemyRaw('grunt','windup',0)),
                    hurt:outlined(paintEnemyRaw('grunt','hurt',0)), cup };
}
function startStore(){
  storeGfx(); ST.t = 0; ST.hasMilk = false; ST.paid = false; ST.coffee = 1; ST.battle = null; ST.payT = 0;
  ST.p = { x:1.9, y:9.2, face:'ur', walkT:0, moving:false, crouch:false };
  const pat = (pts, spd) => ({ x:pts[0][0], y:pts[0][1], path:pts, pi:1, dir:0, state:'patrol', sus:0, wait:0, look:0, stun:0, t:0, spd, downT:0, anim:0 });
  ST.guards = [ pat([[1.5,1.5],[12.5,1.5]], 1.2), pat([[0.5,4.5],[13.5,4.5]], 1.35), pat([[6.5,1.5],[6.5,6.5]], 1.1), pat([[13.5,1.5],[13.5,8.5],[9.5,8.5]], 1.2) ];
  ST.pickups = [ { x:12.6, y:8.4, on:true }, { x:3.5, y:1.4, on:true } ];
  if (!ST.prods){ _s = 1234; ST.prods = []; for (let i=0;i<SW*SH*6;i++) ST.prods.push(pick(['#b5463f','#e0a050','#5f89ab','#6b8650','#e8e6e0','#f2b8b0','#8a7aa8','#c07a3a'])); }
  ST.bg = paintStoreBG(); bakeStatics();
  for (const e of enemies.slice()) removeEnemy(e);
  state = 'store'; setMood(false); if (document.exitPointerLock) document.exitPointerLock(); for (const k in keys) keys[k] = false;
  msg('MOO-MART 24.  GET THE MILK.  DON\'T GET RECRUITED.', 3.2, '#ffe14a');
}
/* static layer: floor, walls, signs - drawn once per visit */
function paintStoreBG(){
  const c = mkCanvas(LW, LH), g = c.getContext('2d');
  g.fillStyle = '#1f1018'; g.fillRect(0,0,LW,LH);
  for (let x=0;x<SW;x++) for (let y=0;y<SH;y++) poly(g,[SP(x,y,0),SP(x+1,y,0),SP(x+1,y+1,0),SP(x,y+1,0)], (x+y)%2 ? '#d4d0c8' : '#e8e6e0', '#c9cdd6');
  poly(g,[SP(0,0,0),SP(SW,0,0),SP(SW,0,58),SP(0,0,58)], '#efe3cf'); poly(g,[SP(0,0,0),SP(0,SH,0),SP(0,SH,58),SP(0,0,58)], '#d9c8a8');
  poly(g,[SP(0,0,48),SP(SW,0,48),SP(SW,0,58),SP(0,0,58)], '#b5463f', false); poly(g,[SP(0,0,48),SP(0,SH,48),SP(0,SH,58),SP(0,0,58)], '#3f5f82', false);   // stripe trim
  poly(g,[SP(7.2,0,36),SP(12.8,0,36),SP(12.8,0,46),SP(7.2,0,46)], '#3f5f82');                                    // DAIRY sign plate
  poly(g,[SP(0.3,0,36),SP(4.7,0,36),SP(4.7,0,46),SP(0.3,0,46)], '#4a6b3c');                                      // PRODUCE sign plate
  poly(g,[SP(1,9.95,0),SP(3,9.95,0),SP(3,9.5,0),SP(1,9.5,0)], '#8f5a3a');                                         // exit mat
  return c;
}

/* ---------- movement ---------- */
function storeMove(dt){
  const p = ST.p, f = (held('forward')?1:0)-(held('back')?1:0), s = (held('right')?1:0)-(held('left')?1:0);
  let mx = -f + s, my = -f - s; const l = Math.hypot(mx,my); p.moving = l > 0;
  p.crouch = held('slide'); const run = held('sprint') && !p.crouch;
  if (l > 0){
    mx /= l; my /= l; const sp = (p.crouch ? 1.7 : run ? 4.4 : 2.9)*dt, r = 0.28;
    const free = (x,y) => !ssolid(x-r,y-r) && !ssolid(x+r,y-r) && !ssolid(x-r,y+r) && !ssolid(x+r,y+r);
    if (free(p.x+mx*sp, p.y)) p.x += mx*sp;
    if (free(p.x, p.y+my*sp) || (ST.paid && p.y+my*sp > 9.4 && p.x > 0.8 && p.x < 3.2)) p.y += my*sp;   // the door only lets you out once you've paid
    p.face = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'dr' : 'ul') : (my > 0 ? 'dl' : 'ur');
    p.walkT += dt*(run ? 1.5 : 1);
  }
  p.run = run && l > 0;
}

/* ---------- guards ---------- */
function losClear(x0,y0,x1,y1){
  const d = Math.hypot(x1-x0,y1-y0), n = Math.ceil(d/0.25);
  for (let i=1;i<n;i++){ const k = i/n; if (stall(x0+(x1-x0)*k, y0+(y1-y0)*k)) return false; }
  return true;
}
const angDiff = (a,b) => { let d = a-b; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };
function guardRange(){ return ST.p.crouch ? 3.0 : 4.4; }
function updateGuards(dt){
  const p = ST.p;
  for (const g of ST.guards){
    g.anim += dt;
    if (g.state === 'down'){ g.downT += dt; continue; }
    if (g.state === 'stunned'){ g.stun -= dt; g.dir += dt*4; if (g.stun <= 0){ g.state = 'search'; g.t = 2.5; } continue; }
    const dx = p.x-g.x, dy = p.y-g.y, d = Math.hypot(dx,dy), toP = Math.atan2(dy,dx);
    const sees = d < guardRange() && Math.abs(angDiff(toP, g.dir)) < 0.6 && losClear(g.x,g.y,p.x,p.y);
    const hears = p.run && d < 3.6 && losClear(g.x,g.y,p.x,p.y);
    if (sees) g.sus += dt*(1.1 + 1.6*(1 - d/guardRange()))*(p.crouch ? 0.6 : 1);
    else if (hears){ g.sus = Math.max(g.sus, 0.4); g.dir += angDiff(toP, g.dir)*Math.min(1, dt*3); }
    else g.sus = Math.max(0, g.sus - dt*0.35);
    if (g.sus >= 1){ startBattle(g); return; }
    if (g.sus > 0.35){                                                         // suspicious: turn and step toward you
      g.state = 'alert'; g.dir += angDiff(toP, g.dir)*Math.min(1, dt*4);
      if (d > 1.2){ const sp = 0.9*dt; if (!ssolid(g.x+Math.cos(g.dir)*sp, g.y)) g.x += Math.cos(g.dir)*sp; if (!ssolid(g.x, g.y+Math.sin(g.dir)*sp)) g.y += Math.sin(g.dir)*sp; }
      continue;
    }
    if (g.state === 'alert'){ g.state = 'search'; g.t = 2; }
    if (g.state === 'search'){ g.t -= dt; g.dir += dt*1.8; if (g.t <= 0) g.state = 'patrol'; continue; }
    const tgt = g.path[g.pi], tx = tgt[0]-g.x, ty = tgt[1]-g.y, td = Math.hypot(tx,ty);       // patrol
    if (g.wait > 0){ g.wait -= dt; g.dir = g.look + Math.sin(g.wait*2.2)*0.9; if (g.wait <= 0) g.pi = (g.pi+1) % g.path.length; }
    else if (td < 0.08){ g.wait = 1.6; g.look = g.dir; }
    else { const sp = g.spd*dt; g.x += tx/td*Math.min(sp,td); g.y += ty/td*Math.min(sp,td); g.dir += angDiff(Math.atan2(ty,tx), g.dir)*Math.min(1, dt*6); }
  }
}
function takedownTarget(){
  const p = ST.p;
  for (const g of ST.guards){
    if (g.state === 'down' || g.sus >= 0.6) continue;
    const dx = p.x-g.x, dy = p.y-g.y, d = Math.hypot(dx,dy);
    if (d < 1.05 && (g.state === 'stunned' || Math.abs(angDiff(Math.atan2(dy,dx), g.dir)) > 1.4)) return g;   // from behind or the side
  }
  return null;
}
function takedown(g){
  g.state = 'down'; g.downT = 0; G.style = Math.min(100, G.style+20); gainXp(15); sfx.hit(); G.hitstop = 0.06;
  msg('TAKEDOWN!', 1, '#3cff8a');
}

/* ---------- turn-based battle ---------- */
const BATTLE_CMDS = ['SLASH', 'HEAVY SLASH', 'GUARD', 'COFFEE', 'RUN'];
function startBattle(g){
  g.state = 'alert'; g.sus = 1;
  ST.battle = { g, ehp:14, emax:14, phase:'intro', t:0, guard:false, anim:null, log:['A RECRUITER SPOTTED YOU!', '"Let\'s talk about your future!"'], nums:[], shake:0 };
  menuIdx = 0; sfx.wave(); tone('square', 220, 110, 0.3, 0.15);
}
function blog(s){ const b = ST.battle; b.log.push(s); if (b.log.length > 3) b.log.shift(); }
function bnum(who, v, c){ ST.battle.nums.push({ who, v, c, t:0 }); }
function battleCmd(i){
  const b = ST.battle; if (!b || b.phase !== 'player') return;
  if (i === 3 && ST.coffee <= 0){ tone('square',120,90,0.15,0.1); return; }
  b.phase = 'pact'; b.t = 0; b.cmd = i; b.anim = { who:'p', t:0 };
}
function resolvePlayer(){
  const b = ST.battle, i = b.cmd, r = Math.random();
  if (i === 0){ if (r < 0.92){ const d = Math.round((3 + Math.random()*1.5)*dmgMul()); b.ehp -= d; bnum('e', d, '#efe3cf'); blog('You slash for '+d+'.'); sfx.hit(); b.shake = 0.3; } else { blog('You swing... and miss.'); sfx.swing(); } }
  else if (i === 1){ if (r < 0.6){ const d = Math.round((6.5 + Math.random()*2.5)*dmgMul()); b.ehp -= d; bnum('e', d, '#ffe14a'); blog('HEAVY SLASH! '+d+' damage.'); sfx.hit(); b.shake = 0.6; } else { blog('The heavy slash goes wide.'); sfx.swing(); } }
  else if (i === 2){ b.guard = true; blog('You raise your guard.'); sfx.parry(); }
  else if (i === 3){ ST.coffee--; const h = Math.min(30, P.maxHp-P.hp); P.hp += h; bnum('p', '+'+Math.round(h), '#3cff8a'); blog('Canned coffee. +'+Math.round(h)+' HP.'); tone('sine',500,900,0.15,0.12); }
  else {
    if (r < 0.55 + 0.1*rank('footwork')){ blog('You slip away!'); b.phase = 'fled'; b.t = 0; return; }
    blog('Couldn\'t get away!');
  }
  if (b.ehp <= 0){ b.ehp = 0; b.phase = 'won'; b.t = 0; blog('The recruiter withdraws the offer.'); gainXp(25); G.kills++; return; }
  b.phase = 'ewait'; b.t = 0;
}
function resolveEnemy(){
  const b = ST.battle, hard = Math.random() < 0.3;
  let d = hard ? 10 + Math.random()*4 : 6 + Math.random()*3;
  if (b.guard){ d *= 0.25 - 0.05*rank('ironguard'); }
  d = Math.max(1, Math.round(d)); P.hp -= d; bnum('p', d, '#ff5a4a'); b.shake = hard ? 0.6 : 0.35; sfx.hurt();
  blog(hard ? '"THE HARD SELL!"  -'+d+' HP' : 'Pamphlet slap!  -'+d+' HP');
  if (b.guard && Math.random() < 0.35){ const c = Math.round(2*dmgMul()); b.ehp -= c; bnum('e', c, '#8fb4d0'); blog('Counter! '+c+' damage.'); if (b.ehp <= 0){ b.ehp = 0; b.phase = 'won'; b.t = 0; gainXp(25); G.kills++; return; } }
  b.guard = false;
  if (P.hp <= 0){ P.hp = 0; ST.battle = null; state = 'dead'; deadT = 0; menuIdx = 0; hiredStart(); sfx.die(); return; }
  b.phase = 'player'; b.t = 0;
}
function updateBattle(dt){
  const b = ST.battle; b.t += dt; b.shake = Math.max(0, b.shake - dt*2);
  for (const n of b.nums) n.t += dt; if (b.nums.length && b.nums[0].t > 1) b.nums.shift();
  if (b.anim){ b.anim.t += dt; if (b.anim.t > 0.45) b.anim = null; }
  if (b.phase === 'intro' && b.t > 1.0){ b.phase = 'player'; b.t = 0; }
  else if (b.phase === 'player'){
    const dir = (pressed.ArrowRight||pressed.KeyD||pressed.ArrowDown||pressed.KeyS?1:0) - (pressed.ArrowLeft||pressed.KeyA||pressed.ArrowUp||pressed.KeyW?1:0);
    if (dir) menuIdx = (menuIdx+dir+5)%5;
    if (pressed.Enter || pressed.Space) battleCmd(menuIdx);
  }
  else if (b.phase === 'pact' && b.t > 0.4) resolvePlayer();
  else if (b.phase === 'ewait' && b.t > 0.6){ b.phase = 'eact'; b.t = 0; b.anim = { who:'e', t:0 }; }
  else if (b.phase === 'eact' && b.t > 0.4) resolveEnemy();
  else if (b.phase === 'won' && b.t > 1.3){ b.g.state = 'down'; b.g.downT = 0; ST.battle = null; msg('RECRUITER DEFEATED', 1.4, '#3cff8a'); }
  else if (b.phase === 'fled' && b.t > 0.8){ b.g.state = 'stunned'; b.g.stun = 4; b.g.sus = 0; ST.battle = null; msg('YOU GOT AWAY - MOVE!', 1.4, '#ffe14a'); }
}

/* ---------- objectives ---------- */
const nearFridge = () => ST.p.y < 1.7 && ST.p.x > 7 && ST.p.x < 13;
const nearCounter = () => ST.p.y > 7.5 && ST.p.y < 9 && ST.p.x > 0.2 && ST.p.x < 3.4;
function storeInteract(){
  if (!ST.hasMilk && nearFridge()){ ST.hasMilk = true; msg('GOT THE MILK.  (2%, NOT THE SOY.)', 2, '#3cff8a'); tone('sine',600,900,0.2,0.12); return; }
  if (ST.hasMilk && !ST.paid && nearCounter()){ ST.payT = 2.6; msg('CASHIER: "Hold on-  *BONK*  ...that\'s $2.99."', 2.6, '#f2b8b0'); return; }
}
function updateStore(dt){
  ST.t += dt;
  if (ST.battle){ updateBattle(dt); return; }
  if (pressed.Escape){ openPause(); return; }
  storeMove(dt); updateGuards(dt); if (ST.battle) return;
  const tk = takedownTarget();
  if (tk && (pressed.Space || tapped('attack'))) takedown(tk);
  if (pressed.KeyE || pressed.Enter) storeInteract();
  if (ST.payT > 0){ ST.payT -= dt; if (ST.payT <= 0){ ST.paid = true; msg('PAID.  GOOD THING YOU GRABBED YOUR WALLET.  NOW LEAVE.', 2.4, '#3cff8a'); } }
  for (const c of ST.pickups) if (c.on && Math.hypot(ST.p.x-c.x, ST.p.y-c.y) < 0.6){ c.on = false; ST.coffee++; msg('+1 CANNED COFFEE  (use it in a fight)', 1.4, '#3cff8a'); }
  if (ST.paid && ST.p.y > 9.5) leaveStore();
  for (const m of G.msgs) m.t -= dt; G.msgs = G.msgs.filter(m => m.t > 0);
  G.style = Math.max(0, G.style - dt*2);
}
/* out the door: back on the street, head home (next chapter) */
function leaveStore(){
  state = 'play'; OBJ.phase = 'home'; beacon.visible = false; signSprite.material.map = openTex;
  resetPlayer(); P.x = OBJ.x; P.z = OBJ.z + 2; P.yaw = Math.PI; P.hp = P.maxHp; applyStats(); P.hp = P.maxHp;
  Wave.state = 'break'; Wave.breakT = 4; saveProgress(); lockPointer();
  msg('MILK ACQUIRED.  NOW GET HOME IN ONE PIECE.', 3.4, '#ffe14a');
}

/* ---------- drawing ---------- */
function drawStore(g){
  g.drawImage(ST.bg, 0, 0);
  const p = ST.p;
  /* vision cones, clipped by shelves (drawn on the floor, under everything) */
  for (const gd of ST.guards){
    if (gd.state === 'down' || gd.state === 'stunned') continue;
    const R = guardRange(), pts = [SP(gd.x, gd.y, 0)];
    for (let i=0;i<=10;i++){
      const a = gd.dir - 0.6 + 1.2*i/10, cx = Math.cos(a), cy = Math.sin(a); let L = 0;
      while (L < R && !stall(gd.x+cx*(L+0.2), gd.y+cy*(L+0.2))) L += 0.2;
      pts.push(SP(gd.x+cx*L, gd.y+cy*L, 0));
    }
    const col = gd.sus > 0.35 ? '#ff5a4a' : gd.sus > 0.05 ? '#e0a050' : '#ffe14a';
    g.globalAlpha = 0.5; poly(g, pts, col, false); g.globalAlpha = 0.9; poly(g, pts, null, col); g.globalAlpha = 1;
  }
  const list = ST.statics.slice(), F = ST.gfx;          // shelves, fridges, bins, counter: pre-baked sprites (just drawImage)
  for (const c of ST.pickups) if (c.on) list.push({ k:c.x+c.y+0.5, f:() => sspr(g, F.cup, c.x, c.y, 2+Math.sin(ST.t*4)*1.5, false) });
  /* the cashier, forever bonking a recruiter with a baguette (just for laughs) */
  const ct = ST.t % 3.8, ax = ct < 1.2 ? 4.6 - (ct/1.2)*2.1 : ct < 1.7 ? 2.5 + (ct-1.2)/0.5*3.2 : ct < 2.6 ? 5.7 : 5.7 - (ct-2.6)/1.2*1.1;
  const az = ct >= 1.2 && ct < 1.7 ? Math.sin((ct-1.2)/0.5*Math.PI)*16 : 0, swing = ct > 1.05 && ct < 1.4;
  list.push({ k:1.4+6.3+0.5, f:() => { sspr(g, personCanvas(CASHIER, swing ? 'reach' : 'stand', false), 1.4, 6.3, 0, false);
    if (swing){ const [hx,hy] = SP(1.75,6.3,24), [tx,ty] = SP(2.5,6.4,30); g.strokeStyle = NAVY; g.lineWidth = 4; g.beginPath(); g.moveTo(hx,hy); g.lineTo(tx,ty); g.stroke(); g.strokeStyle = '#e0a050'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx,hy); g.lineTo(tx,ty); g.stroke(); } } });
  list.push({ k:ax+6.4+0.5, f:() => sspr(g, ct >= 1.2 && ct < 2.6 ? F.hurt : (Math.floor(ST.t*5)%2 ? F.w0 : F.w1), ax, 6.4, az, ct >= 1.2 && ct < 2.6, 1, ct >= 1.7 && ct < 2.6 ? 1.4 : 0) });
  for (const gd of ST.guards){
    if (gd.state === 'down' && gd.downT > 1.2) continue;
    const flip = (Math.cos(gd.dir) - Math.sin(gd.dir)) < 0, cv = gd.state === 'down' ? F.hurt : gd.sus > 0.35 ? F.alert : (Math.floor(gd.anim*5)%2 ? F.w0 : F.w1);
    list.push({ k:gd.x+gd.y+0.5, f:() => sspr(g, cv, gd.x, gd.y, 0, flip, gd.state === 'down' ? Math.max(0, 1-gd.downT/1.2) : 1, gd.state === 'down' ? 1.4 : 0) });
  }
  const back = p.face === 'ul' || p.face === 'ur', pose = p.crouch ? 'sit' : p.moving ? (Math.floor(p.walkT/0.16)%2 ? 'walk1' : 'walk0') : 'stand';
  list.push({ k:p.x+p.y+0.5, f:() => sspr(g, personCanvas(CHAR, pose, back), p.x, p.y, 0, p.face === 'dl' || p.face === 'ur') });
  list.sort((a,b) => a.k-b.k).forEach(o => o.f());
}
function drawStoreHUD(){
  const p = ST.p, S2 = (x,y,z) => { const s = SP(x,y,z); return [s[0]*2, s[1]*2]; };
  if (ST.battle){ drawBattle(); return; }
  HR(16,16,290,108,'rgba(18,10,16,.72)'); HR(16,16,290,3,'#ffe14a'); HT('MOO-MART 24', 28, 40, 18, '#ffe14a');
  const obj = [['GET THE MILK (DAIRY, BACK RIGHT)', ST.hasMilk], ['PAY AT THE REGISTER', ST.paid], ['LEAVE THROUGH THE EXIT', false]];
  obj.forEach(([s,ok],i) => HT((ok ? '[X] ' : '[ ] ') + s, 28, 64+i*20, 13, ok ? '#3cff8a' : '#efe3cf'));
  box(DW-216, 22, 190, 14, '#2e1520'); HR(DW-216, 22, 190*P.hp/P.maxHp, 14, '#b5463f'); HT('HP '+Math.ceil(P.hp)+'   COFFEE x'+ST.coffee, DW-26, 56, 13, '#efe3cf', 'right');
  HT(p.crouch ? 'SNEAKING (quiet)' : p.run ? 'RUNNING (LOUD!)' : 'WALKING', DW-26, 76, 13, p.crouch ? '#3cff8a' : p.run ? '#ff5a4a' : '#a3aab8', 'right');
  for (const gd of ST.guards){                                                   // ? / ! over heads
    if (gd.state === 'down') continue; const [x,y] = S2(gd.x, gd.y, 40);
    if (gd.state === 'stunned') HT('@', x, y, 18, '#8fb4d0', 'center');
    else if (gd.sus > 0.35) HT('!', x, y-Math.abs(Math.sin(ST.t*10))*4, 26, '#ff5a4a', 'center');
    else if (gd.sus > 0.05) HT('?', x, y, 20, '#e0a050', 'center');
  }
  const ct = ST.t % 3.8;                                                          // cashier gag lines
  if (ct > 1.05 && ct < 1.9){ const [x,y] = S2(1.4,6.3,44); HT('NOT HIRING!', x, y, 14, '#f2b8b0', 'center'); const [bx,by] = S2(2.6,6.4,40); HT('BONK!', bx+30, by, 16, '#ffe14a', 'center'); }
  else if (ct < 1.0){ const [x,y] = S2(4.0,6.4,44); HT('Join us!', x, y, 12, '#c9cdd6', 'center'); }
  const tk = takedownTarget(); let prompt = '';
  if (tk) prompt = 'SPACE / CLICK:  TAKEDOWN';
  else if (!ST.hasMilk && nearFridge()) prompt = 'E:  GRAB THE MILK';
  else if (ST.hasMilk && !ST.paid && nearCounter()) prompt = ST.payT > 0 ? 'PAYING...' : 'E:  PAY';
  else if (ST.paid) { const [x,y] = S2(2,10,0); HT('EXIT', x, y+18, 16, '#3cff8a', 'center'); }
  if (prompt){ const [x,y] = S2(p.x, p.y, 50); HT(prompt, x, y, 15, '#ffe14a', 'center'); }
  HT('WASD move  -  SHIFT run (loud)  -  hold C sneak  -  SPACE takedown from behind  -  E interact  -  ESC pause', DW/2, DH-12, 12, '#a3aab8', 'center');
  G.msgs.forEach((m,i) => { dctx.globalAlpha = Math.min(1, m.t/0.5); HT(m.text, DW/2, 150+i*28, i === G.msgs.length-1 ? 22 : 18, m.color, 'center'); dctx.globalAlpha = 1; });
}
let battleBG = null;
function drawBattle(){
  const b = ST.battle;
  if (!battleBG){                                                                 // crimson halftone backdrop, built once
    battleBG = mkCanvas(DW, DH); const g = battleBG.getContext('2d'), gr = g.createLinearGradient(0,0,0,DH);
    gr.addColorStop(0,'#3d1428'); gr.addColorStop(1,'#a52a3f'); g.fillStyle = gr; g.fillRect(0,0,DW,DH);
    for (let y=0;y<DH;y+=8) for (let x=(y/8)%2*4;x<DW;x+=8){ g.fillStyle = 'rgba(255,90,74,'+(0.08+0.18*y/DH)+')'; g.fillRect(x,y,3,3); }
  }
  const sh = b.shake*8, ox = (Math.random()-0.5)*sh, oy = (Math.random()-0.5)*sh;
  dctx.drawImage(battleBG, 0, 0);
  HT('BATTLE!', DW/2, 52, 36, '#ffe14a', 'center');
  dctx.imageSmoothingEnabled = false;
  const pl = b.anim && b.anim.who === 'p' ? Math.sin(b.anim.t/0.45*Math.PI)*60 : 0, el = b.anim && b.anim.who === 'e' ? Math.sin(b.anim.t/0.45*Math.PI)*60 : 0;
  const bc = bustCanvas(CHAR); dctx.drawImage(bc, 90+pl+ox, 120+oy, bc.width*3, bc.height*3);
  const ec = ST.gfx[b.phase === 'won' ? 'hurt' : b.anim && b.anim.who === 'e' ? 'alert' : 'w0']; dctx.globalAlpha = b.phase === 'won' ? Math.max(0, 1-b.t/1.2) : 1;
  dctx.save(); dctx.translate(760-el+ox, 90+oy); dctx.scale(-1,1); dctx.drawImage(ec, -ec.width*2, 0, ec.width*4, ec.height*4); dctx.restore(); dctx.globalAlpha = 1;
  HT(CHAR.name.toUpperCase(), 90, 374, 16, '#ffe14a'); box(90, 382, 200, 14, '#2e1520'); HR(90, 382, 200*P.hp/P.maxHp, 14, '#b5463f'); HT(Math.ceil(P.hp)+' / '+P.maxHp, 296, 395, 13, '#efe3cf');
  HT('RECRUITER', 690, 374, 16, '#ff5a4a'); box(690, 382, 180, 14, '#2e1520'); HR(690, 382, 180*b.ehp/b.emax, 14, '#8fa66a');
  box(320, 140, 330, 96, 'rgba(18,10,16,.85)'); b.log.forEach((l,i) => HT(l, 336, 168+i*26, 14, i === b.log.length-1 ? '#efe3cf' : '#a3aab8'));
  for (const n of b.nums){ dctx.globalAlpha = Math.max(0, 1-n.t); HT(String(n.v), n.who === 'p' ? 190 : 760, 200 - n.t*50, 30, n.c, 'center'); } dctx.globalAlpha = 1;
  uiRects = [];
  if (b.phase === 'player'){
    BATTLE_CMDS.forEach((c,i) => button(36+i*180, 440, 166, 46, c === 'COFFEE' ? 'COFFEE x'+ST.coffee : c, i, c !== 'COFFEE' || ST.coffee > 0, () => battleCmd(i), { size:16 }));
    HT('A/D or arrows to choose  -  ENTER / click to act', DW/2, 512, 13, '#c9cdd6', 'center');
  } else HT(b.phase === 'intro' ? 'GET READY...' : b.phase === 'won' ? 'YOU WIN!' : b.phase === 'fled' ? 'ESCAPED!' : b.phase.startsWith('e') ? 'RECRUITER\'S TURN...' : '...', DW/2, 470, 20, '#efe3cf', 'center');
  mouse._lx = mouse.x; mouse._ly = mouse.y;
}
