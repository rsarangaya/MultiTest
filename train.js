"use strict";
/* ============================================================================
   CHAPTER 2 (part 3)  -  the train.  A side-scrolling brawler (one lane, Street-Fighter-ish) set inside the cars of the Nextown Local.
   Move A/D, jump (SPACE / W), crouch (S / C), 3-hit sword combo (click / J), block (right-click / K - a block in the first 0.2 s is a PARRY),
   dash with i-frames (Q), spin special (E, cooldown).  Three cars; each has scripted waves.  Clear a wave to unlock "GO ->".
   Low-res 480x270 like the iso scenes; the HUD is drawn at display res.  Enemies are the same recruiters, redrawn from the same sprites.
   ============================================================================ */
const TRN = { floorY:236, carW:1300, W:LW };
const TE = { grunt:{ hp:6, spd:62, dmg:10, xp:12 }, runner:{ hp:4, spd:70, dmg:12, xp:16 }, thrower:{ hp:4, spd:46, dmg:8, xp:18 }, inspector:{ hp:16, spd:44, dmg:16, xp:36 } };
const CARS = [
  { name:'CAR 1', waves:[ { x:260, e:['grunt','grunt','grunt'] }, { x:760, e:['grunt','grunt','runner','thrower'] } ] },
  { name:'CAR 2', waves:[ { x:240, e:['grunt','runner','runner','thrower'] }, { x:700, e:['inspector','grunt','grunt'] }, { x:1000, e:['grunt','runner','thrower','thrower'] } ] },
  { name:'CAR 3', waves:[ { x:260, e:['inspector','grunt','runner'] }, { x:720, e:['inspector','inspector','grunt','thrower'] }, { x:1050, e:['inspector','runner','runner','grunt','thrower'] } ] } ];
const TR = { car:0, t:0, cam:0, lockCam:null, waveIdx:0, tp:null, es:[], pr:[], fx:[], nums:[], cof:[], stop:0, shake:0, rumble:0, leaving:false, over:false };
const trSprites = {};
function trSprite(kind, state, frame, white){
  const key = kind+state+frame+(white ? 'w' : ''); if (trSprites[key]) return trSprites[key];
  let c = kind === 'player' ? personCanvas(CHAR, state, false) : outlined(paintEnemyRaw(kind, state, frame));
  if (white){ const w = mkCanvas(c.width, c.height), g = w.getContext('2d'); g.drawImage(c,0,0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0,0,w.width,w.height); c = w; }
  return trSprites[key] = c;
}
function trPlayerNew(x){ return { x, y:0, vy:0, vx:0, face:1, st:'idle', t:0, combo:0, comboT:0, chainT:0, lastIdx:0, idx:0, hit:false, queued:false, inv:0, spinCd:0, dashCd:0, blockT:0, crouch:false, walkT:0, air:false }; }

/* ---------- start / car setup ---------- */
function startTrain(car){
  TR.car = Math.max(0, Math.min(CARS.length-1, car||0)); TR.t = 0; TR.over = false; OBJ.phase = 'train'; STA.active = false; STA.rush = false; PULL.thrown = false; OBJ.lock = 0; G.tumZ = G.tumX = 0;
  for (const e of enemies.slice()) removeEnemy(e); for (const p of projectiles) fx.remove(p.sprite); projectiles.length = 0;
  P.maxHp = 100; applyStats(); if (P.hp <= 0 || P.hp < P.maxHp*0.6) P.hp = Math.max(P.hp, P.maxHp*0.6); if (P.hp > P.maxHp) P.hp = P.maxHp;
  G.boss = null; G.msgs = [];
  trSetupCar(true); IN.on = false; state = 'train'; pauseFrom = 'train'; setMood(false); if (document.exitPointerLock) document.exitPointerLock(); for (const k in keys) keys[k] = false;
  saveProgress(); FADE.a = 1; fadeTo(0, 0.7);
  msg(CARS[TR.car].name + '  -  FIGHT YOUR WAY TO THE FRONT OF THE TRAIN', 3.0, '#ffe14a');
}
function trSetupCar(first){
  TR.tp = trPlayerNew(70); TR.es = []; TR.pr = []; TR.fx = []; TR.nums = []; TR.cof = []; TR.cam = 0; TR.lockCam = null; TR.waveIdx = 0; TR.leaving = false; TR.stop = 0;
  TR.spawned = CARS[TR.car].waves.map(() => false); P.swUsed = false;
}
const trAlive = () => TR.es.filter(e => e.st !== 'dead').length;
const trLocked = () => TR.lockCam !== null;

