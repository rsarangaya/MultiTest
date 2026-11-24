"use strict";
/* ============================================================================
   CHAPTER 2  -  the train station.
   Next morning: out of the house, down STATION ROAD (no waves - a constant rush of recruiters), to the train station entrance.
   At the entrance a tentacle drags you away (first-person cutscene) and throws you into the station hall: 1v1 vs the CAREER COUNSELOR.
   The map lives far to the east of the street (x = SX) so the two never overlap; the hall is far to the north of the road (z = AZ).
   ============================================================================ */
const SX = 500;                                   // x offset of chapter 2's map
const AZ = -300;                                  // z of the station hall (boss arena)
const STA = { active:false, rush:false, spawnT:0, t:0, startZ:62, doorZ:-62.4, doorR:3.4 };

/* ---------- the road ---------- */
function buildStation(){
  const g = new THREE.Mesh(new THREE.PlaneGeometry(340,340), new THREE.MeshBasicMaterial({ map: tiled('asphalt',85,85), fog:true }));
  g.rotation.x = -Math.PI/2; g.position.set(SX,0,-10); scene.add(g);
  decorPlane(SX-20.5,0,5,128,'sidewalk',0.03); decorPlane(SX+20.5,0,5,128,'sidewalk',0.03); decorPlane(SX,-58,60,12,'sidewalk',0.03); decorPlane(SX,63,44,6,'sidewalk',0.03);
  for (let z=56; z>-52; z-=8) flatStrip(SX, z, 0.28, 4, 0xe8e6e0, 0.04);
  for (let z=40; z>-45; z-=40) for (let x=-14; x<=14; x+=3.5) flatStrip(SX+x, z, 2, 0.6, 0xe8e6e0, 0.04);              // crosswalks
  /* canyon of shopfronts down both sides, a wall behind the start and the station across the end (no way out except over the roofs) */
  const HL = [9,10,8,9,10], HR_ = [10,9,8,10,9], KL = ['shutter','staffing','cstore','plain','staffing'], KR = ['cstore','plain','staffing','shutter','plain'];
  for (let i=0;i<5;i++){ const cz = 44 - i*22;
    addBox({ cx:SX-30, cz, w:16, d:22, h:HL[i], side:'wallCream', top:'roof', facade:{ face:'+x', kind:KL[i], bump:i+20 } });
    addBox({ cx:SX+30, cz, w:16, d:22, h:HR_[i], side:'wallCream', top:'roof', facade:{ face:'-x', kind:KR[i], bump:i+30 } }); }
  addBox({ cx:SX, cz:72, w:44, d:12, h:12, side:'wallCream', top:'roof', facade:{ face:'-z', kind:'staffing', bump:41 } });
  for (const s of [-1,1]){ addBox({ cx:SX+s*30, cz:61, w:16, d:12, h:9, side:'concrete', top:'roof' }); addBox({ cx:SX+s*32, cz:-60, w:12, d:10, h:10, side:'concrete', top:'roof' }); }
  addBox({ cx:SX, cz:-76, w:52, d:24, h:22, side:'wallCream', top:'roof', facade:{ face:'+z', kind:'station', bump:50 } });
  /* cover + parkour props */
  for (const [x,z] of [[-6,48],[6,48],[-4,30],[5,24],[0,2],[-7,-8],[8,-14],[-3,-30],[4,-40]]) addBox({ cx:SX+x, cz:z, w:3, d:0.8, h:0.9, side:'barrier', top:'barrier', tile:2 });
  for (const [x,z] of [[-16,52],[16,40],[-15,-2],[15,-26],[-16,-46]]) addBox({ cx:SX+x, cz:z, w:2.4, d:1.4, h:1.3, side:'dumpster', top:'dumpster', tile:2 });
  addBox({ cx:SX+9, cz:34, w:2.8, d:10, h:3.2, side:'metal', top:'metal', tile:2 });                                    // a parked bus
  addBox({ cx:SX-11, cz:-18, w:2.2, d:4.6, h:1.6, side:'metal', top:'metal', tile:2 }); addBox({ cx:SX+12, cz:14, w:2.2, d:4.6, h:1.6, side:'metal', top:'metal', tile:2 });   // cars
  addBox({ cx:SX-9, cz:20, w:14, d:0.8, h:6, side:'concrete', top:'roof', tile:4 }); addBox({ cx:SX-9, cz:16, w:14, d:0.8, h:6, side:'tag', top:'roof', tile:4 });             // wall-run corridors
  addBox({ cx:SX+9, cz:-24, w:14, d:0.8, h:6, side:'tag', top:'roof', tile:4 }); addBox({ cx:SX+9, cz:-28, w:14, d:0.8, h:6, side:'concrete', top:'roof', tile:4 });
  /* jump pads onto the rooftops + a hop in the middle */
  const pad = (x,z,vx,vy,vz) => { PADS.push({ x, z, vx, vy, vz }); const m = new THREE.Mesh(padGeo, padMat); m.position.set(x, 0.08, z); scene.add(m); const c = new THREE.Mesh(padCore, padCoreMat); c.position.set(x, 0.1, z); scene.add(c); };
  pad(SX-15, 30, -9, 24, 0); pad(SX+15, -6, 9, 24, 0); pad(SX, 8, 0, 17, 0);
  /* vending machines against the back wall (+40 HP, single use per run through) */
  for (const x of [SX-6, SX+6]){ addBox({ cx:x, cz:65.2, w:1.1, d:0.9, h:1.9, side:'vend', top:'metal', tile:1.5 });
    const v = { x, z:64.5, ok:true }; v.s = new THREE.Sprite(new THREE.SpriteMaterial({ map:vendOn, transparent:true })); v.s.scale.set(1.3,0.52,1); v.s.position.set(x, 2.5, 65.2); fx.add(v.s); VEND.push(v); }
  /* skyline */
  _s = 5150; const tt = paintTower();
  for (let i=0;i<26;i++){ const a = i/26*Math.PI*2 + rnd()*0.1, r = 95 + rnd()*30, w = 12 + rnd()*10, h = 40 + rnd()*55;
    const map = tt.clone(); map.needsUpdate = true; map.repeat.set(w/6, h/24);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,w), new THREE.MeshBasicMaterial({ map, fog:true })); m.position.set(SX + Math.cos(a)*r, h/2, Math.sin(a)*r - 10); scene.add(m); }
}
/* ---------- the station hall: boss arena ---------- */
function departuresTex(){
  const c = mkCanvas(160,45), g = c.getContext('2d'); g.fillStyle = NAVY; g.fillRect(0,0,160,45); g.fillStyle = '#1b1f2e'; g.fillRect(2,2,156,41);
  g.fillStyle = '#ffe14a'; g.font = 'bold 9px "Courier New",monospace'; g.fillText('DEPARTURES', 6, 12); g.fillStyle = '#e0a050'; g.font = 'bold 7px "Courier New",monospace';
  [['NEXT TOWN','09:15','DELAYED'],['CAREER FAIR','ALL DAY','BOARDING'],['YOUR FUTURE','09:30','CANCELLED'],['HR FLOOR','NOW','MANDATORY']].forEach((r,i) => { g.fillText(r[0], 6, 22+i*7); g.fillText(r[1], 80, 22+i*7); g.fillStyle = r[2] === 'DELAYED' || r[2] === 'CANCELLED' ? '#ff5a4a' : '#3cff8a'; g.fillText(r[2], 116, 22+i*7); g.fillStyle = '#e0a050'; });
  return makeTex(c,false);
}
function buildArena(){
  const W = 52, H = 14;
  decorPlane(SX, AZ, W, W, 'sidewalk', 0.03);
  for (let x=-20;x<=20;x+=10) flatStrip(SX+x, AZ, 0.3, W-4, 0xc9cdd6, 0.04);
  addBox({ cx:SX-W/2-1, cz:AZ, w:2, d:W+4, h:H, side:'wallCream', top:'roof' }); addBox({ cx:SX+W/2+1, cz:AZ, w:2, d:W+4, h:H, side:'wallCream', top:'roof' });
  addBox({ cx:SX, cz:AZ-W/2-1, w:W+4, d:2, h:H, side:'wallCream', top:'roof' }); addBox({ cx:SX, cz:AZ+W/2+1, w:W+4, d:2, h:H, side:'wallCream', top:'roof' });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W+4, W+4), new THREE.MeshBasicMaterial({ map:tiled('roof', (W+4)/4, (W+4)/4), fog:true })); ceil.rotation.x = Math.PI/2; ceil.position.set(SX, H, AZ); scene.add(ceil);
  for (const x of [-10,10]) for (const z of [-10,10]) addBox({ cx:SX+x, cz:AZ+z, w:1.8, d:1.8, h:H, side:'concrete', top:'concrete', tile:3 });
  for (const [x,z] of [[-17,6],[17,6],[-17,-6],[17,-6]]) addBox({ cx:SX+x, cz:AZ+z, w:0.9, d:4, h:0.9, side:'barrier', top:'barrier', tile:2 });                       // benches
  for (const x of [-16,-8,8,16]) addBox({ cx:SX+x, cz:AZ-W/2+1.2, w:5, d:1.4, h:3.4, side:'vend', top:'metal', tile:2 });                                        // ticket windows
  const board = new THREE.Mesh(new THREE.PlaneGeometry(16,4.5), new THREE.MeshBasicMaterial({ map:departuresTex(), fog:true })); board.position.set(SX, 9, AZ-W/2+0.05); scene.add(board);
}
buildStation(); buildArena();

