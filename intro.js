"use strict";
/* ============================================================================
   INTRO  -  isometric pixel cutscene: wake up -> mirror (character creator) ->
   downstairs breakfast with mom (name entry) -> wallet + weapon chest -> out the door.
   Scripted as a generator: each `yield` waits for an action (wait, walk, dialogue, UI...).
   ============================================================================ */
const CHAR_DEFAULT = { name:'KIM', hair:2, hairCol:3, skin:1, face:2, eyes:0, brows:2, mouth:2, facial:0, marks:1, outfit:0, pattern:0, outer:0, outerCol:0, belt:0, gloves:0, bag:1, top:2, topCol:3, bottom:0, botCol:1, acc:2, accCol:0, shoes:2, shoeCol:1, weapon:'sword' };   // blond spikes, red headband, olive hoodie, white hi-tops
const CHAR = Object.assign({}, CHAR_DEFAULT);
const MOM = { hair:6, hairCol:2, skin:0, face:2, eyes:1, brows:0, mouth:2, facial:0, marks:0, top:1, topCol:6, bottom:2, botCol:3, acc:0, accCol:0, shoes:3, shoeCol:1, apron:true };

/* ---------- isometric helpers (tile 36x18 px, wall 72 px) ---------- */
const WALLH = 72;
const P2 = (x,y,z) => [240+(x-y)*18, 92+(x+y)*9-(z||0)];
function poly(g, pts, fill, stroke){
  g.beginPath(); pts.forEach((p,i) => i ? g.lineTo(p[0],p[1]) : g.moveTo(p[0],p[1])); g.closePath();
  if (fill){ g.fillStyle = fill; g.fill(); }
  if (stroke !== false){ g.strokeStyle = stroke || NAVY; g.lineWidth = 1; g.stroke(); }
}
function boxC(g, x,y,z, w,d,h, base, topc){
  poly(g,[P2(x,y,z+h),P2(x+w,y,z+h),P2(x+w,y+d,z+h),P2(x,y+d,z+h)], topc || shade(base,1.12));
  poly(g,[P2(x,y+d,z),P2(x+w,y+d,z),P2(x+w,y+d,z+h),P2(x,y+d,z+h)], base);
  poly(g,[P2(x+w,y,z),P2(x+w,y+d,z),P2(x+w,y+d,z+h),P2(x+w,y,z+h)], shade(base,.74));
}
const wallR = (g,x0,x1,z0,z1,fill,st) => poly(g,[P2(x0,0,z0),P2(x1,0,z0),P2(x1,0,z1),P2(x0,0,z1)], fill, st);   // plane y=0 (back-right wall)
const wallL = (g,y0,y1,z0,z1,fill,st) => poly(g,[P2(0,y0,z0),P2(0,y1,z0),P2(0,y1,z1),P2(0,y0,z1)], fill, st);   // plane x=0 (back-left wall)
function floorTiles(g, c1, c2, line){
  for (let x=0;x<8;x++) for (let y=0;y<6;y++) poly(g,[P2(x,y,0),P2(x+1,y,0),P2(x+1,y+1,0),P2(x,y+1,0)], (x+y)%2 ? c1 : c2, line);
}
function spr(g, cv, x, y, z, scale, flip, alpha){
  const [sx,sy] = P2(x,y,z), w = cv.width*scale, h = cv.height*scale;
  g.save(); g.translate(sx,sy); if (flip) g.scale(-1,1); if (alpha !== undefined) g.globalAlpha = alpha;
  g.imageSmoothingEnabled = true; g.drawImage(cv, -w/2, -h+scale, w, h); g.restore();
}
const ISO_SCALE = 0.6;

/* ---------- intro state ---------- */
const IN = { on:false, gen:null, cur:null, room:'bed', fade:1, fadeColor:'#000', dark:0, dlg:null, pl:null, mom:null, sleep:true, sit:0, food:1, chestOpen:0,
             doorOpen:0, walletOn:true, shake:0, nameMode:false, nameBuf:'', nameDone:false, ui:[], click:false, tvT:0, hubSel:0, hubPick:null, spots:[],
             creator:false, creatorDone:false, crRow:0, weaponUI:false, weaponPick:null, itemFly:null, flash:0,
             walletTaken:false, weaponTaken:false, card:null, t:0, zz:0 };
function mkActor(opts){ return Object.assign({ x:0,y:0,z:0, face:'dr', pose:'stand', vis:true, walkT:0 }, opts); }

/* ---------- actions (what a script line can wait for) ---------- */
const adv = () => IN.click || pressed.Enter || pressed.Space;
/* height of the ground under an actor: kitchen stair treads and the bedroom stairwell steps, so walkers step - never sink or clip */
function groundZ(x, y){
  if (IN.room === 'kitchen' && x < 1.5 && y < 4.05) return 9*(Math.max(0, Math.min(5, Math.floor((4.05-y)/0.5)))+1);
  if (IN.room === 'bed' && x > 6.2 && x < 7.8 && y > 3.8 && y < 5.4) return -5*(Math.min(4, Math.floor((x-6.2)/0.32))+1);
  return 0;
}
const A = {
  wait: s => ({ t:0, update(dt){ return (this.t += dt) >= s; } }),
  fade: (to, sec, col) => ({ update(dt){
    if (col) IN.fadeColor = col; const d = dt/Math.max(0.01,sec);
    IN.fade = IN.fade < to ? Math.min(to, IN.fade+d) : Math.max(to, IN.fade-d); return IN.fade === to; } }),
  run: fn => ({ update(){ fn(); return true; } }),
  tween: (obj, key, to, sec) => ({ t:0, from:null, update(dt){ if (this.from === null) this.from = obj[key]; this.t += dt; const k = Math.min(1, this.t/sec); obj[key] = this.from + (to-this.from)*k; return k >= 1; } }),
  say: (who, text, o) => ({ init:false, update(dt){
    if (!this.init){ this.init = true; IN.dlg = { who, text:String(text).replace('{NAME}', CHAR.name), shown:0, shout:!!(o && o.shout) }; if (o && o.shout){ IN.shake = 0.6; sfx.hurt(); } }
    const d = IN.dlg; d.shown = Math.min(d.text.length, d.shown + dt*(d.shout ? 30 : 42));
    if (Math.floor(d.shown) % 3 === 0 && d.shown < d.text.length && Math.random() < 0.3) tone('square', 300+Math.random()*80, 280, 0.03, 0.05);
    if (keys.KeyF && d.shown >= d.text.length){ this.ff = (this.ff||0) + dt; if (this.ff > 0.6){ IN.dlg = null; return true; } }
    if (adv()){ if (d.shown < d.text.length) d.shown = d.text.length; else { IN.dlg = null; return true; } }
    return false; } }),
  walk: (a, pts, speed, endFace) => ({ i:0, update(dt){
    const t = pts[this.i], dx = t[0]-a.x, dy = t[1]-a.y, dist = Math.hypot(dx,dy), step = (speed||2.1)*dt;
    if (dist < 0.04){
      a.x = t[0]; a.y = t[1]; a.z = groundZ(a.x,a.y); this.i++;
      if (this.i >= pts.length){ a.pose = 'stand'; if (endFace) a.face = endFace; return true; } return false;
    }
    const k = Math.min(1, step/dist); a.x += dx*k; a.y += dy*k; a.z += (groundZ(a.x,a.y)-a.z)*Math.min(1, dt*20);   // step up/down onto each tread
    if (Math.abs(dx) > Math.abs(dy)) a.face = dx > 0 ? 'dr' : 'ul'; else a.face = dy > 0 ? 'dl' : 'ur';
    a.walkT += dt; a.pose = Math.floor(a.walkT/0.16)%2 ? 'walk1' : 'walk0'; return false; } }),
  pose: (a, pose, sec) => ({ t:0, update(dt){ a.pose = pose; return (this.t += dt) >= sec; } }),
  eat: (a, sec) => ({ t:0, update(dt){ this.t += dt; a.pose = Math.floor(this.t/0.45)%2 ? 'eat1' : 'eat0'; IN.food = Math.max(0, 1-this.t/sec);
    if (Math.floor(this.t/0.45) !== Math.floor((this.t-dt)/0.45)) tone('square', 180, 120, 0.05, 0.08); return this.t >= sec; } }),
  until: fn => ({ update(dt){ return fn(dt); } }),
  title: (txt, sec, sub) => ({ t:0, update(dt){ IN.title = txt; IN.titleSub = sub || ''; IN.titleA = Math.min(1, this.t/0.6, (sec-this.t)/0.6 + 0.0001); this.t += dt; if (this.t >= sec){ IN.title = null; return true; } return false; } }),
  free: () => ({ update(dt){ return freeStep(dt); } }),     // player-controlled walking in the iso rooms (see freeStep)
};

/* ============================ the script ============================ */
function* introScript(){
  const pl = IN.pl, mom = IN.mom;
  IN.room = 'bed'; IN.sleep = true; IN.fade = 1; IN.dark = 0.55; pl.vis = false; mom.vis = false;
  yield A.wait(0.8);
  yield A.fade(0, 1.8);
  for (let i=0;i<3;i++){ yield A.run(() => tone('square', 880, 880, 0.12, 0.12)); yield A.wait(0.28); }
  yield A.say('', '...mmnh. five more minutes...');
  yield A.run(() => { IN.sleep = false; IN.sit = 1; });
  yield A.tween(IN, 'dark', 0, 1.2);
  yield A.say('', "...Okay. Up. I should at least look human before going downstairs.");
  yield A.run(() => { IN.sit = 0; pl.vis = true; pl.x = 3.1; pl.y = 2.35; pl.face = 'dl'; pl.pose = 'stand'; });
  yield A.walk(pl, [[1.6,3.8],[0.95,3.8]], 2.0, 'ul');
  yield A.wait(0.4);
  yield A.run(() => { IN.creator = true; IN.creatorDone = false; });
  yield A.until(() => IN.creatorDone);
  yield A.say('YOU', '...Good enough. Let us see what is for breakfast.');
  yield A.walk(pl, [[3.2,4.6],[6.0,4.6]], 2.2);
  yield A.walk(pl, [[7.65,4.6]], 1.4);                    // down the stairwell steps
  yield A.fade(1, 0.5);
  yield A.run(() => { IN.room = 'kitchen'; pl.x = 0.75; pl.y = 1.1; pl.z = 54; mom.vis = true; mom.x = 5.3; mom.y = 3.2; mom.face = 'dl'; mom.pose = 'sit'; });
  yield A.fade(0, 0.6);
  yield A.walk(pl, [[0.75,1.1],[0.75,1.6],[0.75,2.1],[0.75,2.6],[0.75,3.1],[0.75,3.6],[0.75,4.2],[1.5,4.4],[1.9,3.2]], 2.0);
  yield A.walk(pl, [[2.35,3.2,0]], 1.6, 'dr');
  yield A.run(() => { pl.pose = 'sit'; pl.face = 'dr'; });
  yield A.wait(0.5);
  yield A.say('MOM', 'Morning, nerd.');
  yield A.say('YOU', "...It is not 'nerd'. My name is...");
  yield A.run(() => { IN.nameMode = true; IN.nameDone = false; IN.nameBuf = ''; });
  yield A.until(() => IN.nameDone);
  yield A.run(() => { IN.nameMode = false; CHAR.name = (IN.nameBuf.trim() || 'KIM').slice(0,12); });
  yield A.say('YOU', 'My name is {NAME}.');
  yield A.say('MOM', 'Yea yea, whatever.');
  yield A.say('MOM', 'When you are done eating, go get some milk from the store.');
  yield A.say('YOU', '...Fine.');
  yield A.say('TV', 'BREAKING: BizNes Corp, the interstellar conglomerate, has completed its acquisition of the planet. Citizens are asked to remain productive.');
  yield A.say('MOM', 'Third buyout this week. Eat your eggs.');
  yield A.eat(pl, 4.2);
  yield A.pose(pl, 'sit', 0.4);
  yield A.run(() => { pl.pose = 'stand'; pl.x = 2.3; pl.y = 2.6; pl.face = 'ur'; });
  yield A.walk(pl, [[2.3,1.8],[4.6,1.8]], 2.3);
  yield A.say('MOM', "HEY! DON'T FORGET YOUR WALLET! AND YOUR WEAPON!", { shout:true });
  yield A.say('YOU', 'My... weapon?');
  yield A.say('MOM', 'Chest by the door. It is dangerous out there. Suits everywhere.');
  yield A.walk(pl, [[5.85,1.6]], 2.0, 'ur');
  /* player-driven part: wallet, chest, door */
  IN.hubSel = 0;
  while (true){
    yield A.until(() => { IN.hubPick = null; return true; });
    yield { update(){ return IN.hubPick !== null; }, hub:true };
    const id = IN.hubPick;
    if (id === 'wallet'){
      if (IN.walletTaken){ yield A.say('YOU', 'Already got it.'); continue; }
      yield A.walk(pl, [[4.45,1.35]], 2.2, 'ul');
      yield A.pose(pl, 'reach', 0.5);
      yield A.run(() => { IN.walletOn = false; IN.itemFly = { type:'wallet', t:0, dur:0.7 }; sfx.jump(); });
      yield A.wait(0.75);
      yield A.run(() => { IN.walletTaken = true; IN.itemFly = null; pl.pose = 'stand'; });
      yield A.say('YOU', 'Wallet. Check.');
    } else if (id === 'chest'){
      if (IN.weaponTaken){ yield A.say('YOU', 'Empty now.'); continue; }
      yield A.walk(pl, [[7.2,1.35]], 2.2, 'ul');
      yield A.pose(pl, 'reach', 0.4);
      yield A.tween(IN, 'chestOpen', 1, 0.7);
      yield A.run(() => { IN.weaponUI = true; IN.weaponPick = null; });
      yield A.until(() => IN.weaponPick !== null);
      yield A.run(() => { IN.weaponUI = false; CHAR.weapon = IN.weaponPick; IN.itemFly = { type:'sword', t:0, dur:0.8 }; tone('sine', 400, 900, 0.5, 0.14); });
      yield A.pose(pl, 'reach', 0.8);
      yield A.run(() => { IN.itemFly = null; IN.flash = 1; sfx.parry(); IN.weaponTaken = true; });
      yield A.pose(pl, 'holdsword', 1.8);
      yield A.run(() => { pl.pose = 'stand'; });
      yield A.say('YOU', 'A sword. Sure. Why not.');
      yield A.say('MOM', "That's my kid. Get the 2%, not the soy! And do NOT talk to any suits.");
    } else {
      if (!IN.walletTaken || !IN.weaponTaken){ yield A.say('MOM', 'WALLET! WEAPON! BOTH! GO!', { shout:true }); continue; }
      yield A.walk(pl, [[5.85,1.2]], 2.0, 'ur');
      yield A.run(() => tone('square', 140, 90, 0.25, 0.14));
      yield A.tween(IN, 'doorOpen', 1, 0.9);
      yield A.say('YOU', 'Right. Milk. How bad can it be?');
      yield A.run(() => { pl.face = 'ur'; });
      yield A.fade(1, 0.9, '#fdf6e3');
      break;
    }
  }
  yield A.run(() => finishIntro());
}