/* ---------- enemies ---------- */
function trSpawn(kind, x){
  const sp = TE[kind]; TR.es.push({ kind, x, y:0, face: x < TR.tp.x ? 1 : -1, hp:sp.hp, hpMax:sp.hp, st:'walk', t:0, cd:0.6 + Math.random()*0.8, flash:0, hit:false, vx:0, vy:0, air:false, anim:Math.random()*3, fade:1, haste:0 });
}
function trSpawnWave(w){
  const cam = TR.cam; TR.lockCam = cam; let l = 0, r = 0;
  w.e.forEach((k, i) => { const left = (i % 2 === 0) && cam > 60; trSpawn(k, left ? cam - 28 - (l++)*26 : cam + TRN.W + 28 + (r++)*26); });
  msg('HERE THEY COME!', 1.2, '#ff5a4a'); sfx.wave();
}
function trHurtPlayer(dmg, fromX, e, heavy){
  const tp = TR.tp; if (tp.inv > 0 || TR.over || DBG.god) return false;
  const facing = (fromX - tp.x)*tp.face > 0;
  if (tp.st === 'block' && facing && tp.y < 4){
    if (tp.blockT <= 0.22 + 0.06*rank('ironguard')){                                                         // PARRY: stagger the attacker, no damage
      if (e){ e.st = 'stagger'; e.t = 0; e.vx = (e.x - tp.x >= 0 ? 1 : -1)*150; e.flash = 0.1; e.hit = false; }
      TR.stop = 0.09; TR.shake = 0.35; sfx.parry(); trSpark(tp.x + tp.face*16, 48, '#ffe14a', 10); msg('PARRY!', 0.8, '#ffe14a'); G.style = Math.min(100, G.style + 15); P.hp = Math.min(P.maxHp, P.hp + 3); return false;
    }
    dmg *= 0.2 - 0.05*rank('ironguard'); sfx.parry(); tp.vx = -tp.face*60;
  } else { tp.st = 'hurt'; tp.t = 0; tp.vx = -(fromX - tp.x >= 0 ? 1 : -1)*(heavy ? 170 : 110); if (heavy) tp.vy = 150; tp.inv = 0.7; tp.combo = 0; }
  P.hp -= dmg; G.vign = 1; TR.shake = 0.4; sfx.hurt(); trSpark(tp.x, 44, '#ff5a4a', 8); TR.nums.push({ x:tp.x, y:70, v:Math.round(dmg), t:0, c:'#ff5a4a' });
  if (P.hp <= 0 && hasSkill('secondwind') && !P.swUsed){ P.hp = 25; P.swUsed = true; tp.inv = 1.5; msg('SECOND WIND!', 1.6, '#3cff8a'); sfx.parry(); }
  if (P.hp <= 0){ P.hp = 0; TR.over = true; state = 'dead'; deadT = 0; menuIdx = 0; hiredStart(); sfx.die(); }
  return true;
}
function trSpark(x, y, col, n){ for (let i=0;i<n;i++) TR.fx.push({ x, y, vx:(Math.random()-0.5)*220, vy:60+Math.random()*160, t:0, col }); }
function trHitEnemy(e, dmg, knock, heavy){
  const tp = TR.tp, mul = dmgMul()*(1 + Math.min(0.5, tp.combo*0.05))*(tp.y > 8 ? 1.25 : 1) * momentumTrain() * (e.air ? 1.5 : 1);
  dmg *= mul; e.hp -= dmg; e.flash = 0.09; trSpark(e.x, 50, '#efe3cf', 6); TR.nums.push({ x:e.x, y:76, v:Math.round(dmg*10), t:0, c: heavy ? '#ffe14a' : '#efe3cf' });
  tp.combo++; tp.comboT = 2.2; G.style = Math.min(100, G.style + 3); G.combo = tp.combo; G.comboT = 2.2;
  const dir = e.x >= tp.x ? 1 : -1;
  if (e.hp <= 0){ e.st = 'dead'; e.t = 0; e.vx = dir*(knock + 60); G.kills++; gainXp(Math.round(TE[e.kind].xp*(1+styleRank()*0.25))); P.hp = Math.min(P.maxHp, P.hp + 2); if (Math.random() < (e.kind === 'inspector' ? 0.6 : 0.2)) TR.cof.push({ x:e.x, t:0 }); TR.stop = 0.07; TR.shake = 0.4; sfx.hit(); return; }
  if (hasSkill('launcher') && (heavy || e.air)){ e.air = true; e.vy = e.y > 4 ? Math.max(e.vy, 190) : 330; e.vx = dir*(e.y > 4 ? 40 : 90); e.st = 'stagger'; e.t = 0; e.hit = false; if (!tp.air && tp.y <= 0 && !e.wasAir){ e.wasAir = true; msg('LAUNCH!', 0.6, '#ffe14a'); } TR.stop = 0.07; TR.shake = Math.max(TR.shake, 0.3); sfx.hit(); return; }   // LAUNCHER skill: heavy hits send them up; hit them again to juggle
  if (e.kind === 'inspector' && !heavy){ e.vx += dir*30; sfx.hit(); TR.stop = 0.03; return; }                     // elite: light hits do not stagger him
  e.st = 'stagger'; e.t = 0; e.vx = dir*knock; e.hit = false; TR.stop = heavy ? 0.08 : 0.045; TR.shake = Math.max(TR.shake, heavy ? 0.4 : 0.15); sfx.hit();
}
const momentumTrain = () => 1 + 0.15*styleRank();                                                       // S-rank brawlers hit harder
function trUpdateEnemy(e, dt){
  const tp = TR.tp, sp = TE[e.kind], dx = tp.x - e.x, d = Math.abs(dx), dir = dx >= 0 ? 1 : -1;
  e.anim += dt; e.flash = Math.max(0, e.flash - dt); e.cd -= dt; e.t += dt;
  if (e.air && e.st !== 'dead'){ e.vy -= 820*dt; e.y += e.vy*dt; e.x += e.vx*dt; e.vx *= Math.pow(0.3, dt); if (e.y <= 0){ e.y = 0; e.vy = 0; e.air = false; e.wasAir = false; e.st = 'stagger'; e.t = 0; e.vx = 0; trSpark(e.x, 4, '#e8e6e0', 5); } return; }
  if (e.st === 'dead'){ e.x += e.vx*dt; e.vx *= Math.pow(0.02, dt); e.fade = Math.max(0, 1 - e.t/0.7); return; }
  if (e.st === 'stagger'){ e.x += e.vx*dt; e.vx *= Math.pow(0.03, dt); if (e.t >= (e.kind === 'inspector' ? 0.5 : 0.38)){ e.st = 'walk'; e.cd = Math.max(e.cd, 0.4); } return; }
  const spd = sp.spd*(e.haste > 0 ? 1.4 : 1);
  if (e.st === 'walk'){
    e.face = dir;
    if (e.kind === 'grunt'){ if (d > 40) e.x += dir*spd*dt; else if (e.cd <= 0 && tp.y < 20){ e.st = 'windup'; e.t = 0; } }
    else if (e.kind === 'runner'){ if (d > 150) e.x += dir*spd*dt; else if (e.cd <= 0){ e.st = 'windup'; e.t = 0; } else if (d < 60) e.x -= dir*spd*0.6*dt; }
    else if (e.kind === 'thrower'){ if (d < 120) e.x -= dir*spd*dt; else if (d > 230) e.x += dir*spd*dt; if (e.cd <= 0 && d > 90 && d < 280){ e.st = 'windup'; e.t = 0; } }
    else if (e.kind === 'inspector'){ if (d > 52) e.x += dir*spd*dt; else if (e.cd <= 0 && tp.y < 20){ e.st = 'windup'; e.t = 0; } }
  } else if (e.st === 'windup'){
    e.face = dir; const wt = e.kind === 'inspector' ? 0.6 : e.kind === 'thrower' ? 0.5 : e.kind === 'runner' ? 0.35 : 0.42;
    if (e.t >= wt){
      e.t = 0; e.hit = false;
      if (e.kind === 'thrower'){ TR.pr.push({ x:e.x + e.face*14, y:50, vx:e.face*175, dmg:sp.dmg, life:3, mine:false }); sfx.swing(); e.st = 'walk'; e.cd = 2.0 + Math.random()*0.8; }
      else { e.st = 'attack'; e.lf = e.face; sfx.swing(); }
    }
  } else if (e.st === 'attack'){
    const lf = e.lf;
    if (e.kind === 'runner'){
      e.x += lf*270*dt;
      if (!e.hit && Math.abs(tp.x - e.x) < 24 && tp.y < 24){ e.hit = true; trHurtPlayer(sp.dmg, e.x, e, false); }
      if (e.t >= 0.42){ e.st = 'walk'; e.cd = 1.4; }
    } else if (e.kind === 'inspector'){
      e.x += lf*30*dt;
      if (!e.hit && e.t > 0.06){ const rx = (tp.x - e.x)*lf; if (rx > -8 && rx < 74 && tp.y < 26){ e.hit = true; trHurtPlayer(sp.dmg, e.x, e, true); } }
      if (e.t >= 0.36){ e.st = 'walk'; e.cd = 1.5; }
    } else {
      if (!e.hit && e.t > 0.05){ const rx = (tp.x - e.x)*lf; if (rx > -6 && rx < 46 && tp.y < 22){ e.hit = true; trHurtPlayer(sp.dmg, e.x, e, false); } }
      if (e.t >= 0.22){ e.st = 'walk'; e.cd = 0.9 + Math.random()*0.4; }
    }
  }
  if (e.haste > 0) e.haste -= dt;
  for (const o of TR.es) if (o !== e && o.st !== 'dead'){ const gap = e.x - o.x; if (Math.abs(gap) < 18){ e.x += (gap >= 0 ? 1 : -1)*40*dt; } }       // do not stack on each other
  e.x = Math.max(-60, Math.min(TRN.carW + 60, e.x));
}