/* ---------- start of chapter 2 on the road ---------- */
function stationReset(){
  for (const e of enemies.slice()) removeEnemy(e);
  for (const p of projectiles) fx.remove(p.sprite); projectiles.length = 0;
  Object.assign(G, { combo:0, comboT:0, shake:0, hitstop:0, vign:0, msgs:[], fovPunch:0, nums:[], hits:[], boss:null, style:0, tumZ:0, tumX:0 });
  Object.assign(atk, { state:'idle', combo:0, windowT:0, buffer:0, cd:0, hold:0, charging:false, wwCd:0 });
  Wave.state = 'break'; Wave.breakT = 999; Wave.queue = []; Wave.bossT = -1;
  for (const c of coffees){ c.life = 0; c.s.visible = false; } restockVending(); padCd = 0; BON.flip = BON.pad = BON.close = BON.roof = BON.slamT = 0;
  homeSign.visible = false; beacon.visible = false; setMood(false);
}
function beginStation(){
  stationReset(); STA.active = true; STA.rush = false; STA.t = 0; STA.spawnT = 2;
  P.maxHp = 100; applyStats(); resetPlayer(); P.x = SX; P.z = STA.startZ - 1; P.y = 0; P.yaw = 0; P.hp = P.maxHp;
  beacon.position.set(SX, 9, STA.doorZ + 4);
  state = 'play'; pauseFrom = 'play'; OBJ.phase = 'arrive'; IN.on = false; lockPointer();
  startArrive("Okay. Train station. Mom's order. No suits.", () => {
    OBJ.phase = 'station'; beacon.visible = true; STA.rush = true; saveProgress();
    msg('GET TO THE TRAIN STATION!  THEY ARE EVERYWHERE!', 3.4, '#ffe14a');
    for (let i=0;i<6;i++) spawnRushEnemy(0);
  });
}
function spawnRushEnemy(prog){
  const r = Math.random(), kind = r < 0.5 ? 'grunt' : r < 0.82 ? 'runner' : 'thrower';
  for (let i=0;i<14;i++){
    const ahead = Math.random() < 0.78, z = ahead ? P.z - 20 - Math.random()*30 : P.z + 14 + Math.random()*16, x = SX + (Math.random()*2-1)*15;
    if (z < STA.doorZ + 5 || z > STA.startZ + 2) continue;
    if (spawnEnemy(kind, { x, z })) return true;
  }
  return false;
}
/* the rush: no waves. Enemies keep arriving, faster and thicker the closer you get to the station. */
function updateStation(dt){
  if (!STA.rush) return;
  STA.t += dt; STA.spawnT -= dt;
  const prog = Math.max(0, Math.min(1, (STA.startZ - P.z)/(STA.startZ - STA.doorZ))), cap = 11 + Math.round(prog*8), rate = 1.0 - 0.5*prog;
  let alive = 0; for (const e of enemies) if (e.state !== 'dying') alive++;
  if (STA.spawnT <= 0 && alive < cap){ STA.spawnT = rate*(0.7 + Math.random()*0.6); spawnRushEnemy(prog); }
  const dd = Math.hypot(P.x-SX, P.z-STA.doorZ); beacon.visible = OBJ.phase === 'station' && dd > 9;                    // the light beam gets out of your face near the doors
  if (OBJ.phase === 'station' && dd < STA.doorR && P.y < 3) startPull();
}