/* ============================ later chapters: scenes run on the same iso engine ============================ */
/* startScene(genFn): run a script generator in the iso rooms (same renderer as the intro). A script ends by setting IN.next (what to start afterwards). */
function startScene(genFn){
  Object.assign(IN, { on:true, fade:1, fadeColor:'#000', dark:0, dlg:null, sleep:false, sit:0, food:0, chestOpen:0, doorOpen:0, walletOn:true, shake:0, nameMode:false, creator:false,
                      creatorDone:true, weaponUI:false, itemFly:null, flash:0, walletTaken:false, weaponTaken:false, card:null, t:0, hubSel:0, click:false, room:'kitchen', milkOn:false,
                      title:null, freeOn:false, freePick:null, freeLabel:null, orderAsked:false, objective:'', skipFn:null, next:null });
  IN.pl = mkActor({ x:5.85, y:0.9, face:'dl' }); IN.mom = mkActor({ x:5.3, y:3.2, face:'dl', pose:'sit', vis:false });
  IN.gen = genFn(); IN.cur = IN.gen.next().value;
  state = 'intro'; setMood(false); for (const k in keys) keys[k] = false; if (document.exitPointerLock) document.exitPointerLock();
}
function endScene(nextFn){ IN.dlg = null; IN.freeOn = false; IN.nameMode = false; IN.gen = (function*(){})(); IN.cur = null; IN.next = nextFn; }   // used by scripts' last step and by ESC (skip)

/* free roam: furniture rectangles [x0,y0,x1,y1] the player cannot walk through */
const SCENE_ROOMS = {
  kitchen:{ x0:0.5, x1:7.5, y0:0.35, y1:5.65, blocks:[[1.15,0,2.85,0.95],[2.85,0,3.75,0.95],[4.05,0,4.85,0.8],[6.7,0.05,7.8,1.05],[2.75,2.5,4.9,3.9],[1.9,2.85,2.65,3.6],[4.9,2.85,5.65,3.6]] },
  bed:{ x0:0.5, x1:7.7, y0:0.35, y1:5.65, blocks:[[1.6,0,4.9,2.2],[0,4.7,1.2,6],[6.15,3.7,7.9,3.95],[6.15,5.25,7.9,5.5]] } };
function sceneBlocked(x, y){
  const R = SCENE_ROOMS[IN.room], r = 0.2;
  if (x < R.x0 || x > R.x1 || y < R.y0 || y > R.y1) return true;
  for (const b of R.blocks) if (x+r > b[0] && x-r < b[2] && y+r > b[1] && y-r < b[3]) return true;
  return false;
}
function freeSpots(){
  if (IN.room !== 'kitchen') return [];
  return [ { id:'mom', x:5.3, y:2.2, r:1.6, label:'TALK TO MOM' },
           { id:'wallet', x:4.45, y:1.05, r:1.0, label:IN.walletTaken ? null : 'GRAB WALLET' },
           { id:'chest', x:7.25, y:1.45, r:1.1, label:IN.weaponTaken ? null : 'TAKE YOUR SWORD' },
           { id:'door', x:5.85, y:0.7, r:1.0, label:'GO OUT' } ];
}
function freeStep(dt){
  const pl = IN.pl; IN.freeOn = true;
  const f = (keys.KeyW||keys.ArrowUp ? 1 : 0) - (keys.KeyS||keys.ArrowDown ? 1 : 0), sd = (keys.KeyD||keys.ArrowRight ? 1 : 0) - (keys.KeyA||keys.ArrowLeft ? 1 : 0);
  let mx = -f + sd, my = -f - sd; const l = Math.hypot(mx, my);
  if (l > 0){
    mx /= l; my /= l; const sp = 2.4*dt, nx = pl.x + mx*sp, ny = pl.y + my*sp;
    if (!sceneBlocked(nx, pl.y)) pl.x = nx; if (!sceneBlocked(pl.x, ny)) pl.y = ny;
    pl.face = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'dr' : 'ul') : (my > 0 ? 'dl' : 'ur'); pl.walkT += dt; pl.pose = Math.floor(pl.walkT/0.16)%2 ? 'walk1' : 'walk0';
  } else pl.pose = 'stand';
  pl.z += (groundZ(pl.x, pl.y) - pl.z)*Math.min(1, dt*20);
  if (IN.room === 'bed' && pl.x > 7.45 && pl.y > 3.9 && pl.y < 5.3){ IN.freePick = 'down'; IN.freeOn = false; return true; }          // down the stairwell
  if (IN.room === 'kitchen' && pl.x < 1.5 && pl.y < 0.95){ IN.freePick = 'up'; IN.freeOn = false; return true; }                         // up the stairs
  let best = null, bd = 9; IN.freeLabel = null;
  for (const sp of freeSpots()){ const d = Math.hypot(pl.x-sp.x, pl.y-sp.y); if (sp.label && d < sp.r && d < bd){ best = sp; bd = d; } }
  if (best) IN.freeLabel = best.label;
  if (best && (pressed.KeyE || pressed.Enter || pressed.Space || IN.click)){ IN.freePick = best.id; IN.freeOn = false; return true; }
  return false;
}
const goUpstairs = pl => [ A.walk(pl, [[6.0,2.2],[6.0,4.4],[1.5,4.4],[0.75,4.2],[0.75,3.6],[0.75,3.1],[0.75,2.6],[0.75,2.1],[0.75,1.6],[0.75,1.1]], 2.1) ];

/* ---- CHAPTER 1 finale: you get home ---- */
function* homecomingScript(){
  const pl = IN.pl, mom = IN.mom;
  IN.room = 'kitchen'; IN.walletOn = false; IN.chestOpen = 1; IN.food = 0; IN.milkOn = false; IN.fadeColor = '#fdf6e3'; IN.fade = 1;
  mom.vis = true; mom.x = 5.3; mom.y = 3.2; mom.face = 'dl'; mom.pose = 'sit'; pl.x = 5.85; pl.y = 0.9; pl.z = 0; pl.face = 'dl'; pl.pose = 'stand';
  IN.skipFn = () => endScene(() => startNextDay());
  yield A.wait(0.3);
  yield A.fade(0, 0.9);
  yield A.run(() => tone('square', 140, 90, 0.25, 0.14));
  yield A.walk(pl, [[5.85,2.0],[5.3,2.0]], 2.0, 'dl');
  yield A.wait(0.4);
  yield A.say('MOM', 'You took forever. Did you get the milk?');
  yield A.say('YOU', 'Yep.');
  yield A.run(() => { IN.milkOn = true; tone('triangle', 300, 200, 0.12, 0.12); });
  yield A.wait(0.5);
  yield A.say('YOU', "...I'm okay, by the way. Just almost got recruited.");
  yield A.wait(0.4);
  yield A.say('MOM', 'Quit being a baby. You lived.');
  yield A.wait(0.5);
  yield* goUpstairs(pl);
  yield A.fade(1, 0.6, '#000');
  yield A.run(() => { IN.room = 'bed'; pl.x = 7.65; pl.y = 4.6; pl.z = -25; mom.vis = false; });
  yield A.fade(0, 0.5);
  yield A.walk(pl, [[6.0,4.6],[5.3,4.6],[5.3,2.8],[3.3,2.8]], 2.0, 'ur');
  yield A.wait(0.3);
  yield A.run(() => { pl.vis = false; IN.sit = 1; });
  yield A.say('', '...What a day.');
  yield A.run(() => { IN.sit = 0; IN.sleep = true; });
  yield A.tween(IN, 'dark', 0.6, 2.0);
  yield A.wait(1.2);
  yield A.fade(1, 1.2, '#000');
  yield A.title('END OF CHAPTER 1', 2.6, 'THE MILK RUN');
  yield A.title('CHAPTER 2', 2.8, 'THE NEXT DAY');
  yield A.run(() => { IN.next = () => startNextDay(); });
}

/* ---- CHAPTER 2 opener: wake up, no mirror, walk around, talk to mom, wallet + sword, out the door ---- */
function startNextDay(){ OBJ.phase = 'nextday'; saveProgress(); startScene(nextDayScript); }
function* nextDayScript(){
  const pl = IN.pl, mom = IN.mom;
  IN.room = 'bed'; IN.sleep = true; IN.dark = 0.5; pl.vis = false; mom.vis = false; IN.walletOn = true; IN.chestOpen = 0; IN.milkOn = false; IN.food = 0.6;
  IN.skipFn = () => endScene(() => beginStation());
  yield A.wait(0.6);
  yield A.fade(0, 1.6);
  for (let i=0;i<2;i++){ yield A.run(() => tone('square', 880, 880, 0.12, 0.12)); yield A.wait(0.28); }
  yield A.say('', '...Morning already.');
  yield A.run(() => { IN.sleep = false; IN.sit = 1; });
  yield A.tween(IN, 'dark', 0, 1.0);
  yield A.say('', '...Mom will be downstairs.');
  yield A.run(() => { IN.sit = 0; pl.vis = true; pl.x = 3.1; pl.y = 2.55; pl.face = 'dl'; pl.pose = 'stand'; });
  IN.objective = 'GO DOWNSTAIRS AND TALK TO MOM';
  while (true){
    IN.freePick = null;
    yield A.free();
    const id = IN.freePick;
    if (id === 'down'){
      yield A.fade(1, 0.35); yield A.run(() => { IN.room = 'kitchen'; pl.x = 0.75; pl.y = 1.15; pl.z = 54; mom.vis = true; mom.x = 5.3; mom.y = 3.2; mom.pose = 'sit'; mom.face = 'dl'; pl.face = 'dl'; }); yield A.fade(0, 0.35);
    } else if (id === 'up'){
      yield A.fade(1, 0.35); yield A.run(() => { IN.room = 'bed'; pl.x = 7.4; pl.y = 4.6; pl.z = -25; pl.face = 'ul'; }); yield A.fade(0, 0.35);
    } else if (id === 'mom'){
      yield A.run(() => { pl.face = 'dr'; });
      if (!IN.orderAsked){
        yield A.say('MOM', "Oh good, you're up. Since you're going out anyway...");
        yield A.say('MOM', "My order came in at the pickup counter in the next town. You'll have to take the train.");
        yield A.say('YOU', '...The train station. That is suit central.');
        yield A.say('MOM', 'Then do not talk to them. Take your wallet. And your sword.');
        yield A.run(() => { IN.orderAsked = true; IN.objective = 'GRAB YOUR WALLET AND SWORD, THEN HEAD OUT THE DOOR'; });
      } else yield A.say('MOM', 'Wallet. Sword. Train station. My order. Go.');
    } else if (id === 'wallet'){
      yield A.run(() => { pl.face = 'ul'; }); yield A.pose(pl, 'reach', 0.5);
      yield A.run(() => { IN.walletOn = false; IN.itemFly = { type:'wallet', t:0, dur:0.7 }; sfx.jump(); }); yield A.wait(0.75);
      yield A.run(() => { IN.walletTaken = true; IN.itemFly = null; pl.pose = 'stand'; });
      yield A.say('YOU', 'Wallet. Check.');
    } else if (id === 'chest'){
      yield A.run(() => { pl.face = 'ul'; }); yield A.pose(pl, 'reach', 0.4);
      yield A.tween(IN, 'chestOpen', 1, 0.7);
      yield A.run(() => { IN.itemFly = { type:'sword', t:0, dur:0.8 }; tone('sine', 400, 900, 0.5, 0.14); });
      yield A.pose(pl, 'reach', 0.8);
      yield A.run(() => { IN.itemFly = null; IN.flash = 1; sfx.parry(); IN.weaponTaken = true; });
      yield A.pose(pl, 'holdsword', 1.6);
      yield A.run(() => { pl.pose = 'stand'; });
      yield A.say('YOU', 'Back in my hand. Let us hope I do not need it.');
    } else if (id === 'door'){
      if (!IN.orderAsked){ yield A.say('MOM', 'Talk to me first, nerd.'); continue; }
      if (!IN.walletTaken || !IN.weaponTaken){ yield A.say('MOM', 'WALLET! SWORD! BOTH! GO!', { shout:true }); continue; }
      yield A.run(() => { pl.face = 'ur'; tone('square', 140, 90, 0.25, 0.14); });
      yield A.tween(IN, 'doorOpen', 1, 0.9);
      yield A.say('YOU', 'Train station. Mom, my order, and no suits. Easy.');
      yield A.fade(1, 0.9, '#fdf6e3');
      break;
    }
  }
  yield A.run(() => { IN.freeOn = false; IN.next = () => beginStation(); });
}