/* ---------- the player ---------- */
const ATK = [ { dur:0.26, hit:0.09, reach:46, dmg:1.2, knock:70, heavy:false }, { dur:0.26, hit:0.09, reach:48, dmg:1.2, knock:70, heavy:false }, { dur:0.42, hit:0.16, reach:62, dmg:2.4, knock:190, heavy:true } ];
function trUpdatePlayer(dt){
  const tp = TR.tp, L = held('left') || keys.ArrowLeft, R = held('right') || keys.ArrowRight, down = held('back') || held('slide') || keys.ArrowDown;
  const jump = tapped('jump') || tapped('forward') || pressed.ArrowUp, atk = tapped('attack') || pressed.KeyJ, blk = held('block') || keys.KeyK, dash = tapped('dash'), spin = tapped('flip');
  tp.t += dt; tp.chainT = Math.max(0, (tp.chainT||0) - dt); tp.inv = Math.max(0, tp.inv - dt); tp.spinCd = Math.max(0, tp.spinCd - dt); tp.dashCd = Math.max(0, tp.dashCd - dt); tp.comboT -= dt; if (tp.comboT <= 0) tp.combo = 0;
  const ground = tp.y <= 0 && tp.vy <= 0, busy = tp.st === 'atk' || tp.st === 'hurt' || tp.st === 'dash' || tp.st === 'spin';
  /* actions */
  if (tp.st === 'hurt'){ if (tp.t > 0.32) tp.st = 'idle'; }
  else if (tp.st === 'dash'){ tp.x += tp.face*430*dt; if (atk && tp.t > 0.03){ if (hasSkill('dashslash')){ trStartAtk(tp, 0); tp.dashAtk = true; tp.vx = tp.face*300; msg('DASH SLASH!', 0.5, '#ffe14a'); } else if (!tp.lockMsg || TR.t - tp.lockMsg > 1.5){ tp.lockMsg = TR.t; msg('DASH SLASH IS LOCKED  (PAUSE > SKILLS)', 1.2, '#a3aab8'); } } else if (tp.t > 0.17){ tp.st = 'idle'; tp.vx = 0; } }
  else if (tp.st === 'spin'){
    if (!tp.hit && tp.t > 0.14){ tp.hit = true; let n = 0; for (const e of TR.es) if (e.st !== 'dead' && Math.abs(e.x - tp.x) < 72){ trHitEnemy(e, 2.2, 200, true); n++; } for (const p of TR.pr) if (!p.mine && Math.abs(p.x - tp.x) < 72){ p.mine = true; p.vx = -p.vx*1.4; } if (n) TR.stop = 0.08; sfx.swing(); TR.shake = 0.3; }
    if (tp.t > 0.46){ tp.st = 'idle'; }
  }
  else if (tp.st === 'atk'){
    const a0 = tp.air ? { dur:0.3, hit:0.1, reach:44, dmg:1.6, knock:90, heavy:false } : ATK[tp.idx], a = tp.dashAtk ? Object.assign({}, a0, { reach:a0.reach + 24, dmg:a0.dmg + 1.0, knock:a0.knock + 60, heavy:true }) : a0;
    if (tp.dashAtk){ tp.x += tp.vx*dt; tp.vx *= Math.pow(0.02, dt); }
    if (!tp.hit && tp.t >= a.hit){ tp.hit = true; let n = 0; const reach = a.reach;
      for (const e of TR.es) if (e.st !== 'dead'){ const rx = (e.x - tp.x)*tp.face; if (rx > -12 && rx < reach + 12) { trHitEnemy(e, a.dmg, a.knock, a.heavy); n++; } }
      for (const p of TR.pr) if (!p.mine){ const rx = (p.x - tp.x)*tp.face; if (rx > -6 && rx < reach + 14){ p.mine = true; p.vx = -p.vx*1.5; sfx.parry(); msg('DEFLECT!', 0.6, '#8fb4d0'); } }
      if (!n) sfx.swing(); }
    if (atk && tp.t > a.dur*0.4) tp.queued = true;
    if (tp.t >= a.dur){ if (tp.queued && !tp.air && tp.idx < 2){ trStartAtk(tp, tp.idx + 1); } else { tp.st = 'idle'; tp.vx = 0; tp.chainT = 0.4; } }
  }
  if (tp.st === 'idle' || tp.st === 'walk' || tp.st === 'block' || tp.st === 'jump'){
    if (dash && tp.dashCd <= 0 && ground){ tp.st = 'dash'; tp.t = 0; tp.inv = Math.max(tp.inv, 0.22); tp.dashCd = 0.9 - 0.12*rank('footwork'); sfx.dash(); tp.face = L ? -1 : R ? 1 : tp.face; }
    else if (spin && !hasSkill('whirlwind')){ if (!tp.lockMsg || TR.t - tp.lockMsg > 1.5){ tp.lockMsg = TR.t; msg('WHIRLWIND IS LOCKED  (PAUSE > SKILLS)', 1.2, '#a3aab8'); } }
    else if (spin && tp.spinCd <= 0){ tp.st = 'spin'; tp.t = 0; tp.hit = false; tp.spinCd = 3.4; tp.inv = Math.max(tp.inv, 0.4); G.fovPunch = 1; msg('WHIRLWIND!', 0.7, '#ffe14a'); }
    else if (atk){ tp.air = !ground; trStartAtk(tp, !tp.air && tp.chainT > 0 && tp.lastIdx < 2 ? tp.lastIdx + 1 : 0); }
    else if (blk && ground){ if (tp.st !== 'block'){ tp.st = 'block'; tp.blockT = 0; } tp.blockT += dt; tp.vx = 0; }
    else {
      if (tp.st === 'block') tp.st = 'idle';
      tp.crouch = down && ground;
      const mv = tp.crouch ? 0 : (R ? 1 : 0) - (L ? 1 : 0);
      if (mv){ tp.face = mv; tp.x += mv*(ground ? 122 : 100)*dt; tp.walkT += dt; if (ground) tp.st = 'walk'; } else if (ground) tp.st = 'idle';
      if (jump && ground && !tp.crouch){ tp.vy = 345; tp.st = 'jump'; sfx.jump(); }
    }
  }
  /* physics */
  if (tp.st === 'hurt' || tp.st === 'block'){ tp.x += tp.vx*dt; tp.vx *= Math.pow(0.03, dt); }
  tp.vy -= 1050*dt; tp.y += tp.vy*dt; if (tp.y <= 0){ tp.y = 0; tp.vy = 0; if (tp.st === 'jump') tp.st = 'idle'; if (tp.st === 'atk' && tp.air){ tp.air = false; } }
  /* bounds: the car, and the camera lock while a wave is alive */
  let lo = 12, hi = TRN.carW - 12; if (trLocked()){ lo = Math.max(lo, TR.lockCam + 14); hi = Math.min(hi, TR.lockCam + TRN.W - 14); }
  tp.x = Math.max(lo, Math.min(hi, tp.x));
}
function trStartAtk(tp, idx){ tp.dashAtk = false; tp.st = 'atk'; tp.t = 0; tp.hit = false; tp.queued = false; tp.idx = idx; tp.lastIdx = idx; tp.chainT = 0; if (!tp.air) tp.vx = 0; }