/* ---------- the entrance: pulled away (first person) and thrown into the hall ---------- */
const PULL = { t:0, s1:false, s2:false, fading:false, thrown:false, tt:0 };
function startPull(){
  OBJ.phase = 'pulled'; STA.rush = false; Object.assign(PULL, { t:0, s1:false, s2:false, fading:false });
  beacon.visible = false; atk.state = 'idle'; P.blocking = false; P.sliding = false; P.vx = P.vz = 0; P.vy = 0;
  for (const e of enemies.slice()) removeEnemy(e); for (const p of projectiles) fx.remove(p.sprite); projectiles.length = 0;
  G.msgs = [];
}
function updatePull(dt){
  PULL.t += dt; const t = PULL.t;
  P.yaw += (0 - P.yaw)*Math.min(1, dt*6); P.pitch += (0.05 - P.pitch)*Math.min(1, dt*6);
  if (t > 0.15 && !PULL.s1){ PULL.s1 = true; sfx.hurt(); noise(0.35, 0.4, 260); showBubbleAtPlayer(); }
  if (t < 0.9){ G.shake = Math.max(G.shake, 0.3 + 0.5*t); G.fovPunch = 0.6; }
  else {                                                                      // hoisted off the ground and dragged backwards, away from the doors
    if (!PULL.s2){ PULL.s2 = true; tone('sawtooth', 220, 60, 0.7, 0.3); sfx.wave(); }
    const k = Math.min(1, (t-0.9)/0.7); P.z += (8 + 22*k)*dt; P.y = Math.min(5, P.y + (4 + 8*k)*dt); G.fovPunch = 1.2; G.shake = Math.max(G.shake, 0.5);
  }
  if (t > 1.7 && !PULL.fading){ PULL.fading = true; fadeTo(1, 0.4, () => enterArena()); }
}
function showBubbleAtPlayer(){ msg('"HOLD ON, THERE. LET US HAVE A CHAT."', 1.6, '#c9b8ff'); }
/* tentacles creep in from the screen edges (drawn on the 2D overlay) */
function drawTentacles(g){
  const k = Math.min(1, PULL.t/0.55), sh = (Math.random()-0.5)*4*k;
  const arms = [[0,LH*0.55, LW*0.45,LH*0.5,-30], [LW,LH*0.6, LW*0.55,LH*0.46,30], [LW*0.2,LH, LW*0.42,LH*0.58,10], [LW*0.8,LH, LW*0.6,LH*0.6,-10], [LW*0.5,0, LW*0.5,LH*0.38,0]];
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  arms.forEach(([x0,y0,x1,y1,bend], i) => {
    const ex = x0 + (x1-x0)*k + sh, ey = y0 + (y1-y0)*k, cx = (x0+ex)/2 + bend*(1-k*0.4), cy = (y0+ey)/2 - 14 + Math.sin(PULL.t*9+i)*5;
    for (const [w,col] of [[15,NAVY],[11,'#6b8650']]){ g.strokeStyle = col; g.lineWidth = w*(0.6+0.4*k); g.beginPath(); g.moveTo(x0,y0); g.quadraticCurveTo(cx,cy,ex,ey); g.stroke(); }
    g.strokeStyle = '#e08f8a'; g.lineWidth = 3; g.setLineDash([1,9]); g.beginPath(); g.moveTo(x0,y0); g.quadraticCurveTo(cx,cy,ex,ey); g.stroke(); g.setLineDash([]);
  });
  g.restore();
  g.globalAlpha = Math.min(0.5, PULL.t*0.4); g.fillStyle = '#7d1a2e'; g.fillRect(0,0,LW,LH); g.globalAlpha = 1;
}
function enterArena(){
  OBJ.phase = 'boss'; STA.active = true; STA.rush = false;
  for (const e of enemies.slice()) removeEnemy(e); for (const p of projectiles) fx.remove(p.sprite); projectiles.length = 0;
  resetPlayer(); P.hp = Math.min(P.maxHp, Math.max(P.hp, P.maxHp*0.75)); P.x = SX; P.z = AZ + 21; P.y = 3.5; P.vx = 0; P.vz = -13; P.vy = 5; P.onGround = false; P.yaw = 0; P.pitch = 0.12; P.iframes = 1.6;
  G.boss = null; G.combo = 0; PULL.thrown = true; PULL.tt = 0; OBJ.lock = 1.5; setMood(true);
  const b = spawnCounselor(SX, AZ - 8); if (b) showBubble(b, "Have a seat. Let's discuss your career goals.", 3.2);
  msg('BOSS:  THE CAREER COUNSELOR', 3.4, '#c9b8ff'); sfx.wave(); G.shake = 0.5;
  saveProgress(); FADE.a = 1; fadeTo(0, 0.5);
}
/* the throw: a tumbling camera that settles upright by the time you land */
function updateThrow(dt){
  PULL.tt += dt; const k = Math.min(1, PULL.tt/1.2), amp = (1-k)*(1-k);
  G.tumZ = amp*6.283*2.5; G.tumX = Math.sin(k*Math.PI)*0.55;
  if (PULL.tt > 0.25 && P.onGround){ PULL.thrown = false; G.tumZ = G.tumX = 0; G.shake = Math.max(G.shake, 0.55); burst(P.x, 0.2, P.z, 16, 0xe8e6e0, 6); noise(0.3, 0.4, 220); sfx.hit(); msg('OOF.', 0.9, '#efe3cf'); }
  if (PULL.tt > 1.6){ PULL.thrown = false; G.tumZ = G.tumX = 0; }
}