/* ============================ control ============================ */
function startIntro(){
  Object.assign(CHAR, CHAR_DEFAULT);
  Object.assign(IN, { on:true, fade:1, fadeColor:'#000', dark:0, dlg:null, sleep:true, sit:0, food:1, chestOpen:0, doorOpen:0, walletOn:true, shake:0, nameMode:false,
                      nameBuf:'', creator:false, weaponUI:false, itemFly:null, flash:0, walletTaken:false, weaponTaken:false, card:null, t:0, crRow:0, hubSel:0, click:false, room:'bed' });
  IN.pl = mkActor({ x:2.8, y:2.8, face:'dl' }); IN.mom = mkActor({ x:5.3, y:3.2, face:'dl', pose:'sit', vis:false });
  IN.gen = introScript(); IN.cur = IN.gen.next().value;
  IN.card = { page:0, t:0 }; panelCanvas(0);
  state = 'card'; setMood(false); for (const k in keys) keys[k] = false;
}
function finishIntro(){
  saveChar(); IN.on = false; IN.card = null;
  if (IS_TOUCH){ state = 'menu'; menuIdx = 0; FADE.a = 1; fadeTo(0, 0.9); return; }      // phones: the street has no touch controls yet, so the intro ends back at the title
  beginGame(null);
}          // out the door -> the street (game.js plays the arrival shot)
function skipIntro(){ IN.dlg = null; IN.creator = false; IN.weaponUI = false; IN.nameMode = false; CHAR.weapon = 'sword'; finishIntro(); }
function saveChar(){ try { localStorage.setItem('deadend_char', JSON.stringify(CHAR)); } catch(e){} }
function loadChar(){ try { const c = JSON.parse(localStorage.getItem('deadend_char')); if (c) Object.assign(CHAR, CHAR_DEFAULT, c); } catch(e){} }   // defaults first, so older saves get the newer fields
loadChar();

/* outfit presets: one click dresses the whole body; the rows below still fine-tune each piece */
const OUTFITS = [
  { name:'STREET',   top:2, topCol:3, bottom:0, botCol:1, shoes:2, shoeCol:1, pattern:0, outer:0, outerCol:0, belt:0, gloves:0, bag:1 },
  { name:'OFFICE',   top:3, topCol:0, bottom:2, botCol:3, shoes:1, shoeCol:2, pattern:0, outer:2, outerCol:1, belt:1, gloves:0, bag:2 },
  { name:'ATHLETIC', top:1, topCol:2, bottom:1, botCol:1, shoes:0, shoeCol:1, pattern:3, outer:0, outerCol:0, belt:0, gloves:0, bag:1 },
  { name:'PUNK',     top:1, topCol:1, bottom:0, botCol:1, shoes:1, shoeCol:0, pattern:2, outer:1, outerCol:2, belt:2, gloves:1, bag:0 },
  { name:'COZY',     top:2, topCol:6, bottom:2, botCol:2, shoes:3, shoeCol:1, pattern:1, outer:0, outerCol:0, belt:0, gloves:0, bag:0 },
  { name:'RETRO',    top:1, topCol:0, bottom:0, botCol:0, shoes:0, shoeCol:0, pattern:0, outer:3, outerCol:3, belt:1, gloves:0, bag:0 } ];
const OUTFIT_FIELDS = ['top','topCol','pattern','outer','outerCol','bottom','botCol','belt','shoes','shoeCol','gloves','bag'];
const CR_PAGES = [
  { name:'HEAD', rows:[ ['HAIR STYLE','hair',['MESSY','SHORT','SPIKY','LONG','BUZZ','BANGS']], ['HAIR COLOR','hairCol',HAIR_C], ['SKIN','skin',SKIN_C],
      ['EYES','face',['WIDE','SLEEPY','SHARP','HAPPY']], ['EYE COLOR','eyes',EYE_C], ['BROWS','brows',['STRAIGHT','THICK','ANGRY','ARCHED']],
      ['MOUTH','mouth',['SMILE','NEUTRAL','SMIRK','OPEN']], ['FACIAL HAIR','facial',['NONE','STUBBLE','MUSTACHE','GOATEE']], ['MARKS','marks',['NONE','FRECKLES','SCAR','BLUSH']],
      ['ACCESSORY','acc',['NONE','GLASSES','HEADBAND','CAP','EARRING','SCARF']], ['ACC COLOR','accCol',ACC_C] ] },
  { name:'OUTFIT', rows:[ ['OUTFIT','outfit',OUTFITS.map(o => o.name)], ['TOP','top',['GRAPHIC TEE','PLAIN TEE','HOODIE','SHIRT & TIE','JACKET']], ['TOP COLOR','topCol',TOP_C], ['PATTERN','pattern',['NONE','STRIPES','PLAID','LOGO']],
      ['OUTERWEAR','outer',['NONE','DENIM JACKET','TRENCH COAT','VARSITY']], ['OUTER COLOR','outerCol',OUTER_C], ['BOTTOM','bottom',['JEANS','SHORTS','SLACKS']],
      ['BOTTOM COLOR','botCol',BOT_C], ['BELT','belt',['NONE','LEATHER','STUDDED']], ['SHOES','shoes',['SNEAKERS','BOOTS','HI-TOPS','SLIDES']], ['SHOE COLOR','shoeCol',SHOE_C],
      ['GLOVES','gloves',['NONE','FINGERLESS','LEATHER']], ['BAG','bag',['NONE','BACKPACK','MESSENGER']] ] } ];
const crRows = () => CR_PAGES[IN.crTab||0].rows;
function crChange(row, d){
  const k = crRows()[row][1];
  if (k === 'outfit'){ CHAR.outfit = ((CHAR.outfit||0)+d+OUTFITS.length)%OUTFITS.length; const o = OUTFITS[CHAR.outfit]; for (const f of OUTFIT_FIELDS) CHAR[f] = o[f]; }
  else { const n = PERSON_COUNTS[k]; CHAR[k] = (CHAR[k]+d+n)%n; } tone('square', 520+row*14, 520+row*14, 0.04, 0.08); }
function crTab(t){ IN.crTab = t; IN.crRow = 0; tone('square', 380, 380, 0.05, 0.08); }
const crStep = () => crRows().length > 11 ? 28 : 31;
function crRandom(){ for (const k in PERSON_COUNTS) CHAR[k] = Math.floor(Math.random()*PERSON_COUNTS[k]); }