/* ---------- main update (fixed sub-steps) ---------- */
function updateTrain(real){
  if (pressed.Escape){ openPause(); return; }
  if (real <= 0) return;
  TR.t += real; TR.rumble -= real; if (TR.rumble <= 0){ TR.rumble = 0.5556; noise(0.07, 0.1, 380); tone('square', 78, 52, 0.08, 0.07); setTimeout(() => { noise(0.06, 0.07, 320); tone('square', 70, 48, 0.07, 0.05); }, 150); }   // clack-clack of the rail joints
  { const tn = trTunnel(TR.t); if (tn > 0.9 && !TR.inTun){ TR.inTun = true; noise(0.6, 0.12, 200); } else if (tn < 0.1) TR.inTun = false; }
  TR.shake = Math.max(0, TR.shake - real*2); TR.stop = Math.max(0, TR.stop - real);
  for (const m of G.msgs) m.t -= real; G.msgs = G.msgs.filter(m => m.t > 0);
  G.style = Math.max(0, G.style - real*2); G.vign = Math.max(0, G.vign - real*1.6);
  if (TR.stop <= 0){
    const steps = Math.max(1, Math.ceil(real/(1/60) - 1e-6)), h = real/steps;
    for (let i=0;i<steps;i++){
      if (TR.over || state !== 'train') break;
      trUpdatePlayer(h); for (const e of TR.es) trUpdateEnemy(e, h);
      for (const p of TR.pr){                                                                              // answer sheets / memos in flight
        p.x += p.vx*h; p.life -= h;
        if (!p.mine){ const tp = TR.tp, top = tp.y + (tp.crouch ? 34 : 66); if (Math.abs(p.x - tp.x) < 11 && p.y >= tp.y && p.y <= top){ p.life = 0; trHurtPlayer(p.dmg, p.x - Math.sign(p.vx)*10, null, false); } }
        else for (const e of TR.es) if (e.st !== 'dead' && Math.abs(p.x - e.x) < 14){ p.life = 0; trHitEnemy(e, 1.5, 80, false); break; }
      }
      TR.pr = TR.pr.filter(p => p.life > 0);
      TR.es = TR.es.filter(e => !(e.st === 'dead' && e.fade <= 0));
      for (const c of TR.cof){ c.t += h; if (Math.abs(c.x - TR.tp.x) < 18 && TR.tp.y < 20 && P.hp < P.maxHp){ c.t = 99; P.hp = Math.min(P.maxHp, P.hp + 15); msg('+15 COFFEE', 0.8, '#3cff8a'); tone('sine', 500, 900, 0.12, 0.12); } }
      TR.cof = TR.cof.filter(c => c.t < 20);
    }
    for (const f of TR.fx){ f.t += real; f.x += f.vx*real; f.y += f.vy*real; f.vy -= 700*real; } TR.fx = TR.fx.filter(f => f.t < 0.5);
    for (const n of TR.nums) n.t += real; TR.nums = TR.nums.filter(n => n.t < 0.9);
  }
  if (TR.over || state !== 'train') return;
  /* camera + waves + the way out */
  const tp = TR.tp, car = CARS[TR.car];
  if (!trLocked()){ const tgt = Math.max(0, Math.min(TRN.carW - TRN.W, tp.x - 210)); TR.cam += (tgt - TR.cam)*Math.min(1, real*6); }
  car.waves.forEach((w, i) => { if (!TR.spawned[i] && tp.x >= w.x && !trLocked()){ TR.spawned[i] = true; trSpawnWave(w); } });
  if (trLocked() && trAlive() === 0){ TR.lockCam = null; const last = TR.spawned.every(Boolean); msg(last ? 'CAR CLEAR!  HEAD FOR THE DOOR  >>' : 'GO!  >>', 1.6, '#3cff8a'); sfx.wave(); }
  const cleared = TR.spawned.every(Boolean) && !trLocked() && trAlive() === 0;
  if (cleared && tp.x > TRN.carW - 40 && !TR.leaving){
    TR.leaving = true; fadeTo(1, 0.6, () => {
      if (TR.car + 1 < CARS.length){ TR.car++; trSetupCar(false); saveProgress(); FADE.a = 1; fadeTo(0, 0.6); msg(CARS[TR.car].name, 2.2, '#ffe14a'); }
      else { OBJ.phase = 'traindone'; saveProgress(); startScene(trainEndScript); }
    });
  }
}
/* Chapter 2 is NOT over: it ends when you are back home. Next: Nextown, mom's order, the way back (not built yet). */
function* trainEndScript(){
  IN.skipFn = () => endScene(() => toTitleMenu());
  IN.fade = 1; yield A.wait(0.5);
  yield A.title('TO BE CONTINUED...', 3.4, 'NEXTOWN AHEAD  -  CHAPTER 2 CONTINUES');
  yield A.run(() => { IN.next = () => toTitleMenu(); });
}