/* ---------- the Career Counselor ---------- */
const COUNSELOR_LINES = ['Where do you see yourself in five years?', 'Let us talk about your strengths.', 'Your passion is... noted.', 'That sounds like a growth area!', 'Any questions for me?',
  'I am putting you down as "adaptable".', 'Your aptitude test results are in. Yikes.', "Let's circle back to your gaps.", 'Tell me about a time you failed. Now.', 'Have you considered sales?'];
function spawnCounselor(x, z){
  const b = spawnEnemy('boss', { x, z }); if (!b) return null;
  b.sub = 'counselor'; b.skin = 'counselor'; b.title = 'THE CAREER COUNSELOR'; b.maxHp = b.hp = 80; b.abCd = 2.6; b.coffeeT = 8; b.vol = 0; G.boss = b; return b;
}
function dropCoffeeAt(x, z){ const c = coffees.find(q => q.life <= 0); if (!c) return false; c.x = x; c.z = z; c.life = 22; c.s.visible = true; return true; }
function counselorStart(e, s){
  e.state = s; e.t = 0; e.hitDone = false;
  const say = { quiz:'Aptitude test! Pencils up!', review:'Time for your performance review!', jab:'Red pen corrections!' }[s]; if (say) showBubble(e, say, 1.5);
}
/* abilities: QUIZ (a fan of answer sheets, deflectable), REVIEW (a slow ground ring - jump it), RED PEN (three quick stabs toward you).
   Below half health he is faster and doubles the quiz. Every ~10 s he calls a COFFEE BREAK and leaves a cup somewhere in the hall. */