function introUpdate(dt){
  IN.t += dt; IN.tvT += dt; IN.shake = Math.max(0, IN.shake-dt); IN.flash = Math.max(0, IN.flash-dt*1.5); IN.zz += dt;
  if (!IN.cur && IN.next){ const f = IN.next; IN.next = null; IN.on = false; f(); return; }          // a later-chapter scene finished: start whatever comes next
  if (state === 'card'){
    const c = IN.card, allIn = 0.35 + (PANELS[c.page].caps.length-1)*CAP_GAP; c.t += dt;
    if (c.t > 0.5 && c.page+1 < PANELS.length && !panelCache[c.page+1]) panelCanvas(c.page+1);   // paint the next still while you read this one
    if (c.t > 0.3 && (IN.click || pressed.Enter || pressed.Space)){
      if (c.t < allIn) c.t = allIn;                                       // first click shows every caption
      else if (c.page+1 < PANELS.length){ c.page++; c.t = 0; tone('triangle', 150, 90, 0.18, 0.12); }
      else { state = 'intro'; IN.card = null; }                           // prologue done -> wake up
    }
    if (pressed.Escape) skipIntro();
    IN.click = false; return;
  }
  if (pressed.Escape && !IN.nameMode){ if (IN.skipFn) IN.skipFn(); else skipIntro(); IN.click = false; return; }
  if (IN.creator && !IN.creatorDone){
    const dv = (pressed.ArrowDown||pressed.KeyS ? 1 : 0) - (pressed.ArrowUp||pressed.KeyW ? 1 : 0);
    if (dv) IN.crRow = (IN.crRow+dv+crRows().length)%crRows().length;
    const dh = (pressed.ArrowRight||pressed.KeyD ? 1 : 0) - (pressed.ArrowLeft||pressed.KeyA ? 1 : 0);
    if (dh) crChange(IN.crRow, dh);
    if (pressed.KeyQ) crTab(0); if (pressed.KeyE) crTab(1); if (pressed.Tab) crTab(1-(IN.crTab||0));
    if (pressed.Enter){ IN.creator = false; IN.creatorDone = true; saveChar(); }
  } else if (IN.weaponUI){
    if (pressed.Enter || pressed.Space) IN.weaponPick = 'sword';
  } else if (IN.cur && IN.cur.hub){
    const n = IN.spots.length || 3;
    if (pressed.ArrowRight||pressed.KeyD) IN.hubSel = (IN.hubSel+1)%n; if (pressed.ArrowLeft||pressed.KeyA) IN.hubSel = (IN.hubSel+n-1)%n;
    if (pressed.Enter || pressed.Space || pressed.KeyE) IN.hubPick = ['wallet','chest','door'][IN.hubSel];
    if (IN.click) for (const s of IN.spots) if (mouse.x>=s.x && mouse.x<=s.x+s.w && mouse.y>=s.y && mouse.y<=s.y+s.h){ IN.hubPick = s.id; break; }
  }
  if (IN.cur && IN.cur.update(dt)){ const r = IN.gen.next(); IN.cur = r.done ? null : r.value; }
  IN.click = false;
}
function introMouse(){
  for (const r of IN.ui) if (mouse.x>=r.x && mouse.x<=r.x+r.w && mouse.y>=r.y && mouse.y<=r.y+r.h){ r.act(); return; }
  IN.click = true;
}
function introKey(e){
  if (!IN.on || !IN.nameMode) return false;
  e.preventDefault();
  if (e.key === 'Enter') IN.nameDone = true;
  else if (e.key === 'Backspace') IN.nameBuf = IN.nameBuf.slice(0,-1);
  else if (e.key.length === 1 && /[A-Za-z0-9 '\-]/.test(e.key) && IN.nameBuf.length < 12){ IN.nameBuf += e.key; tone('square', 600, 600, 0.03, 0.06); }
  return true;
}

/* ============================ iso scene drawing ============================ */
function actorSprite(a, opt){
  const back = a.face === 'ul' || a.face === 'ur', flip = a.face === 'dl' || a.face === 'ur';
  return { cv: personCanvas(opt, a.pose, back), flip };
}
function drawActor(g, a, opt){
  if (!a.vis) return; const s = actorSprite(a, opt), bob = a.pose.startsWith('walk') ? Math.abs(Math.sin(a.walkT*18))*1.2 : 0;
  spr(g, s.cv, a.x, a.y, a.z+bob, ISO_SCALE, s.flip);
}
function drawBedroom(g){
  floorTiles(g, '#c9a06a', '#b8905a', '#8f7b5e');
  poly(g,[P2(0,0,0),P2(8,0,0),P2(8,0,WALLH),P2(0,0,WALLH)], '#f2b8b0');
  for (let x=0;x<8;x+=1) wallR(g,x,x+0.45,0,WALLH,'#e8a8a0',false);
  poly(g,[P2(0,0,0),P2(0,6,0),P2(0,6,WALLH),P2(0,0,WALLH)], '#efe3cf');
  wallR(g,0,8,0,8,'#8f5a3a'); wallL(g,0,6,0,8,'#8f5a3a'); wallR(g,0,8,WALLH-6,WALLH,'#d9c8a8'); wallL(g,0,6,WALLH-6,WALLH,'#bfa985');
  wallR(g,4.9,6.7,26,62,'#a3aab8'); wallR(g,5.0,6.6,28,60,'#bcd6e8'); wallR(g,5.75,5.85,28,60,'#a3aab8'); wallR(g,5.0,6.6,43,45,'#a3aab8');   // window
  g.globalAlpha = 0.2; poly(g,[P2(4.9,0.2,0),P2(6.7,0.2,0),P2(7.9,3.4,0),P2(6.1,3.4,0)], '#fdf6e3', false); g.globalAlpha = 1;
  wallR(g,1.0,2.0,30,54,'#3f5f82'); wallR(g,1.1,1.9,32,52,'#efe3cf'); wallR(g,1.3,1.7,40,48,'#b5463f');   // poster
  wallL(g,2.8,4.8,8,66,'#e0a050'); wallL(g,2.95,4.65,11,63,'#bcd6e8');                                   // mirror
  poly(g,[P2(0,3.1,50),P2(0,3.5,50),P2(0,3.1,30),P2(0,2.95,30)], '#f4f1ea', false); poly(g,[P2(0,3.9,58),P2(0,4.1,58),P2(0,3.8,40),P2(0,3.6,40)], '#f4f1ea', false);
  poly(g,[P2(2.0,2.6,0),P2(5.2,2.6,0),P2(5.2,4.6,0),P2(2.0,4.6,0)], '#b86a6e'); poly(g,[P2(2.2,2.8,0),P2(5.0,2.8,0),P2(5.0,4.4,0),P2(2.2,4.4,0)], '#e08f8a');   // rug
  const list = [];
  list.push({ k:4.4, f:() => {   // keyed by the bed's middle, so anyone standing in front of it is drawn on top
    boxC(g,1.7,0.1,0,0.2,2.0,26,'#8f5a3a'); boxC(g,1.9,0.1,0,2.9,2.0,10,'#8f5a3a'); boxC(g,1.9,0.1,10,2.9,2.0,5,'#e8e6e0');
    boxC(g,2.0,0.4,15,0.9,1.5,3,'#f4f1ea');                                              // pillow
    if (IN.sleep){
      /* lying on their back: the whole sprite is rotated so the body runs along the bed, head on the pillow */
      const cvp = personCanvas(Object.assign({}, CHAR, { face:1 }), 'stand', false), [hx,hy] = P2(2.35,1.05,20), s = ISO_SCALE;
      g.save(); g.translate(hx,hy); g.rotate(-1.107); g.imageSmoothingEnabled = true; g.drawImage(cvp, -20*s, -27*s, cvp.width*s, cvp.height*s); g.restore();
      boxC(g,2.9,0.25,15,1.9,1.7,4,'#5f89ab');                                           // blanket over the body
      g.fillStyle = NAVY; g.font = 'bold 10px "Courier New"'; g.fillText('z', hx+10, hy-18-Math.sin(IN.zz*2)*3); g.font = 'bold 14px "Courier New"'; g.fillText('Z', hx+17, hy-28-Math.sin(IN.zz*2+1)*3);
    } else { boxC(g,3.0,0.25,15,1.7,1.7,2,'#5f89ab'); }
    if (IN.sit) spr(g, personCanvas(CHAR,'sit',false), 3.1, 1.75, 15, ISO_SCALE, false);   // sitting up on the edge of the bed
  } });
  list.push({ k:1.1+5.9, f:() => { boxC(g,0.1,4.8,0,1.0,1.1,26,'#bfa985'); boxC(g,0.25,4.95,26,0.3,0.3,5,'#e0a050'); } });
  /* stairwell: the hole is part of the floor (drawn first); the floor lip + railing in front sort like objects,
     so someone stepping down into it sinks behind the lip instead of being painted over */
  const HOLE = [P2(6.2,3.8,0),P2(7.8,3.8,0),P2(7.8,5.4,0),P2(6.2,5.4,0)];
  list.push({ k:-1, f:() => { poly(g,HOLE,'#1b1f2e');
    g.save(); g.beginPath(); HOLE.forEach((p,i) => i ? g.lineTo(p[0],p[1]) : g.moveTo(p[0],p[1])); g.closePath(); g.clip();
    for (let i=0;i<5;i++) boxC(g,6.2+i*0.32,3.8,-60,0.32,1.6,60-(i+1)*5,i%2 ? '#8f7b5e' : '#a89f91');   // treads descending toward the front edge
    g.restore(); } });
  list.push({ k:7.85+5.45+0.05, f:() => {
    poly(g,[P2(6.2,5.4,0),P2(7,5.4,0),P2(7,6,0),P2(6.2,6,0)], '#c9a06a', false); poly(g,[P2(7,5.4,0),P2(7.8,5.4,0),P2(7.8,6,0),P2(7,6,0)], '#b8905a', false);
    boxC(g,6.15,5.35,0,1.7,0.1,14,'#a3aab8'); boxC(g,7.75,3.75,0,0.1,1.7,14,'#a3aab8'); } });
  list.push({ k:IN.pl.x+IN.pl.y+0.4, f:() => {
    if (IN.pl.z < 0){   // below floor level: only what is above the hole's front edges is visible
      const a = P2(6.2,5.4,0), b = P2(7.8,5.4,0), c = P2(7.8,3.8,0);
      g.save(); g.beginPath(); g.moveTo(a[0]-80,a[1]); g.lineTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.lineTo(c[0],c[1]); g.lineTo(c[0],-80); g.lineTo(a[0]-80,-80); g.closePath(); g.clip();
      drawActor(g, IN.pl, CHAR); g.restore();
    } else drawActor(g, IN.pl, CHAR); } });
  list.sort((a,b) => a.k-b.k).forEach(o => o.f());
}
function drawKitchen(g){
  floorTiles(g, '#d4d0c8', '#a3aab8', '#7d8597');
  poly(g,[P2(0,0,0),P2(8,0,0),P2(8,0,WALLH),P2(0,0,WALLH)], '#efe3cf');
  for (let x=0;x<8;x+=2) wallR(g,x+0.1,x+0.2,10,WALLH-6,'#d9c8a8',false);
  poly(g,[P2(0,0,0),P2(0,6,0),P2(0,6,WALLH),P2(0,0,WALLH)], '#d9c8a8');
  wallR(g,0,8,0,10,'#8f7b5e'); wallL(g,0,6,0,10,'#8f7b5e'); wallR(g,0,8,WALLH-5,WALLH,'#bfa985'); wallL(g,0,6,WALLH-5,WALLH,'#a89f91');
  for (let i=0;i<7;i++) wallR(g,0.2+i*1.15,0.2+i*1.15+0.12,32,64,'#d9c8a8',false);
  wallL(g,4.0,5.6,28,60,'#a3aab8'); wallL(g,4.1,5.5,30,58,'#bcd6e8'); wallL(g,4.75,4.85,30,58,'#a3aab8');                      // window on left wall
  const [cx,cy] = P2(2.0,0,52); g.fillStyle = NAVY; g.beginPath(); g.arc(cx,cy,8,0,6.3); g.fill(); g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(cx,cy,6.5,0,6.3); g.fill();
  g.strokeStyle = NAVY; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+3,cy-3); g.moveTo(cx,cy); g.lineTo(cx,cy-5); g.stroke();
  /* door (hinged at x=5.2) */
  wallR(g,5.05,6.65,0,62,'#bfa985');
  const open = IN.doorOpen; wallR(g,5.2,6.5,0,58, open > 0.02 ? '#fdf6e3' : '#8f5a3a');
  if (open > 0.02){ g.globalAlpha = 0.35*open; poly(g,[P2(5.2,0.1,0),P2(6.5,0.1,0),P2(7.6,3.4,0),P2(5.6,3.4,0)], '#fdf6e3', false); g.globalAlpha = 1; }
  const dw = 1.3*(1-open*0.88);
  wallR(g,5.2,5.2+dw,0,58,'#8f5a3a'); wallR(g,5.3,5.2+dw-0.1,34,54,'#7a4a2c'); wallR(g,5.3,5.2+dw-0.1,6,30,'#7a4a2c');
  if (open < 0.4){ const [kx,ky] = P2(6.3,0,28); g.fillStyle = '#ffe14a'; g.fillRect(kx-1,ky-1,3,3); }
  const list = [];
  list.push({ k:2.8+0.9, f:() => { boxC(g,1.2,0.1,0,1.6,0.8,24,'#d9c8a8','#c9cdd6'); boxC(g,1.35,0.22,24,0.8,0.55,13,'#2c3142');
    poly(g,[P2(1.42,0.77,26),P2(1.98,0.77,26),P2(1.98,0.77,35),P2(1.42,0.77,35)], (Math.floor(IN.tvT*3)%2) ? '#8fb4d0' : '#bcd6e8');   // screen on the front face
    poly(g,[P2(2.03,0.77,28),P2(2.1,0.77,28),P2(2.1,0.77,34),P2(2.03,0.77,34)], '#5a6275', false);
    const [a1,a2] = P2(1.6,0.45,37), [b1,b2] = P2(1.8,0.45,37); g.strokeStyle = NAVY; g.lineWidth = 1; g.beginPath(); g.moveTo(a1,a2); g.lineTo(a1-5,a2-9); g.moveTo(b1,b2); g.lineTo(b1+5,b2-9); g.stroke(); } });
  list.push({ k:3.7+0.9, f:() => { boxC(g,2.9,0.1,0,0.8,0.8,62,'#e8e6e0'); poly(g,[P2(3.0,0.9,36),P2(3.7,0.9,36),P2(3.7,0.9,38),P2(3.0,0.9,38)], NAVY, false); } });
  list.push({ k:4.8+0.7, f:() => { boxC(g,4.1,0.1,0,0.7,0.6,22,'#8f5a3a'); if (IN.walletOn){ const b = Math.sin(IN.t*5)*0.8; boxC(g,4.25,0.2,22+b,0.35,0.28,2,'#b5463f'); } } });
  list.push({ k:7.7+0.95, f:() => {
    boxC(g,6.8,0.15,0,0.9,0.8,12,'#8f5a3a'); boxC(g,6.8,0.15,6,0.9,0.8,1.5,'#e0a050');
    if (IN.chestOpen < 0.3) boxC(g,6.78,0.13,12,0.94,0.84,3,'#a06a3a');
    else { boxC(g,6.78,0.13,12,0.94,0.15,10*IN.chestOpen,'#a06a3a'); g.globalAlpha = 0.35*IN.chestOpen; const [gx,gy] = P2(7.25,0.55,18); g.fillStyle = '#ffe14a'; g.beginPath(); g.ellipse(gx,gy,16,10,0,0,6.3); g.fill(); g.globalAlpha = 1; } } });
  for (let i=0;i<6;i++) list.push({ k:1.5+(3.5-i*0.5)+0.55, f:() => boxC(g,0,3.5-i*0.5,0,1.5,0.55,9*(i+1),i%2 ? '#bfa985' : '#c9a06a') });   // each step sorts on its own so the walker is not hidden
  list.push({ k:4.8+3.8, f:() => {
    for (const [lx,ly] of [[2.9,2.7],[4.5,2.7],[2.9,3.5],[4.5,3.5]]) boxC(g,lx,ly,0,0.25,0.25,17,'#8f5a3a');
    boxC(g,2.8,2.6,17,2.0,1.2,3,'#c9a06a','#d9b57a');
    boxC(g,3.3,3.0,20,0.5,0.4,1,'#f4f1ea'); if (IN.food > 0.02) boxC(g,3.4,3.1,21,0.3,0.2,2*IN.food+0.3,'#e0a050');
    boxC(g,4.1,3.2,20,0.22,0.22,2.5,'#e8e6e0');
    if (IN.milkOn){ boxC(g,4.35,2.72,20,0.3,0.3,4.5,'#f4f1ea','#e8e6e0'); boxC(g,4.38,2.75,24.5,0.24,0.24,1.2,'#5f89ab'); } } });
  list.push({ k:2.55+3.5-0.3, f:() => { boxC(g,2.0,2.95,8,0.55,0.55,2,'#8f5a3a'); boxC(g,2.0,2.95,10,0.1,0.55,11,'#8f5a3a'); for (const [lx,ly] of [[2.05,3.0],[2.4,3.35]]) boxC(g,lx,ly,0,0.1,0.1,8,'#5e4f3c'); } });
  list.push({ k:5.55+3.5-0.3, f:() => { boxC(g,5.0,2.95,8,0.55,0.55,2,'#8f5a3a'); boxC(g,5.45,2.95,10,0.1,0.55,11,'#8f5a3a'); for (const [lx,ly] of [[5.05,3.0],[5.4,3.35]]) boxC(g,lx,ly,0,0.1,0.1,8,'#5e4f3c'); } });
  list.push({ k:(IN.pl.x < 1.5 && IN.pl.y < 4.05) ? 5.8-0.5*Math.max(0, Math.min(5, Math.floor((4.05-IN.pl.y)/0.5))) : (IN.pl.x < 1.7 && IN.pl.y < 4.7) ? 1.5+IN.pl.y+0.48 : IN.pl.x+IN.pl.y+0.4, f:() => drawActor(g, IN.pl, CHAR) });   // on the stairs, sort between the steps
  if (IN.mom.vis){ const m = IN.mom, alt = Math.floor(IN.t/1.4)%3 === 2; const mm = Object.assign({}, m, { pose: alt ? 'eat0' : 'sit' });
    list.push({ k:m.x+m.y+0.4, f:() => drawActor(g, mm, MOM) }); }
  list.sort((a,b) => a.k-b.k).forEach(o => o.f());
  if (IN.itemFly){ const f = IN.itemFly; f.t += 1/60; const k = Math.min(1, f.t/f.dur);
    const [sx,sy] = f.type === 'wallet' ? P2(4.4,0.45,22+k*14) : P2(7.25,0.55,18+k*18);
    g.save(); g.translate(sx, sy-k*4); g.globalAlpha = 1-k*0.4;
    if (f.type === 'wallet'){ g.fillStyle = NAVY; g.fillRect(-6,-4,12,8); g.fillStyle = '#b5463f'; g.fillRect(-5,-3,10,6); g.fillStyle = '#ffe14a'; g.fillRect(-1,-1,3,2); }
    else { g.rotate(-0.3); g.fillStyle = NAVY; g.fillRect(-3,-34,6,36); g.fillStyle = '#e8e6e0'; g.fillRect(-2,-33,3,32); g.fillStyle = '#a3aab8'; g.fillRect(0,-33,2,32); g.fillStyle = NAVY; g.fillRect(-7,2,14,4); g.fillStyle = '#e0a050'; g.fillRect(-6,3,12,2); g.fillStyle = '#8f5a3a'; g.fillRect(-2,6,4,9); }
    g.restore(); }
  const hs = (id,x,y,z,w,h) => { const [sx,sy] = P2(x,y,z); return { id, x:(sx-w/2)*2, y:(sy-h/2)*2, w:w*2, h:h*2 }; };
  IN.spots = [hs('wallet',4.45,0.4,30,26,26), hs('chest',7.25,0.55,18,34,28), hs('door',5.85,0,32,40,64)];
}
function drawIntroScene(g){
  g.save();
  if (IN.shake > 0) g.translate((Math.random()-0.5)*6*IN.shake, (Math.random()-0.5)*6*IN.shake);
  g.fillStyle = '#2c3142'; g.fillRect(-10,-10,500,290);
  if (IN.creator) drawCreatorScene(g);
  else if (IN.room === 'bed') drawBedroom(g); else drawKitchen(g);
  if (IN.dark > 0){ g.globalAlpha = IN.dark; g.fillStyle = '#1b1f2e'; g.fillRect(-10,-10,500,290); g.globalAlpha = 1; }
  if (IN.flash > 0){ g.globalAlpha = IN.flash*0.7; g.fillStyle = '#fdf6e3'; g.fillRect(-10,-10,500,290); g.globalAlpha = 1; }
  g.restore();
  if (IN.fade > 0){ g.globalAlpha = IN.fade; g.fillStyle = IN.fadeColor; g.fillRect(0,0,480,270); g.globalAlpha = 1; }
}
function drawCreatorScene(g){
  g.fillStyle = '#d9c8a8'; g.fillRect(0,0,480,270);
  for (let x=0;x<480;x+=24){ g.fillStyle = '#e8e6e0'; g.fillRect(x,0,12,270); }
  g.fillStyle = '#8f5a3a'; g.fillRect(0,236,480,34); g.fillStyle = '#c9a06a'; g.fillRect(0,236,480,6);
  g.fillStyle = NAVY; g.fillRect(250,4,224,258); g.fillStyle = '#e0a050'; g.fillRect(253,7,218,252); g.fillStyle = NAVY; g.fillRect(257,11,210,244);
  const gr = g.createLinearGradient(260,14,464,252); gr.addColorStop(0,'#bcd6e8'); gr.addColorStop(1,'#8fb4d0'); g.fillStyle = gr; g.fillRect(260,14,204,238);
  g.fillStyle = '#c9cdd6'; g.fillRect(260,206,204,46); g.fillStyle = '#e8e6e0'; for (let i=0;i<4;i++){ g.fillRect(274+i*46,18,12,180); }
  g.globalAlpha = 0.5; for (const [a,b] of [[290,40],[360,100],[430,30]]){ g.fillStyle = '#f4f1ea'; g.fillRect(a,b,6,40); } g.globalAlpha = 1;
  /* the character itself is drawn on the HUD layer (drawIntroHUD) in true colours, so the palette snap can't muddy the skin tones */
}
/* ============================ comic prologue: 7 stills, each painted ONCE into a cached canvas ============================
   Per frame the card state costs a single drawImage (no quantize). Captions are drawn on the full-res HUD so the text stays crisp. */
const PANELS = [
  { paint:pnContact,  caps:[['YEAR 2XXX.','tl'], ['FIRST CONTACT WITH EXTRATERRESTRIALS.','tl']] },
  { paint:pnLeaders,  caps:[['WE TOOK THEM TO OUR LEADERS.','tl'], ['WE SHOWED THEM OUR WAYS.','tl']] },
  { paint:pnBusiness, caps:[['THEY TOOK A SPECIAL INTEREST...','tl'], ['...IN BUSINESS.','br']] },
  { paint:pnTower,    caps:[['5 YEARS LATER.','tl'], ['THE FIRST ALIEN-OWNED COMPANY OPENS ITS DOORS.','tl']] },
  { paint:pnTakeover, caps:[['10 YEARS LATER.','tl'], ['THEY HAVE BOUGHT OUT 80% OF ALL HUMAN BUSINESSES.','tl'], ['A HOSTILE TAKEOVER.','br','#e08f8a']] },
  { paint:pnAlley, over:pnRain, caps:[['THE REMAINING HUMANS ARE NOW TRYING TO SURVIVE...','tl'], ['...AND AVOID A SIMILAR FATE.','br']] } ];
const CAP_GAP = 0.9;                                                      // seconds between caption boxes popping in
const panelCache = [];
function panelCanvas(i){
  if (panelCache[i]) return panelCache[i];
  const cv = mkCanvas(480,270), g = cv.getContext('2d', { willReadFrequently:true }), p = PANELS[i];
  const clip = () => { g.save(); g.beginPath(); g.rect(10,14,460,242); g.clip(); };
  g.fillStyle = NAVY; g.fillRect(0,0,480,270); g.fillStyle = '#a3aab8'; g.fillRect(8,12,464,246);       // dark page, thin panel frame
  clip(); p.paint(g);
  if (!p.now){ g.globalAlpha = 0.14; g.fillStyle = '#7a2a30'; g.fillRect(10,14,460,242); g.globalAlpha = 1; }   // blood-red flashback wash
  halftone(g, 10, 14, 460, 242, NAVY, 5, (x,y) => { const dx = (x-240)/230, dy = (y-135)/121, d = Math.sqrt(dx*dx+dy*dy); return d > 0.8 ? (d-0.8)*7 : 0; });   // halftone vignette
  g.restore(); quantize(g, 480, 270); inkEdges(g);
  if (p.over){ clip(); p.over(g); g.restore(); quantize(g, 480, 270); }
  return panelCache[i] = cv;
}
function inkEdges(g){                                                     // comic inking: the darker side of every strong edge turns navy
  const img = g.getImageData(0,0,480,270), d = img.data, N = 480*270, L = new Float32Array(N), mark = new Uint8Array(N);
  for (let i=0, j=0; i<N; i++, j+=4) L[i] = d[j]*0.3 + d[j+1]*0.59 + d[j+2]*0.11;
  for (let y=0; y<269; y++) for (let x=0; x<479; x++){
    const i = y*480+x, a = L[i], r = L[i+1], b = L[i+480];
    if (a-r > 58) mark[i+1] = 1; else if (r-a > 58) mark[i] = 1;
    if (a-b > 58) mark[i+480] = 1; else if (b-a > 58) mark[i] = 1;
  }
  for (let i=0, j=0; i<N; i++, j+=4) if (mark[i]){ d[j] = 27; d[j+1] = 31; d[j+2] = 46; }
  g.putImageData(img, 0, 0);
}
/* small painting helpers (prologue only) */
function cpoly(g, p, c){ g.fillStyle = c; g.beginPath(); g.moveTo(p[0],p[1]); for (let i=2;i<p.length;i+=2) g.lineTo(p[i],p[i+1]); g.closePath(); g.fill(); }
function cell(g, x, y, rx, ry, c){ g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.3); g.fill(); }
function vgrad(g, cols){ const gr = g.createLinearGradient(0,14,0,256); cols.forEach((c,i) => gr.addColorStop(i/(cols.length-1), c)); g.fillStyle = gr; g.fillRect(10,14,460,242); }
function halftone(g, x0, y0, w, h, c, step, fn){
  g.fillStyle = c;
  for (let y=y0, row=0; y<y0+h; y+=step, row++) for (let x=x0+(row&1 ? step/2 : 0); x<x0+w; x+=step){ const r = Math.min(step*0.75, fn(x,y)); if (r > 0.35){ g.beginPath(); g.arc(x,y,r,0,6.3); g.fill(); } }
}
function starBurst(g, x, y, r, c){ const p = []; for (let i=0;i<16;i++){ const a = i/16*6.283, rr = i%2 ? r*0.3 : r*(0.7+((i*7)%5)/10); p.push(x+Math.cos(a)*rr, y+Math.sin(a)*rr); } cpoly(g, p, c); }
function human(g, x, y, s, c){ cell(g, x, y-17*s, 3.2*s, 3.6*s, c); cpoly(g, [x-5.5*s,y-12*s, x+5.5*s,y-12*s, x+6.5*s,y, x-6.5*s,y], c); }   // head-and-shoulders silhouette
function fig(g, x, fy, s, o){                                             // standing figure, feet at fy (~66*s tall)
  g.fillStyle = o.pants || o.suit; g.fillRect(x-4*s, fy-24*s, 3.2*s, 24*s); g.fillRect(x+0.8*s, fy-24*s, 3.2*s, 24*s);
  cpoly(g, [x-7*s,fy-46*s, x+7*s,fy-46*s, x+6*s,fy-22*s, x-6*s,fy-22*s], o.suit);
  if (o.shirt) cpoly(g, [x-2.4*s,fy-46*s, x+2.4*s,fy-46*s, x,fy-36*s], o.shirt);
  if (o.tie) cpoly(g, [x-s,fy-45*s, x+s,fy-45*s, x+1.2*s,fy-32*s, x,fy-30*s, x-1.2*s,fy-32*s], o.tie);
  if (o.badge){ g.fillStyle = '#5f89ab'; g.fillRect(x+2*s, fy-46*s, 0.7*s, 8*s); g.fillStyle = NAVY; g.fillRect(x+2.2*s, fy-38.6*s, 3.4*s, 4*s); g.fillStyle = '#e8e6e0'; g.fillRect(x+2.7*s, fy-38*s, 2.4*s, 2.8*s); }   // lanyard + ID badge
  for (const sd of [-1,1]){
    const ext = (o.arm === 'r' && sd === 1) || (o.arm === 'l' && sd === -1);
    const ex = ext ? o.armTo[0] : x+sd*8.5*s, ey = ext ? o.armTo[1] : fy-24*s;
    g.strokeStyle = o.suit; g.lineWidth = 3.2*s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x+sd*6.5*s, fy-44*s); g.lineTo(ex, ey); g.stroke();
    cell(g, ex, ey, 1.8*s, 1.8*s, o.skin);
  }
  if (o.alien){                                                           // same head as the in-game recruiters (sprites.js)
    const hy = fy-56*s;
    g.strokeStyle = o.skin2; g.lineWidth = Math.max(1, 0.9*s); g.lineCap = 'round'; g.beginPath();
    g.moveTo(x-2.6*s, hy-7*s); g.lineTo(x-3.6*s, hy-11.5*s); g.moveTo(x+2.6*s, hy-7*s); g.lineTo(x+3.6*s, hy-11.5*s); g.stroke();   // antennae
    cell(g, x-3.8*s, hy-12*s, 1.7*s, 1.2*s, o.bulb); cell(g, x+3.8*s, hy-12*s, 1.7*s, 1.2*s, o.bulb);                            // glowing bulbs
    cell(g, x+1.1*s, hy, 8*s, 8.5*s, o.skin2); cell(g, x+0.8*s, hy+5*s, 5.6*s, 5*s, o.skin2);                                       // shaded right side
    cell(g, x, hy, 8*s, 8.5*s, o.skin); cell(g, x, hy+5*s, 5.6*s, 5*s, o.skin);                                                     // egg head: wide crown, narrow jaw
    for (const sd of [-1,1]){
      g.fillStyle = NAVY; g.beginPath(); g.ellipse(x+sd*3.6*s, hy+0.8*s, 3.4*s, 1.9*s, -sd*0.6, 0, 6.3); g.fill();                  // big black eyes, slanted down toward the middle
      cell(g, x+sd*5*s, hy-0.6*s, 0.7*s, 0.7*s, '#fdf6e3');
    }
    g.fillStyle = NAVY; g.fillRect(x-1.5*s, hy+7*s, 3*s, Math.max(1, 0.6*s));
  } else { cell(g, x, fy-51*s, 4.6*s, 5.6*s, o.skin); if (o.hair) cell(g, x, fy-54.5*s, 4.9*s, 3*s, o.hair); }
}
/* recruiter look straight from ENEMY_COL (grunt / runner / thrower); f darkens it for backlit shots; plain = no office wear yet */
function alienLook(kind, f, plain, extra){
  const k = ENEMY_COL[kind], d = c => f === 1 ? c : shade(c, f);
  const o = { alien:true, skin:d(k.skin), skin2:d(k.skin2), suit:d(k.suit), pants:d(k.suit), bulb:k.bulb };
  if (plain){ o.suit = o.pants = d('#5a6275'); } else { o.shirt = d(k.shirt); o.tie = d(k.tie); o.badge = true; }
  return Object.assign(o, extra);
}