/* ---------- drawing ---------- */
function trCityLayer(g, wx, wy, ww, wh, off, col, minH, varH, per, seed){
  g.fillStyle = col;
  for (let i = Math.floor(off/per) - 1; i < (off + ww)/per + 1; i++){
    const bx = i*per + ((i*i*37 + seed)%13), bh = minH + ((i*53 + seed*7)%varH), bw = per - 8 - ((i*29)%9);
    g.fillRect(wx + bx - off, wy + wh - bh, bw, bh);
  }
}
/* outside the windows: far skyline, mid buildings, then fast telegraph poles + wires + an embankment that smear past; tunnels every ~14 s (dark, with light streaks) */
function trTunnel(t){ const c = (t % 14); return c < 9 ? 0 : c < 9.5 ? (c-9)/0.5 : c < 12.5 ? 1 : c < 13 ? 1 - (c-12.5)/0.5 : 0; }
function trWindow(g, wx, wy, ww, wh, t, wi, tun){
  g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
  const sky = g.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, '#7fb0d6'); sky.addColorStop(1, '#cfe3ef'); g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
  trCityLayer(g, wx, wy, ww, wh, t*55 + wi*61, '#b7c8d8', 26, 26, 46, 3);                                                  // far skyline (slow)
  trCityLayer(g, wx, wy, ww, wh, t*150 + wi*47 + 17, '#8296ae', 18, 34, 36, 7);                                             // mid buildings
  g.fillStyle = '#44543f'; g.fillRect(wx, wy + wh - 16, ww, 16); g.fillStyle = '#5d6f55'; g.fillRect(wx, wy + wh - 16, ww, 3);        // embankment
  for (let j = -1; j < ww/26 + 2; j++){ const dx = wx + j*26 - ((t*760) % 26); g.fillStyle = 'rgba(230,236,220,.55)'; g.fillRect(dx, wy + wh - 9, 14, 2); }   // ballast smearing by
  const per = 150, off = (t*560 + wi*83) % per;                                                                              // telegraph poles: fast + smeared
  for (let i2 = -1; i2 < ww/per + 2; i2++){ const bx = wx + i2*per - off; g.fillStyle = 'rgba(27,31,46,.28)'; g.fillRect(bx + 4, wy, 22, wh); g.fillStyle = '#1b1f2e'; g.fillRect(bx, wy, 4, wh); g.fillRect(bx - 8, wy + 10, 20, 3);
    g.strokeStyle = 'rgba(27,31,46,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx - 8, wy + 11); g.quadraticCurveTo(bx + per/2, wy + 24, bx + per - 8, wy + 11); g.stroke(); }
  if (tun > 0){                                                                                                              // tunnel: black with rushing lights
    g.globalAlpha = Math.min(1, tun*1.2); g.fillStyle = '#12151f'; g.fillRect(wx, wy, ww, wh);
    for (let r = 0; r < 3; r++){ const ly = wy + 12 + r*22, sp = 900 + r*260, lx = wx - ((t*sp + wi*97 + r*40) % 200); for (let k = 0; k < ww/200 + 2; k++){ g.fillStyle = '#ffe9a0'; g.fillRect(lx + k*200, ly, 46, 3); g.fillStyle = 'rgba(255,233,160,.3)'; g.fillRect(lx + k*200 - 30, ly, 100, 3); } }
    g.globalAlpha = 1; }
  g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(wx + 8, wy); g.lineTo(wx + 24, wy); g.lineTo(wx + 6, wy + wh); g.lineTo(wx - 10, wy + wh); g.fill();       // glass glare
  g.restore();
}
function trRound(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x+r, y); g.lineTo(x+w-r, y); g.quadraticCurveTo(x+w, y, x+w, y+r); g.lineTo(x+w, y+h-r); g.quadraticCurveTo(x+w, y+h, x+w-r, y+h); g.lineTo(x+r, y+h); g.quadraticCurveTo(x, y+h, x, y+h-r); g.lineTo(x, y+r); g.quadraticCurveTo(x, y, x+r, y); g.closePath(); }
function drawTrain(g){
  const cam = Math.round(TR.cam + (Math.random()-0.5)*TR.shake*6), fy = TRN.floorY, t = TR.t, tun = trTunnel(t);
  const clack = (t*1.8) % 1, bump = clack < 0.09 ? (1 - clack/0.09)*2.2 : 0, sway = Math.sin(t*1.3)*1.4, sw = Math.round((Math.random()-0.5)*TR.shake*4 + bump);
  g.save(); g.translate(Math.round(sway), sw); g.fillStyle = '#2c3142'; g.fillRect(-10,-10,500,300);
  /* the car: pale interior with a blue + orange stripe, rounded ceiling coves, advert strip above the windows */
  g.fillStyle = '#e9ebec'; g.fillRect(0, 0, TRN.W, fy - 24);
  g.fillStyle = '#d3d8dc'; g.fillRect(0, 0, TRN.W, 30); g.fillStyle = '#c3c9cf'; g.fillRect(0, 26, TRN.W, 6); g.fillStyle = '#aab2ba'; g.fillRect(0, 31, TRN.W, 2);
  for (let lx = -(cam % 150); lx < TRN.W; lx += 150){ g.fillStyle = '#fdfdf6'; g.fillRect(lx + 24, 9, 100, 7); g.fillStyle = tun > 0.2 && Math.floor(t*18 + lx)%7 === 0 ? '#9aa2ac' : '#e6f2ff'; g.fillRect(lx + 26, 11, 96, 3); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(lx + 8, 16, 132, 9); }   // fluorescent strips
  for (let ax = -(cam % 130) + 8; ax < TRN.W + 20; ax += 130){ g.fillStyle = NAVY; g.fillRect(ax - 1, 34, 106, 17); g.fillStyle = ['#ffe14a','#f2b8b0','#bcd6e8','#e0a050'][Math.abs(Math.floor((ax + cam)/130))%4]; g.fillRect(ax, 35, 104, 15); g.fillStyle = NAVY; g.fillRect(ax + 6, 39, 50, 2); g.fillRect(ax + 6, 44, 30, 2); }   // adverts (BizNes jobs, naturally)
  /* windows */
  for (let k = -1; k < 5; k++){
    const wx = Math.round(k*130 - (cam % 130) + 12), wy = 56, ww = 104, wh = 70, wi = Math.floor(cam/130) + k;
    g.fillStyle = '#2f3544'; trRound(g, wx-5, wy-5, ww+10, wh+10, 12); g.fill(); g.fillStyle = '#6f7a8c'; trRound(g, wx-3, wy-3, ww+6, wh+6, 10); g.fill();
    g.save(); trRound(g, wx, wy, ww, wh, 8); g.clip(); trWindow(g, wx, wy, ww, wh, t, wi, tun); g.restore();
    if (wi%3 === 0){ g.fillStyle = '#d9c8a8'; g.fillRect(wx, wy, ww, 20); for (let y2 = wy + 3; y2 < wy + 20; y2 += 4){ g.fillStyle = '#bfa985'; g.fillRect(wx, y2, ww, 1); } g.fillStyle = '#a3926f'; g.fillRect(wx, wy + 19, ww, 2); }   // a blind half down
    g.fillStyle = '#9aa4b2'; g.fillRect(wx + ww/2 - 1, wy - 3, 2, wh + 6); g.fillStyle = '#7d8597'; g.fillRect(wx - 6, wy + wh + 5, ww + 12, 3); g.fillStyle = '#5a6275'; g.fillRect(wx - 6, wy + wh + 8, ww + 12, 1);
  }
  /* continuous blue bench along the wall (seat segments), stanchion poles, grab rail + swaying straps */
  for (let bx = -(cam % 118) - 14; bx < TRN.W + 30; bx += 118){
    g.fillStyle = '#26364f'; g.fillRect(bx + 2, fy - 72, 108, 24); g.fillStyle = '#3a5476'; g.fillRect(bx + 4, fy - 70, 104, 20); g.fillStyle = '#4d6c92'; g.fillRect(bx + 4, fy - 70, 104, 3); g.fillStyle = '#2d4260'; g.fillRect(bx + 56, fy - 68, 1, 16);
    g.fillStyle = NAVY; g.fillRect(bx, fy - 46, 112, 3); g.fillStyle = '#2f4a6b'; g.fillRect(bx + 2, fy - 43, 108, 15); g.fillStyle = '#4d6c92'; g.fillRect(bx + 2, fy - 43, 108, 3); g.fillStyle = '#e07a4a'; g.fillRect(bx + 2, fy - 28, 108, 2); g.fillStyle = '#3f4658'; g.fillRect(bx + 8, fy - 28, 5, 8); g.fillRect(bx + 99, fy - 28, 5, 8);
  }
  g.fillStyle = '#c9cdd6'; g.fillRect(0, 31, TRN.W, 3); g.fillStyle = '#fff'; g.fillRect(0, 31, TRN.W, 1); g.fillStyle = '#7d8597'; g.fillRect(0, 34, TRN.W, 1);               // overhead grab rail
  for (let sx = -(cam % 118) + 40; sx < TRN.W + 30; sx += 118){ const swy = Math.sin(t*2.4 + sx*0.05 + bump)*3 + sway*0.5; g.strokeStyle = '#5a6275'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, 34); g.lineTo(sx + swy, 60); g.stroke(); g.strokeStyle = '#e0a050'; g.lineWidth = 2; g.beginPath(); g.ellipse(sx + swy, 67, 4, 7, 0, 0, 6.3); g.stroke(); }
  for (let px_ = -(cam % 236) + 126; px_ < TRN.W + 10; px_ += 236){ g.fillStyle = NAVY; g.fillRect(px_ - 3, 34, 7, fy - 34); g.fillStyle = '#c9cdd6'; g.fillRect(px_ - 2, 34, 4, fy - 34); g.fillStyle = '#fff'; g.fillRect(px_ - 2, 34, 1, fy - 34); }
  g.fillStyle = '#4d6c92'; g.fillRect(0, fy - 24, TRN.W, 4); g.fillStyle = '#e07a4a'; g.fillRect(0, fy - 20, TRN.W, 2);                                                       // wall base stripes
  /* floor: dark rubber with a moving-train feel (the whole car rocks) */
  g.fillStyle = '#7d8597'; g.fillRect(0, fy - 18, TRN.W, 3); g.fillStyle = '#5a6275'; g.fillRect(0, fy - 15, TRN.W, 300);
  for (let fx_ = -(cam % 40); fx_ < TRN.W; fx_ += 40){ g.fillStyle = '#4b5366'; g.fillRect(fx_, fy - 15, 2, 300); g.fillStyle = '#656d80'; g.fillRect(fx_ + 20, fy - 6, 8, 2); g.fillRect(fx_ + 8, fy + 8, 8, 2); g.fillRect(fx_ + 28, fy + 16, 8, 2); }
  g.fillStyle = '#ffe14a'; g.fillRect(0, fy - 12, TRN.W, 2);
  /* doors at both ends of the car */
  const door = (wx, open, label) => { const sx = wx - cam; if (sx < -60 || sx > TRN.W + 60) return;
    g.fillStyle = NAVY; g.fillRect(sx - 2, 40, 64, fy - 40 + 2); g.fillStyle = '#a3aab8'; g.fillRect(sx, 42, 60, fy - 42); g.fillStyle = open ? '#3cff8a' : '#5a6275'; g.fillRect(sx + 6, 50, 20, 70); g.fillRect(sx + 34, 50, 20, 70); g.fillStyle = open ? '#fdf6e3' : '#8fb4d0'; g.fillRect(sx + 8, 52, 16, 66); g.fillRect(sx + 36, 52, 16, 66);
    g.fillStyle = NAVY; g.fillRect(sx + 29, 42, 2, fy - 42); g.fillStyle = '#ffe14a'; g.font = 'bold 8px "Courier New",monospace'; g.textAlign = 'center'; g.fillText(label, sx + 30, 34); g.textAlign = 'left'; };
  const cleared = TR.spawned && TR.spawned.every(Boolean) && !trLocked() && trAlive() === 0;
  door(-30, false, TR.car > 0 ? CARS[TR.car-1].name : 'STATION'); door(TRN.carW - 30, cleared && Math.floor(t*3)%2 === 0, TR.car + 1 < CARS.length ? CARS[TR.car+1].name : 'FRONT');
  /* people, in depth order of nothing (one lane) */
  for (const c of TR.cof){ const sx = c.x - cam; g.drawImage(trCup(), sx - 6, fy - 22 + Math.sin(t*5)*2, 12, 16); }
  const tp = TR.tp, list = [];
  for (const e of TR.es) list.push({ x:e.x, f:() => trDrawEnemy(g, e, cam) });
  list.push({ x:tp.x, f:() => trDrawPlayer(g, tp, cam) });
  list.sort((a,b) => a.x - b.x).forEach(o => o.f());
  for (const p of TR.pr){ const sx = p.x - cam, sy = fy - p.y; g.save(); g.translate(sx, sy); g.rotate(TR.t*14*Math.sign(p.vx)); g.drawImage(trPaper(p.mine), -6, -6, 12, 12); g.restore(); }
  for (const f of TR.fx){ g.globalAlpha = Math.max(0, 1 - f.t/0.5); g.fillStyle = f.col; g.fillRect(f.x - cam - 1, fy - f.y - 1, 3, 3); } g.globalAlpha = 1;
  if (G.vign > 0){ const gr = g.createRadialGradient(240,135,100,240,135,300); gr.addColorStop(0,'rgba(165,42,63,0)'); gr.addColorStop(1,'rgba(165,42,63,'+Math.min(0.6,G.vign*0.5)+')'); g.fillStyle = gr; g.fillRect(0,0,480,270); }
  if (tun > 0){ g.globalAlpha = 0.32*tun; g.fillStyle = '#10131c'; g.fillRect(-10, -10, 500, 300); g.globalAlpha = 1; if (tun > 0.6 && Math.floor(t*14)%9 === 0){ g.globalAlpha = 0.12; g.fillStyle = '#fff'; g.fillRect(-10, -10, 500, 300); g.globalAlpha = 1; } }
  g.restore();
}
let trCupCv = null, trPaperCv = [null, null];
function trCup(){ if (!trCupCv){ const c = mkCanvas(12,16), g = c.getContext('2d'); px(g,1,3,10,12,NAVY); px(g,2,4,8,10,'#f4f1ea'); px(g,2,7,8,4,'#8f5a3a'); px(g,0,2,12,3,NAVY); px(g,1,2,10,2,'#b5463f'); trCupCv = c; } return trCupCv; }
function trPaper(mine){ const k = mine ? 1 : 0; if (!trPaperCv[k]){ const c = mkCanvas(14,14), g = c.getContext('2d'); px(g,0,0,14,14,NAVY); px(g,1,1,12,12,mine ? '#bcd6e8' : '#e8e6e0'); px(g,3,3,8,2,'#7d8597'); px(g,3,6,8,1,'#7d8597'); px(g,3,9,5,3,'#b5463f'); trPaperCv[k] = c; } return trPaperCv[k]; }
function trDrawEnemy(g, e, cam){
  const st = e.air ? 'hurt' : e.st === 'windup' ? 'windup' : e.st === 'attack' ? 'attack' : e.st === 'stagger' || e.st === 'dead' ? 'hurt' : 'walk', fr = Math.floor(e.anim*5)%2;
  const cv = trSprite(e.kind, st, st === 'walk' ? fr : 0, e.flash > 0), s = e.kind === 'inspector' ? 1.12 : 1.1, w = cv.width*s, h = cv.height*s, sx = e.x - cam, sy = TRN.floorY - e.y;
  g.save(); g.translate(sx, sy); g.globalAlpha = e.st === 'dead' ? e.fade : 1; if (e.face < 0) g.scale(-1, 1); if (e.st === 'dead') g.rotate(0.9*(1-e.fade)*(e.vx >= 0 ? 1 : -1));
  g.imageSmoothingEnabled = false; if (e.haste > 0) g.filter = 'sepia(1) saturate(3)'; g.drawImage(cv, -w/2, -h + 2, w, h); g.restore();
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(sx, TRN.floorY + 1, 13, 3, 0, 0, 6.3); g.fill();
  if (e.st === 'windup'){ g.fillStyle = '#ff5a4a'; g.fillRect(sx - 1, sy - h - 8, 3, 6); g.fillRect(sx - 1, sy - h - 1, 3, 2); }          // "!" telegraph
}
function trDrawPlayer(g, tp, cam){
  const pose = tp.st === 'atk' ? 'reach' : tp.st === 'block' ? 'holdsword' : tp.st === 'spin' ? 'reach' : tp.st === 'jump' || tp.y > 2 ? 'walk0' : tp.crouch ? 'sit' : tp.st === 'walk' || tp.st === 'dash' ? (Math.floor(tp.walkT/0.14)%2 ? 'walk1' : 'walk0') : 'stand';
  const cv = trSprite('player', pose, 0, false), s = 0.98, w = cv.width*s, h = cv.height*s, sx = tp.x - cam, sy = TRN.floorY - tp.y;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(sx, TRN.floorY + 1, 13 - tp.y*0.05, 3, 0, 0, 6.3); g.fill();
  if (tp.st === 'dash') for (let i=1;i<4;i++){ g.save(); g.globalAlpha = 0.25/i; g.translate(sx - tp.face*i*13, sy); if (tp.face < 0) g.scale(-1,1); g.drawImage(cv, -w/2, -h + 2, w, h); g.restore(); }
  g.save(); g.translate(sx, sy); if (tp.face < 0) g.scale(-1, 1); if (tp.st === 'spin'){ g.translate(0, -h/2); g.rotate(tp.t*28); g.translate(0, h/2); }
  g.imageSmoothingEnabled = false; g.globalAlpha = tp.inv > 0 && Math.floor(tp.inv*30)%2 && tp.st !== 'dash' && tp.st !== 'spin' ? 0.45 : 1; g.drawImage(cv, -w/2, -h + 2, w, h);
  if (tp.st === 'hurt'){ g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.5; g.drawImage(trSprite('player', pose, 0, true), -w/2, -h + 2, w, h); }
  g.restore();
  /* the sword + slash arc */
  if (tp.st === 'atk' || tp.st === 'spin'){
    const a = tp.air ? { dur:0.3, hit:0.1, reach:44 } : ATK[tp.idx] || ATK[0], k = Math.min(1, tp.t/(tp.st === 'spin' ? 0.46 : a.dur)), cx = sx + tp.face*(tp.st === 'spin' ? 0 : 14), cy = sy - 42;
    g.save(); g.lineCap = 'round';
    if (tp.st === 'spin'){ g.globalAlpha = 0.7*(1-k); g.strokeStyle = '#fdf6e3'; g.lineWidth = 6; g.beginPath(); g.ellipse(sx, cy, 52*Math.min(1, k*3), 16, 0, 0, 6.3); g.stroke(); }
    else { const R = a.reach + 6, a0 = (tp.idx === 1 ? 1.0 : -1.2) , sweep = (tp.idx === 1 ? -2.2 : 2.2) * Math.min(1, k*1.8), ang0 = tp.face > 0 ? a0 : Math.PI - a0, dirn = tp.face > 0 ? 1 : -1;
      g.globalAlpha = Math.max(0, 1 - k*0.9); g.strokeStyle = '#fdf6e3'; g.lineWidth = tp.idx === 2 ? 7 : 5; g.beginPath(); g.arc(cx - tp.face*6, cy + 6, R*0.8, ang0, ang0 + dirn*sweep, dirn*sweep < 0); g.stroke();
      g.globalAlpha = 1; g.strokeStyle = NAVY; g.lineWidth = 5; const tx = cx + tp.face*(R*0.8)*Math.cos(Math.min(1,k*1.8)*0.8 - 0.6), ty = cy + 4 + Math.sin(k*3 - 1)*14; g.beginPath(); g.moveTo(cx, cy + 6); g.lineTo(tx, ty); g.stroke(); g.strokeStyle = '#e8e6e0'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy + 6); g.lineTo(tx, ty); g.stroke(); }
    g.restore();
  }
  if (tp.st === 'block'){ g.strokeStyle = tp.blockT < 0.22 ? '#ffe14a' : '#8fb4d0'; g.lineWidth = 2; g.globalAlpha = 0.8; g.beginPath(); g.arc(sx + tp.face*14, sy - 36, 22, -1.2, 1.2); g.stroke(); g.globalAlpha = 1; }
}
function drawTrainHUD(){
  const tp = TR.tp; if (!tp) return;
  box(24,22,280,20,'#2e1520'); HR(24,22,280*P.hp/P.maxHp,20,P.hp<30?'#ff5a4a':'#b5463f'); HR(24,22,280*P.hp/P.maxHp,5,'#e07585'); HT('HP '+Math.ceil(P.hp), 30, 38, 15, '#fff');
  box(24,52,280,8,'#1f1018'); HR(24,52,280*Math.min(1,prog.xp/xpNeed(prog.level)),8,'#8fb4d0'); HT('LV '+prog.level, 316, 61, 13, '#8fb4d0');
  HT(CARS[TR.car].name+'  /  '+CARS.length, DW-24, 40, 24, '#ffe14a', 'right'); HT('KILLS '+G.kills, DW-24, 66, 16, '#efe3cf', 'right'); HT('FIGHT TO THE FRONT OF THE TRAIN', DW/2, 70, 13, '#c9cdd6', 'center');
  const alive = trAlive(); if (alive) HT('RECRUITERS '+alive, DW-24, 88, 14, '#8fa66a', 'right');
  if (tp.combo > 1){ HT(tp.combo+' HIT'+(tp.combo > 1 ? 'S' : ''), DW-24, 130, 26, '#ffe14a', 'right'); }
  const sr = styleRank(); if (G.style > 1){ HT('STYLE', DW-24, 158, 13, '#a3aab8', 'right'); HT('DCBAS'[sr], DW-24, 200, 40, ['#a3aab8','#8fb4d0','#3cff8a','#ffe14a','#ff5a4a'][sr], 'right'); }
  if (hasSkill('whirlwind')){ box(24, DH-52, 200, 12, '#2c3142'); HR(24, DH-52, 200*(1 - tp.spinCd/3.4), 12, tp.spinCd <= 0 ? '#ffe14a' : '#5a6275'); HT(tp.spinCd <= 0 ? 'WHIRLWIND READY  ('+codeName(binds.flip)+')' : 'WHIRLWIND...', 24, DH-60, 13, tp.spinCd <= 0 ? '#ffe14a' : '#a3aab8'); }
  HT('A/D move   SPACE/W jump   S crouch   CLICK/J slash x3   RIGHT-CLICK/K block (early = PARRY)   Q dash' + (hasSkill('dashslash') ? ' (+slash = DASH SLASH)' : '') + (hasSkill('whirlwind') ? '   E whirlwind' : '') + (hasSkill('launcher') ? '   3rd hit LAUNCHES' : '') + '   ESC pause', DW/2, DH-12, 12, '#a3aab8', 'center');
  for (const e of TR.es) if (e.st !== 'dead'){ const sx = (e.x - TR.cam)*2, sy = (TRN.floorY - (e.kind === 'inspector' ? 84 : 76))*2; if (sx > 0 && sx < DW){ box(sx-22, sy, 44, 5, '#2e1520'); HR(sx-22, sy, 44*Math.max(0,e.hp/e.hpMax), 5, '#8fa66a'); } }
  for (const n of TR.nums){ dctx.globalAlpha = Math.max(0, 1 - n.t/0.9); HT(String(n.v), (n.x - TR.cam)*2, (TRN.floorY - n.y)*2 - n.t*50, 22, n.c, 'center'); } dctx.globalAlpha = 1;
  const cleared = TR.spawned && TR.spawned.every(Boolean) && !trLocked() && trAlive() === 0;
  if ((cleared || (!trLocked() && trAlive() === 0 && TR.spawned && TR.spawned.some(Boolean))) && Math.floor(TR.t*2)%2) HT('GO  >>', DW-60, DH/2-40, 34, '#3cff8a', 'right');
  G.msgs.forEach((m,i) => { dctx.globalAlpha = Math.min(1, m.t/0.5); HT(m.text, DW/2, 120+i*30, i === G.msgs.length-1 ? 24 : 18, m.color, 'center'); dctx.globalAlpha = 1; });
}