function updateCounselor(e, dt, d, nx, nz, dy){
  const p2 = e.hp < e.maxHp*0.5, SP = p2 ? 3.7 : 3.0;
  e.abCd -= dt; e.coffeeT -= dt;
  if (e.coffeeT <= 0 && e.state !== 'spawn'){
    e.coffeeT = p2 ? 8 : 11;
    for (let i=0;i<6;i++){ const a = Math.random()*6.283, r = 6 + Math.random()*12, x = SX + Math.cos(a)*r, z = AZ + Math.sin(a)*r; if (!circleBlocked(x, z, 0.5) && dropCoffeeAt(x, z)){ showBubble(e, 'Coffee break! ...for you. Not me.', 2.0); break; } }
  }
  switch (e.state){
    case 'chase':
      if (d > 5.2) moveEnemy(e, nx*SP*dt, nz*SP*dt); else if (d < 3.4) moveEnemy(e, -nx*SP*0.8*dt, -nz*SP*0.8*dt); else moveEnemy(e, -nz*1.4*dt, nx*1.4*dt);          // keeps a professional distance
      if (e.abCd <= 0){ const r = Math.random(); counselorStart(e, d < 4.5 ? (r < 0.5 ? 'jab' : 'review') : (r < 0.5 ? 'quiz' : r < 0.8 ? 'jab' : 'review')); }
      break;
    case 'quiz':
      if (!e.hitDone && e.t >= 0.7){ e.hitDone = true; counselorFan(e, d, nx, nz, p2 ? 7 : 5, 0.2, 11); sfx.swing(); }
      if (p2 && !e.hit2 && e.t >= 1.2){ e.hit2 = true; counselorFan(e, d, nx, nz, 6, 0.26, 9); sfx.swing(); }
      if (e.t >= (p2 ? 1.5 : 1.0)){ e.hit2 = false; counselorStart(e, 'recover'); }
      break;
    case 'review': {
      const k = Math.min(1, e.t/1.1); slamRing.visible = true; slamRing.position.set(e.x, 0.06, e.z); slamRing.scale.setScalar(SLAM_R*0.9*k); slamRing.material.opacity = 0.3 + 0.5*k;
      if (e.t >= 1.1){ slamRing.visible = false; G.shake = Math.max(G.shake, 0.45); burst(e.x, 0.3, e.z, 24, 0x9a8fc8, 9); noise(0.3, 0.4, 170);
        if (d < SLAM_R*0.9 && P.y - e.y < 0.6 && hurtPlayer(20, e.x, e.z, null)){ P.vx += nx*8; P.vz += nz*8; P.vy = 5; } counselorStart(e, 'recover'); }
      break; }
    case 'jab':
      if (e.t < 0.45){ e.lx = nx; e.lz = nz; }
      else { const n = Math.floor((e.t-0.45)/0.26), ph = (e.t-0.45)%0.26;
        if (n < 3){ if (ph < 0.14) moveEnemy(e, e.lx*15*dt, e.lz*15*dt); if (ph < 0.14 && !e.hitDone && d < 2.5 && dy < 2.5){ e.hitDone = true; if (hurtPlayer(14, e.x, e.z, e)){ P.vx += e.lx*6; P.vz += e.lz*6; } } if (ph > 0.2) e.hitDone = false; if (ph < dt*1.5 && n > 0){ e.lx = nx; e.lz = nz; } }
        else counselorStart(e, 'recover'); }
      break;
    case 'recover':
      if (e.t >= (p2 ? 0.55 : 0.85)){ e.state = 'chase'; e.abCd = (p2 ? 0.7 : 1.1) + Math.random()*1.0; }
      break;
    default: e.state = 'chase';
  }
}
function counselorFan(e, d, nx, nz, n, spread, spd){
  const base = Math.atan2(nx, nz), vy = ((P.y+1.2)-2.6)/Math.max(1,d)*spd, half = (n-1)/2;
  for (let i=0;i<n;i++){ const a = base + (i-half)*spread; launchProjectile(e.x, 2.6, e.z, Math.sin(a)*spd, vy, Math.cos(a)*spd, 9); }
}
function counselorDefeated(){
  msg('CAREER COUNSELOR DEFEATED!  +200 XP', 3.4, '#3cff8a'); gainXp(200);
  OBJ.phase = 'chapter2done'; saveProgress();
  setTimeout(() => { if (OBJ.phase === 'chapter2done') fadeTo(1, 1.2, () => startScene(chapter2EndScript)); }, 3200);
}
function* chapter2EndScript(){
  IN.skipFn = () => endScene(() => toTitleMenu());
  IN.fade = 1; yield A.wait(0.5);
  yield A.title('END OF CHAPTER 2', 3.0, 'THE TRAIN STATION');
  yield A.title('TO BE CONTINUED...', 3.2, '');
  yield A.run(() => { IN.next = () => toTitleMenu(); });
}
function toTitleMenu(){ IN.on = false; state = 'menu'; pauseFrom = 'play'; menuIdx = 0; setMood(false); FADE.a = 1; fadeTo(0, 0.9); }

/* Continue after dying to the Counselor: straight back into the hall */
function retryBoss(){
  stationReset(); STA.active = true; STA.rush = false; state = 'play'; pauseFrom = 'play'; IN.on = false;
  P.maxHp = 100; applyStats(); resetPlayer(); P.hp = P.maxHp; enterArena(); lockPointer();
}