/* 1 - first contact: a figure in a beam of light over a crowd */
function pnContact(g){
  vgrad(g, ['#1b1f2e','#2c3142','#3f5f82']);
  _s = 11; g.fillStyle = '#c9cdd6'; for (let i=0;i<60;i++) g.fillRect(ri(10,470), ri(14,150), 1, 1);
  cpoly(g, [222,14, 258,14, 345,206, 135,206], 'rgba(232,200,96,.28)');
  cpoly(g, [232,14, 248,14, 285,206, 195,206], 'rgba(253,246,227,.35)');
  halftone(g, 130, 14, 220, 192, '#e8c860', 5, (x,y) => { const t = (y-14)/192, half = 18+t*87, d = Math.abs(x-240)/half; return d < 1 && d > 0.5 ? (1-d)*3 : 0; });
  cell(g, 240, 14, 50, 9, '#fdf6e3');
  g.fillStyle = '#2c3142'; g.fillRect(10, 200, 460, 60);
  cell(g, 240, 214, 74, 7, 'rgba(253,246,227,.45)');
  fig(g, 240, 214, 2.0, alienLook('grunt', 0.8, true));                  // head kept below the caption boxes
  _s = 12;
  for (let x=14; x<470; x+=11){ const s = 1.5+rnd()*0.5, hx = x+ri(-2,2); human(g, hx, 268, s, NAVY); if (rnd() < 0.2){ g.fillStyle = '#bcd6e8'; g.fillRect(hx-1, 268-26*s-ri(2,6), 3, 4); } }
}
/* 2 - the summit: handshake, banner, camera flashes */
function pnLeaders(g){
  g.fillStyle = '#7a2a30'; g.fillRect(10,14,460,242);
  for (let x=10; x<470; x+=18){ g.fillStyle = '#b5463f'; g.fillRect(x+3,14,4,180); g.fillStyle = 'rgba(27,31,46,.35)'; g.fillRect(x+13,14,3,180); }
  g.fillStyle = '#efe3cf'; g.fillRect(234,24,166,20); g.fillStyle = NAVY; g.font = 'bold 11px monospace'; g.textAlign = 'center'; g.fillText('WELCOME, VISITORS', 317, 38);   // right of the captions
  for (const fx of [60, 424]){ g.fillStyle = '#a3aab8'; g.fillRect(fx,60,2,132); cpoly(g, [fx+2,62, fx+32,67, fx+30,86, fx+2,82], '#4a90d9'); g.fillStyle = '#efe3cf'; g.fillRect(fx+12,70,8,6); }
  g.fillStyle = '#3f4658'; g.fillRect(10,190,460,70); g.fillStyle = '#5a6275'; g.fillRect(10,190,460,4);
  for (const [x,y,r] of [[110,118,24],[385,96,20],[335,168,14],[160,58,13]]){ cell(g, x, y, r*1.3, r*1.3, 'rgba(253,246,227,.25)'); starBurst(g, x, y, r, '#fdf6e3'); }
  fig(g, 205, 200, 2.2, { skin:'#f1c27d', hair:'#a3aab8', suit:'#2c3142', pants:NAVY, tie:'#b5463f', arm:'r', armTo:[238,138] });
  fig(g, 275, 200, 2.1, alienLook('grunt', 1, true, { arm:'l', armTo:[242,138] }));   // antennae stay under the banner
  for (let x=24; x<470; x+=28){ human(g, x, 274, 2.3, NAVY); g.fillStyle = NAVY; g.fillRect(x-5, 274-46, 10, 7); cell(g, x, 274-42.5, 2, 2, '#bcd6e8'); }
}
/* 3 - "...in business": huge alien profile, a rising chart in its eye */
function pnBusiness(g){
  g.fillStyle = NAVY; g.fillRect(10,14,460,242);
  for (let i=0;i<48;i+=2){ const a = i/48*6.283; cpoly(g, [255,118, 255+Math.cos(a)*420, 118+Math.sin(a)*420, 255+Math.cos(a+0.07)*420, 118+Math.sin(a+0.07)*420], '#2c3142'); }
  cell(g, 360, 140, 150, 175, '#6b8650'); cell(g, 335, 92, 100, 78, '#8fa66a');
  g.strokeStyle = '#34502f'; g.lineWidth = 3; g.beginPath(); g.moveTo(212,96); g.quadraticCurveTo(255,84, 300,98); g.stroke();          // heavy brow
  g.save(); g.beginPath(); g.ellipse(255,120,42,17,-0.2,0,6.3); g.fillStyle = NAVY; g.fill(); g.clip();
  g.strokeStyle = '#34502f'; g.lineWidth = 1; for (let x=216; x<300; x+=8){ g.beginPath(); g.moveTo(x,96); g.lineTo(x,142); g.stroke(); }
  g.strokeStyle = '#3cff8a'; g.lineWidth = 2; g.beginPath();
  [[216,138],[230,130],[241,134],[254,120],[265,124],[280,106],[292,101]].forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.stroke();
  cpoly(g, [294,96, 297,106, 287,103], '#3cff8a'); g.restore();
  cell(g, 273, 112, 4, 3, '#fdf6e3');
  g.strokeStyle = '#34502f'; g.lineWidth = 2; g.beginPath(); g.moveTo(228,200); g.quadraticCurveTo(248,208, 268,198); g.stroke();      // thin smile
  g.save(); g.translate(98,196); g.rotate(-0.12);
  g.fillStyle = '#efe3cf'; g.fillRect(-56,-42,120,86); g.fillStyle = '#b5463f'; g.fillRect(-62,-48,120,86);
  g.fillStyle = '#e8c860'; g.textAlign = 'center'; g.font = 'bold 15px monospace'; g.fillText('BUSINESS', -2, -14); g.font = 'bold 24px monospace'; g.fillText('101', -2, 14); g.fillRect(-50,22,96,2);
  g.restore();
  g.strokeStyle = '#6b8650'; g.lineWidth = 5; g.lineCap = 'round';
  for (let i=0;i<3;i++){ g.beginPath(); g.moveTo(178+i*6, 262); g.quadraticCurveTo(160-i*2, 214+i*10, 140+i*4, 180+i*14); g.stroke(); }    // long fingers on the cover
}
/* 4 - five years later: the first alien-owned tower, ribbon cutting under a red sky */
function pnTower(g){
  vgrad(g, ['#7a2a30','#b5463f','#e08f8a']);
  halftone(g, 10, 14, 460, 70, '#7a2a30', 6, (x,y) => (84-y)/70*2.4);
  cpoly(g, [150,256, 160,256, 60,14, 30,14], 'rgba(253,246,227,.2)'); cpoly(g, [320,256, 330,256, 450,14, 420,14], 'rgba(253,246,227,.2)');
  _s = 41; for (let x=10; x<470;){ const w = ri(14,28), h = ri(26,70); g.fillStyle = '#2c3142'; g.fillRect(x, 256-h, w-2, h); x += w; }
  cpoly(g, [205,256, 205,60, 220,40, 260,40, 275,60, 275,256], NAVY);
  g.fillStyle = NAVY; g.fillRect(239,16,2,24); cell(g, 240, 16, 2.5, 2.5, '#ff5a4a');
  _s = 42; g.fillStyle = '#e8c860'; for (let y=132; y<166; y+=9) for (let x=211; x<270; x+=7) if (rnd() < 0.3) g.fillRect(x, y, 3, 4);
  cell(g, 240, 90, 27, 12, '#efe3cf'); cell(g, 240, 90, 9, 9, '#3cff8a'); g.fillStyle = NAVY; g.fillRect(238, 82, 4, 16);   // the eye logo (below the captions)
  g.fillStyle = '#e8c860'; g.fillRect(208,108,64,13); g.fillStyle = NAVY; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.fillText('BIZNES CORP', 240, 118);
  g.fillStyle = '#e8c860'; g.fillRect(218,170,44,62); g.fillStyle = '#fdf6e3'; g.fillRect(224,176,32,56);   // lit lobby doors behind the figure
  g.fillStyle = '#3f4658'; g.fillRect(10,232,460,30);
  g.fillStyle = '#c9cdd6'; g.fillRect(172,214,3,20); g.fillRect(305,214,3,20);
  g.strokeStyle = '#ff5a4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(174,218); g.quadraticCurveTo(205,226, 228,238); g.moveTo(306,218); g.quadraticCurveTo(275,226, 252,238); g.stroke();   // cut ribbon
  fig(g, 240, 256, 1.15, alienLook('grunt', 1, false));
  g.strokeStyle = '#c9cdd6'; g.lineWidth = 2; g.beginPath(); g.moveTo(250,228); g.lineTo(266,214); g.moveTo(250,222); g.lineTo(268,224); g.stroke();   // giant scissors
  for (const x of [40,62,90,112,138,350,372,398,420,446]) human(g, x, 262, 1.3, NAVY);
}
/* 5 - ten years later: every building has the eye, the market crashes, 80% stamp */
function pnTakeover(g){
  vgrad(g, ['#1b1f2e','#3f4658','#7a2a30']);
  g.strokeStyle = 'rgba(163,170,184,.25)'; g.lineWidth = 1; for (let y=40; y<250; y+=24){ g.beginPath(); g.moveTo(10,y); g.lineTo(470,y); g.stroke(); }
  _s = 77;
  for (let x=10; x<470;){
    const w = ri(26,46), h = ri(70,175), bw = w-3; g.fillStyle = rnd() < 0.5 ? NAVY : '#2c3142'; g.fillRect(x, 256-h, bw, h);
    g.fillStyle = '#3f4658'; for (let y=256-h+26; y<250; y+=10) for (let wx=x+4; wx<x+bw-4; wx+=7) if (rnd() < 0.25) g.fillRect(wx, y, 3, 4);
    const ex = x+bw/2, ey = 256-h+12; cell(g, ex, ey, 8, 4, '#efe3cf'); cell(g, ex, ey, 3, 3, '#3cff8a');
    x += w;
  }
  const pts = [[20,64],[70,54],[110,84],[150,72],[200,124],[240,110],[290,172],[330,160],[380,214],[436,240]];
  for (const [w,c] of [[9,NAVY],[4,'#ff5a4a']]){ g.strokeStyle = c; g.lineWidth = w; g.lineJoin = 'miter'; g.beginPath(); pts.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.stroke(); }
  cpoly(g, [452,250, 424,248, 440,226], '#ff5a4a');
  g.save(); g.translate(372,84); g.rotate(-0.18);
  g.strokeStyle = '#ff5a4a'; g.lineWidth = 4; g.strokeRect(-62,-32,124,64); g.lineWidth = 1.5; g.strokeRect(-55,-25,110,50);
  g.fillStyle = '#ff5a4a'; g.textAlign = 'center'; g.font = 'bold 30px monospace'; g.fillText('80%', 0, 8); g.font = 'bold 9px monospace'; g.fillText('ACQUIRED', 0, 20);
  g.restore();
}
/* 6 - now: a rainy alley, a human hiding, recruiters with a contract at the far end */
function pnAlley(g){
  g.fillStyle = '#3f5f82'; g.fillRect(10,14,460,242);
  g.fillStyle = '#5f89ab'; g.fillRect(250,96,100,76);
  cpoly(g, [296,96, 304,96, 342,172, 258,172], 'rgba(253,246,227,.35)');
  cpoly(g, [10,14, 250,96, 250,172, 10,256], '#2c3142'); cpoly(g, [470,14, 350,96, 350,172, 470,256], '#3f4658');
  g.strokeStyle = NAVY; g.lineWidth = 1;
  for (let k=1; k<12; k++){ const f = k/12; g.beginPath(); g.moveTo(10, 14+f*242); g.lineTo(250, 96+f*76); g.moveTo(470, 14+f*242); g.lineTo(350, 96+f*76); g.stroke(); }
  cpoly(g, [250,172, 350,172, 470,256, 10,256], NAVY);
  cell(g, 210, 232, 54, 6, '#3f5f82'); cell(g, 318, 206, 30, 4, '#5f89ab');
  const crew = [[278,'runner'], [300,'grunt'], [322,'thrower']];
  for (const [x,kind] of crew) fig(g, x, 172, 0.8, alienLook(kind, 0.88, false, kind === 'grunt' ? { arm:'r', armTo:[309,146] } : {}));
  g.fillStyle = '#efe3cf'; g.fillRect(306,137,11,14); g.fillStyle = '#7d8597'; g.fillRect(308,140,7,1); g.fillRect(308,143,7,1);   // the contract
  for (const [x,kind] of crew) for (const sd of [-1,1]) cell(g, x+sd*3, 199, 1.2, 1, ENEMY_COL[kind].bulb);   // antenna bulbs reflected in the puddle
  cpoly(g, [14,168, 140,160, 150,256, 10,256], '#34502f'); cpoly(g, [10,160, 140,150, 146,162, 14,172], '#4a6b3c');
  g.fillStyle = '#4a6b3c'; for (const x of [40, 80, 118]) g.fillRect(x, 172, 3, 84);
  cell(g, 160, 232, 18, 26, NAVY); cell(g, 156, 196, 10, 11, NAVY); cell(g, 147, 184, 4, 3, NAVY);   // someone crouched behind the dumpster
  cell(g, 162, 195, 2.6, 1.6, '#efe3cf'); g.fillStyle = NAVY; g.fillRect(163, 194, 1, 2);
}
function pnRain(g){ _s = 3; g.strokeStyle = 'rgba(188,214,232,.5)'; g.lineWidth = 1; g.beginPath(); for (let i=0;i<260;i++){ const x = ri(10,484), y = ri(4,256); g.moveTo(x,y); g.lineTo(x-4,y+11); } g.stroke(); }
function drawCard(){                                                      // whole card frame: one drawImage + a short fade-in
  const c = IN.card; dctx.imageSmoothingEnabled = false; dctx.drawImage(panelCanvas(c.page), 0, 0, DW, DH);
  if (c.t < 0.3){ dctx.globalAlpha = 1 - c.t/0.3; HR(0,0,DW,DH,'#000'); dctx.globalAlpha = 1; }
}

/* ============================ HUD overlay (full-res) ============================ */
function wrapText(s, maxW){
  const out = []; let line = '';
  for (const w of s.split(' ')){ const t = line + w + ' '; if (dctx.measureText(t).width > maxW && line){ out.push(line); line = w+' '; } else line = t; }
  out.push(line); return out;
}
function drawDialogue(){
  const d = IN.dlg; if (!d) return;
  const x = 60, y = 386, w = 840, h = 134;
  HR(x-4,y-4,w+8,h+8,NAVY); HR(x,y,w,h,'#2c3142'); HR(x,y,w,5,d.shout ? '#ff5a4a' : '#e0a050');
  const who = d.who, opt = who === 'YOU' ? CHAR : who === 'MOM' ? MOM : null;
  let tx = x+24;
  if (opt){
    HR(x+12,y+14,136,108,'#1f1018'); HR(x+12,y+14,136,4,'#3f4658');
    const cv = bustCanvas(opt); dctx.imageSmoothingEnabled = false; dctx.drawImage(cv, 0, 4, 66, 62, x+25, y+16, 110, 104);
    tx = x+168;
  }
  const label = who === 'YOU' ? CHAR.name.toUpperCase() : who;
  if (who) HT(label, tx, y+32, 18, who === 'MOM' ? '#f2b8b0' : who === 'TV' ? '#8fb4d0' : '#ffe14a');
  const size = d.shout ? 25 : 21; dctx.font = 'bold '+size+'px "Courier New",monospace';
  const lines = wrapText(d.text.slice(0, Math.floor(d.shown)), w - (tx-x) - 24);
  lines.forEach((l,i) => { const jx = d.shout ? (Math.random()-0.5)*3 : 0, jy = d.shout ? (Math.random()-0.5)*3 : 0; HT(l, tx+jx, y+(who?62:46)+i*28+jy, size, d.shout ? '#ff5a4a' : '#efe3cf'); });
  if (d.shown >= d.text.length && Math.floor(performance.now()/400)%2) HT('ENTER', x+w-18, y+h-12, 14, '#ffe14a', 'right');
}
function drawIntroHUD(){
  IN.ui = [];
  if (state === 'card'){
    const c = IN.card, caps = PANELS[c.page].caps; let ty = 44, by = DH-46;
    caps.forEach(([txt, anchor, col], i) => {                            // comic caption boxes; layout is fixed so nothing jumps as they pop in
      dctx.font = 'bold 19px "Courier New",monospace';
      const lines = wrapText(txt, 540).map(l => l.trim()), w = Math.max(...lines.map(l => dctx.measureText(l).width)) + 30, h = lines.length*25 + 16;
      let x, y; if (anchor === 'br'){ x = DW-44-w; y = by-h; by -= h+12; } else { x = 44 + (i%2)*26; y = ty; ty += h+12; }
      if (c.t < 0.35 + i*CAP_GAP) return;
      HR(x+6,y+6,w,h,'rgba(0,0,0,.55)'); HR(x-3,y-3,w+6,h+6,NAVY); HR(x,y,w,h,col || '#efe3cf');
      lines.forEach((l,j) => HT(l, x+15, y+29+j*25, 19, NAVY));
    });
    HT('ESC: skip intro', DW-22, 21, 12, '#a3aab8', 'right');
    HT((c.page+1)+' / '+PANELS.length, DW-22, DH-7, 13, '#a3aab8', 'right');
    if (c.t >= 0.35 + (caps.length-1)*CAP_GAP && Math.floor(performance.now()/450)%2) HT('CLICK / ENTER', DW/2, DH-7, 13, '#ffe14a', 'center');
    return;
  }
  if (!IN.creator && !IN.weaponUI && !IN.nameMode) HT('HOLD F: fast-forward    ESC: skip intro', DW-16, 24, 13, keys.KeyF ? '#ffe14a' : '#a3aab8', 'right');
  if (IN.creator){
    dctx.save(); dctx.beginPath(); dctx.rect(520,28,408,476); dctx.clip(); dctx.imageSmoothingEnabled = false;
    if ((IN.crTab||0) === 0){ const b = bustCanvas(CHAR); dctx.drawImage(b, 724-b.width*3, 512-b.height*6, b.width*6, b.height*6); }          // detailed portrait while editing the head
    else { const cv = figureCanvas(CHAR); dctx.fillStyle = 'rgba(0,0,0,.25)'; dctx.beginPath(); dctx.ellipse(724,498,70,10,0,0,6.3); dctx.fill(); dctx.drawImage(cv, 724-cv.width*1.5, 500-cv.height*3, cv.width*3, cv.height*3); }
    dctx.restore();
    HR(24,20,480,506,'rgba(18,10,16,.8)'); HT('MIRROR', 44, 58, 34, '#ffe14a');
    CR_PAGES.forEach((pg,ti) => {
      const tx = 260+ti*116, on = (IN.crTab||0) === ti;
      HR(tx,32,108,30,NAVY); HR(tx+2,34,104,26, on ? '#e0a050' : '#3f4658'); HT(pg.name, tx+54, 54, 16, on ? '#1b1f2e' : '#efe3cf', 'center');
      IN.ui.push({ x:tx,y:32,w:108,h:30, act:() => crTab(ti) });
    });
    HT('HEAD / OUTFIT tabs:  Q / E or TAB', 46, 82, 13, '#c9cdd6');
    crRows().forEach((r,i) => {
      const y = 96+i*crStep(), sel = IN.crRow === i, k = r[1], v = CHAR[k] ?? 0;
      HR(40,y,446,crStep()-2, sel ? '#5a6275' : '#2c3142'); HR(40,y,446,3, sel ? '#ffe14a' : '#3f4658');
      HT(r[0], 54, y+21, 15, '#efe3cf');
      const isCol = typeof r[2][0] === 'string' && r[2][0][0] === '#';
      HR(330,y+3,120,24,'#1f1018');
      if (isCol){ HR(342,y+7,96,16,NAVY); HR(344,y+9,92,12,r[2][v]); } else HT(r[2][v], 390, y+22, 14, '#ffe14a', 'center');
      HT('<', 318, y+23, 20, '#efe3cf', 'center'); HT('>', 462, y+23, 20, '#efe3cf', 'center');
      IN.ui.push({ x:300,y,w:50,h:30, act:() => { IN.crRow = i; crChange(i,-1); } }, { x:440,y,w:46,h:30, act:() => { IN.crRow = i; crChange(i,1); } }, { x:40,y,w:260,h:30, act:() => { IN.crRow = i; } });
    });
    const by = 96+crRows().length*crStep()+6;
    HR(40,by,200,38,NAVY); HR(42,by+2,196,34,'#3f4658'); HT('RANDOM', 140, by+27, 18, '#efe3cf', 'center');
    HR(262,by,224,38,NAVY); HR(264,by+2,220,34,'#e0a050'); HT('LOOKS GOOD', 374, by+27, 18, '#1b1f2e', 'center');
    IN.ui.push({ x:40,y:by,w:200,h:38, act:crRandom }, { x:262,y:by,w:224,h:38, act:() => { IN.creator = false; IN.creatorDone = true; saveChar(); } });
    HT('W/S pick  -  A/D change  -  ENTER done', 46, DH-8, 12, '#a3aab8');
  }
  if (IN.nameMode){
    HR(0,0,DW,DH,'rgba(18,10,16,.55)'); const x = 230, y = 190, w = 500, h = 160;
    HR(x-4,y-4,w+8,h+8,NAVY); HR(x,y,w,h,'#2c3142'); HR(x,y,w,5,'#e0a050');
    HT('YOUR NAME IS...', DW/2, y+44, 24, '#ffe14a', 'center');
    HR(x+30,y+66,w-60,46,NAVY); HR(x+33,y+69,w-66,40,'#1f1018');
    HT(IN.nameBuf + (Math.floor(performance.now()/400)%2 ? '_' : ' '), DW/2, y+99, 28, '#efe3cf', 'center');
    HT(IS_TOUCH ? 'TAP THE BOX, TYPE, THEN DONE' : 'Type a name  -  ENTER to confirm', DW/2, y+140, 14, '#a3aab8', 'center');
  }
  if (IN.cur && IN.cur.hub && !IN.dlg){
    const b = [IN.walletTaken ? 'WALLET: GOT IT' : 'WALLET: ?', IN.weaponTaken ? 'WEAPON: GOT IT' : 'WEAPON: ?'];
    HR(20,20,250,66,'rgba(18,10,16,.7)'); HT('BEFORE YOU GO', 32, 44, 15, '#ffe14a');
    HT(b[0], 32, 64, 14, IN.walletTaken ? '#3cff8a' : '#efe3cf'); HT(b[1], 32, 82, 14, IN.weaponTaken ? '#3cff8a' : '#efe3cf');
    IN.spots.forEach((s,i) => {
      const sel = IN.hubSel === i || (mouse.x>=s.x && mouse.x<=s.x+s.w && mouse.y>=s.y && mouse.y<=s.y+s.h);
      if (sel){ dctx.strokeStyle = '#ffe14a'; dctx.lineWidth = 3; dctx.strokeRect(s.x,s.y,s.w,s.h); }
      const bob = Math.sin(performance.now()/180)*4, lab = s.id.toUpperCase();
      HT(lab, s.x+s.w/2, s.y-14+bob, 16, sel ? '#ffe14a' : '#efe3cf', 'center'); HT('v', s.x+s.w/2, s.y-2+bob, 16, sel ? '#ffe14a' : '#efe3cf', 'center');
    });
    HT('Click an object  -  or  A/D + ENTER', DW/2, DH-16, 14, '#c9cdd6', 'center');
  }
  if (IN.freeOn){
    if (IN.objective){ dctx.font = 'bold 15px "Courier New",monospace'; const w = dctx.measureText(IN.objective).width + 28; HR(16,16,w,34,'rgba(18,10,16,.72)'); HR(16,16,w,3,'#ffe14a'); HT(IN.objective, 28, 39, 15, '#efe3cf'); }
    if (IN.freeLabel){ const [sx,sy] = P2(IN.pl.x, IN.pl.y, (IN.pl.z||0)+52); HT('E:  '+IN.freeLabel, sx*2, sy*2, 16, '#ffe14a', 'center'); }
    HT('WASD move   -   E interact   -   ESC skip', DW/2, DH-14, 12, '#a3aab8', 'center');
  }
  if (IN.title){ HR(0,0,DW,DH,'rgba(0,0,0,'+(0.0)+')'); dctx.globalAlpha = Math.max(0, IN.titleA||0); HT(IN.title, DW/2, DH/2-4, 44, '#ffe14a', 'center'); if (IN.titleSub) HT(IN.titleSub, DW/2, DH/2+36, 20, '#efe3cf', 'center'); dctx.globalAlpha = 1; }
  if (IN.weaponUI) drawWeaponUI();
  drawDialogue();
}
const WEAPONS = [
  { id:'sword', name:'SWORD', note:'Balanced. Fast 3-hit combo.', ok:true }, { id:'chain', name:'CHAIN', note:'', ok:false }, { id:'axe', name:'BATTLE AXE', note:'', ok:false },
  { id:'great', name:'GREATSWORD', note:'', ok:false }, { id:'gauntlet', name:'GAUNTLET', note:'', ok:false }, { id:'xbow', name:'AUTO CROSSBOWS', note:'', ok:false } ];
function weaponIcon(id, cx, cy, ok){
  const c = ok ? 1 : 0, col = (a,b) => ok ? a : b;
  if (id === 'sword'){ HR(cx-4,cy-46,8,64,NAVY); HR(cx-2,cy-44,4,60,col('#e8e6e0','#5a6275')); HR(cx,cy-44,2,60,col('#a3aab8','#3f4658')); HR(cx-16,cy+16,32,8,NAVY); HR(cx-14,cy+18,28,4,col('#e0a050','#4b5266')); HR(cx-4,cy+24,8,20,NAVY); HR(cx-2,cy+25,4,18,col('#8f5a3a','#3f4658')); }
  else if (id === 'chain'){ for (let i=0;i<5;i++){ HR(cx-18+i*8-(i%2?0:0),cy-30+i*14,16,10,NAVY); HR(cx-16+i*8,cy-28+i*14,12,6,col('#a3aab8','#3f4658')); } HR(cx+18,cy+34,16,16,NAVY); HR(cx+20,cy+36,12,12,col('#7d8597','#3f4658')); }
  else if (id === 'axe'){ HR(cx-3,cy-44,7,88,NAVY); HR(cx-1,cy-42,3,84,col('#8f5a3a','#3f4658')); HR(cx-30,cy-40,32,40,NAVY); HR(cx-28,cy-38,28,36,col('#c9cdd6','#4b5266')); HR(cx-28,cy-38,6,36,col('#e8e6e0','#5a6275')); }
  else if (id === 'great'){ HR(cx-8,cy-56,16,84,NAVY); HR(cx-5,cy-54,10,80,col('#e8e6e0','#5a6275')); HR(cx,cy-54,4,80,col('#a3aab8','#3f4658')); HR(cx-24,cy+26,48,10,NAVY); HR(cx-22,cy+28,44,6,col('#b5463f','#4b5266')); HR(cx-4,cy+36,8,22,NAVY); HR(cx-2,cy+37,4,20,col('#5e4f3c','#3f4658')); }
  else if (id === 'gauntlet'){ HR(cx-26,cy-4,52,44,NAVY); HR(cx-23,cy-1,46,38,col('#7d8597','#3f4658')); for (let i=0;i<4;i++){ HR(cx-23+i*12,cy-24,10,24,NAVY); HR(cx-21+i*12,cy-22,6,20,col('#a3aab8','#4b5266')); } HR(cx-30,cy+20,12,16,NAVY); HR(cx-28,cy+22,8,12,col('#a3aab8','#4b5266')); HR(cx-23,cy+34,46,8,col('#b5463f','#4b5266')); }
  else { HR(cx-32,cy-14,64,10,NAVY); HR(cx-30,cy-12,60,6,col('#8f5a3a','#3f4658')); HR(cx-6,cy-30,12,60,NAVY); HR(cx-4,cy-28,8,56,col('#a3aab8','#3f4658')); HR(cx-36,cy-26,8,36,NAVY); HR(cx+28,cy-26,8,36,NAVY); }
}
function drawWeaponUI(){
  HR(0,0,DW,DH,'rgba(18,10,16,.82)'); HT('THE CHEST', DW/2, 70, 40, '#ffe14a', 'center'); HT('Pick your weapon. Skills depend on the weapon.', DW/2, 100, 16, '#c9cdd6', 'center');
  WEAPONS.forEach((wp,i) => {
    const x = 24+i*156, y = 136, w = 146, h = 300, sel = wp.ok && (mouse.x>=x && mouse.x<=x+w && mouse.y>=y && mouse.y<=y+h || true);
    HR(x-4,y-4,w+8,h+8,NAVY); HR(x,y,w,h, wp.ok ? '#3f4658' : '#1f1018'); HR(x,y,w,5, wp.ok ? '#ffe14a' : '#2c3142');
    weaponIcon(wp.id, x+w/2, y+130, wp.ok);
    HT(wp.name, x+w/2, y+h-92, 15, wp.ok ? '#efe3cf' : '#5a6275', 'center');
    if (wp.ok){ dctx.font = 'bold 12px "Courier New",monospace'; const ls = wrapText(wp.note, w-24); ls.forEach((l,j) => HT(l.trim(), x+w/2, y+h-64+j*16, 12, '#c9cdd6', 'center')); HT('ENTER / CLICK', x+w/2, y+h-14, 13, '#ffe14a', 'center'); }
    else { HT('LOCKED', x+w/2, y+h-38, 15, '#7d8597', 'center'); HT('COMING SOON', x+w/2, y+h-18, 13, '#5a6275', 'center'); HR(x+w/2-14,y+40,28,20,'#5a6275'); HR(x+w/2-9,y+26,18,18,NAVY); HR(x+w/2-6,y+29,12,15,'#1f1018'); }
    IN.ui.push({ x,y,w,h, act: () => { if (wp.ok) IN.weaponPick = wp.id; else { tone('square', 120, 90, 0.15, 0.1); IN.shake = 0.3; } } });
  });
}

/* ============================ game over: "YOU WERE HIRED." ============================
   You, in a suit, typing in an BizNes Corp cubicle forever. A supervisor paces the aisle,
   coworkers peek over the partitions, the fluorescent light flickers. Drawn into the 2D buffer. */
const OFFICE = { suit:null, aliens:null };
function hiredStart(){
  OFFICE.suit = Object.assign({}, CHAR, { face:1, mouth:1, top:3, topCol:0, pattern:0, outer:1, outerCol:2, bottom:2, botCol:1, belt:1, shoes:1, shoeCol:2, acc:0, bag:0, gloves:0 });
  if (!OFFICE.aliens) OFFICE.aliens = [outlined(paintEnemyRaw('grunt','walk',0)), outlined(paintEnemyRaw('grunt','walk',1)), outlined(paintEnemyRaw('runner','walk',0)), outlined(paintEnemyRaw('thrower','walk',0))];
}
function drawCubicle(g, t){
  if (!OFFICE.suit) hiredStart();
  g.fillStyle = '#1f1018'; g.fillRect(0,0,480,270);
  floorTiles(g, '#6b7387', '#5a6275', '#4b5266');
  poly(g,[P2(0,0,0),P2(8,0,0),P2(8,0,WALLH),P2(0,0,WALLH)], '#c9bba0');
  poly(g,[P2(0,0,0),P2(0,6,0),P2(0,6,WALLH),P2(0,0,WALLH)], '#bfa985');
  wallR(g,0,8,0,6,'#5a6275'); wallL(g,0,6,0,6,'#5a6275');
  wallR(g,2.4,5.4,40,64,'#2c3142'); wallR(g,2.5,5.3,42,62,'#4a6b3c'); wallR(g,3.6,4.2,45,59,'#1b1f2e'); wallR(g,3.75,4.05,48,56,'#ffe14a');   // BizNes Corp eye banner
  const [cx,cy] = P2(6.6,0,54); g.fillStyle = NAVY; g.beginPath(); g.arc(cx,cy,7,0,6.3); g.fill(); g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(cx,cy,5.5,0,6.3); g.fill();
  g.strokeStyle = NAVY; g.lineWidth = 1; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(t*0.5)*4, cy+Math.sin(t*0.5)*4); g.stroke();
  wallL(g,1.5,4.5,24,60,'#8fb4d0'); for (let z=26;z<60;z+=4) wallL(g,1.5,4.5,z,z+2,'#c9cdd6',false);                            // window blinds
  const A = OFFICE.aliens, list = [];
  /* coworkers in the back cubicles: drawn first, partitions hide their bodies */
  list.push({ k:2.0, f:() => spr(g, A[2], 1.5, 0.9, 0, 0.5, false) });
  list.push({ k:2.3, f:() => boxC(g,0.4,1.2,0,2.2,0.1,28,'#7d8597') });
  list.push({ k:6.9, f:() => spr(g, A[3], 6.4, 0.9, 0, 0.5, true) });
  list.push({ k:7.2, f:() => boxC(g,5.4,1.2,0,2.2,0.1,28,'#7d8597') });
  /* your cubicle */
  list.push({ k:4.0, f:() => { boxC(g,2.8,1.6,0,2.4,0.1,30,'#8d94a3'); boxC(g,2.8,1.6,0,0.1,1.8,30,'#8d94a3'); } });   // back + left partitions sit behind you
  const typing = Math.floor(t/0.14)%2 === 0, pose = (t%6) > 5.2 ? 'eat0' : typing ? 'eat1' : 'sit';           // type, type, type... sip
  list.push({ k:6.7, f:() => spr(g, personCanvas(OFFICE.suit, pose, false), 4.0, 2.3, 0, ISO_SCALE, false) });
  list.push({ k:8.3, f:() => {
    boxC(g,3.1,2.7,0,1.8,0.6,20,'#8f7b5e','#a89f91');                                                     // desk
    boxC(g,3.15,2.72,20,0.55,0.2,14,'#2c3142');                                                         // monitor, off to the side so your face shows
    boxC(g,4.65,2.85,20,0.14,0.14,4,'#f4f1ea'); boxC(g,4.1,2.8,20,0.38,0.3,3,'#e8e6e0');                // mug, paperwork
    g.globalAlpha = 0.18 + 0.06*Math.sin(t*7); const [sx,sy] = P2(4.0,2.4,30); g.fillStyle = '#bcd6e8'; g.beginPath(); g.ellipse(sx,sy,14,9,0,0,6.3); g.fill(); g.globalAlpha = 1;   // screen glow on your face
  } });
  list.push({ k:8.5, f:() => boxC(g,5.1,1.6,0,0.1,1.8,30,'#8d94a3') });
  list.push({ k:5.8+0.9, f:() => { boxC(g,0.25,5.25,0,0.5,0.5,10,'#b5463f'); for (const [lx,ly,lz] of [[0.3,5.3,14],[0.55,5.2,18],[0.4,5.5,22]]) boxC(g,lx,ly,lz,0.25,0.25,6,'#4a6b3c'); } });   // plant
  /* the supervisor paces the aisle */
  const ph = t*0.35, sxw = 1.2 + 5.6*(0.5 - 0.5*Math.cos(ph)), dir = Math.sin(ph) >= 0;
  list.push({ k:sxw+4.4+0.4, f:() => spr(g, A[Math.floor(t*5)%2], sxw, 4.4, 0, ISO_SCALE, !dir) });
  list.sort((a,b) => a.k-b.k).forEach(o => o.f());
  if (Math.sin(t*23) > 0.96 || (t%4 > 3.9)){ g.globalAlpha = 0.14; g.fillStyle = '#1b1f2e'; g.fillRect(0,0,480,270); g.globalAlpha = 1; }   // tired fluorescent flicker
  if (t < 1.2){ g.globalAlpha = 1 - t/1.2; g.fillStyle = '#000'; g.fillRect(0,0,480,270); g.globalAlpha = 1; }
}