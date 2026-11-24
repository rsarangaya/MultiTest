"use strict";
/* ============================================================================
   SPRITES  -  BizNes Corp alien enemies (corporate stooges) + the customizable person
   (player, mom).  Raw pixel painters; outlined() from art.js adds the navy outline.
   ============================================================================ */

/* ---------- enemies: aliens in office wear ---------- */
const ENEMY_COL = {
  grunt:  { skin:'#8fa66a', skin2:'#6b8650', suit:'#2c3142', suit2:'#3f4658', shirt:'#e8e6e0', tie:'#b5463f', shoe:'#1b1f2e', bulb:'#ffe14a' },
  runner: { skin:'#bcd6e8', skin2:'#8fb4d0', suit:'#5a6275', suit2:'#7d8597', shirt:'#e8e6e0', tie:'#ffe14a', shoe:'#1b1f2e', bulb:'#ff5a4a' },
  thrower:{ skin:'#a89f91', skin2:'#8d94a3', suit:'#4a3f66', suit2:'#6b3a5c', shirt:'#e8e6e0', tie:'#b5463f', shoe:'#1b1f2e', bulb:'#3cff8a' },
};
function paintEnemyRaw(kind, state, frame){
  if (kind === 'boss') return paintBossRaw(state, frame);
  if (kind === 'counselor') return paintCounselorRaw(state, frame);
  if (kind === 'inspector') return paintInspectorRaw(state, frame);
  const c = mkCanvas(32,64), g = c.getContext('2d'), k = ENEMY_COL[kind];
  const walk = state === 'walk', lean = state === 'hurt' ? -2 : 0, bob = walk && frame ? 1 : 0;
  const up = state === 'windup', out = state === 'attack', s = walk ? (frame ? 3 : -3) : 0, hot = up || out;
  px(g,10+s,45,5,13,k.suit); px(g,17-s,45,5,13,k.suit); px(g,9+s,57,7,4,k.shoe); px(g,16-s,57,7,4,k.shoe);   // legs + shoes
  px(g,8+lean,23+bob,16,23,k.suit); px(g,8+lean,23+bob,3,23,k.suit2); px(g,21+lean,23+bob,3,23,NAVY);          // jacket
  px(g,13+lean,23+bob,6,11,k.shirt); px(g,15+lean,24+bob,2,13,k.tie); px(g,14+lean,36+bob,4,2,k.tie);          // shirt + tie
  px(g,12+lean,23+bob,1,9,'#5f89ab'); px(g,19+lean,23+bob,1,9,'#5f89ab');                                      // lanyard
  px(g,18+lean,32+bob,5,6,NAVY); px(g,19+lean,33+bob,3,4,'#e8e6e0'); px(g,19+lean,33+bob,3,1,'#5f89ab');       // ID badge
  if (up){ px(g,3,9+bob,4,16,k.suit); px(g,25,9+bob,4,16,k.suit); px(g,3,5+bob,4,5,k.skin); px(g,25,5+bob,4,5,k.skin); }
  else if (out){ px(g,1,25,9,4,k.suit); px(g,22,25,9,4,k.suit); px(g,0,24,3,6,k.skin); px(g,29,24,3,6,k.skin); }
  else { px(g,4+lean,24+bob,4,18,k.suit); px(g,24+lean,24+bob,4,18,k.suit); px(g,4+lean,42+bob,4,4,k.skin); px(g,24+lean,42+bob,4,4,k.skin); }
  px(g,13+lean,21+bob,6,3,k.skin2);                                                                              // neck
  const hx = lean, hy = bob + 2;                                                                                 // egg-shaped alien head
  px(g,11+hx,1+hy,10,3,k.skin); px(g,8+hx,4+hy,16,13,k.skin); px(g,10+hx,17+hy,12,3,k.skin); px(g,12+hx,20+hy,8,1,k.skin);
  px(g,22+hx,5+hy,2,11,k.skin2); px(g,11+hx,19+hy,10,1,k.skin2);
  for (const [ex,ey,ew,eh] of [[9,9,3,3],[11,11,3,3],[13,13,2,2]]){ px(g,ex+hx,ey+hy,ew,eh,NAVY); px(g,31-ex-ew+1+hx,ey+hy,ew,eh,NAVY); }   // big slanted black eyes
  px(g,10+hx,9+hy,1,1,'#fff'); px(g,21+hx,9+hy,1,1,'#fff');
  px(g,12+hx,-0+hy-1,1,2,k.skin2); px(g,19+hx,-0+hy-1,1,2,k.skin2); px(g,11+hx,hy-2,3,2,k.bulb); px(g,18+hx,hy-2,3,2,k.bulb);   // antennae
  if (hot) px(g,13+hx,17+hy,6,3,'#7a2a30'); else px(g,14+hx,18+hy,4,1,NAVY);
  if (kind === 'thrower'){ px(g,24,22,9,12,NAVY); px(g,25,23,7,10,'#e8e6e0'); px(g,26,25,5,1,'#7d8597'); px(g,26,27,5,1,'#7d8597'); px(g,26,29,3,3,'#b5463f'); }
  return c;
}

/* ---------- the person: player + mom (40x76 canvas, feet at y=76, centre x=20) ---------- */
const SKIN_C  = ['#f1c27d','#e0a878','#c98f62','#a8714a','#7a4e34','#f6d5b8'];
const HAIR_C  = ['#1b1f2e','#3d2b1f','#8f5a3a','#e0a050','#b5463f','#5f89ab','#e8e6e0','#f2b8b0'];
const TOP_C   = ['#f4f1ea','#b5463f','#3f5f82','#4a6b3c','#e0a050','#2c3142','#f2b8b0','#8a7aa8'];
const BOT_C   = ['#5f89ab','#2c3142','#8f7b5e','#5a6275','#b5463f','#4a6b3c'];
const SHOE_C  = ['#b5463f','#e8e6e0','#2c3142','#e0a050','#3f5f82','#4a6b3c'];
const ACC_C   = ['#b5463f','#3f5f82','#e0a050','#4a6b3c','#f2b8b0','#e8e6e0'];
const OUTER_C = ['#5f89ab','#8f7b5e','#2c3142','#b5463f','#4a6b3c','#e0a050'];
const GLOVE_C = ['', '#2c3142', '#5e4f3c'];
const PERSON_COUNTS = { hair:6, hairCol:8, skin:6, face:4, eyes:6, brows:4, mouth:4, facial:4, marks:4, top:5, topCol:8, pattern:4, outer:4, outerCol:6,
                        bottom:3, botCol:6, belt:3, acc:6, accCol:6, shoes:4, shoeCol:6, gloves:3, bag:3 };
const EYE_C = ['#5f89ab','#3d2b1f','#4a6b3c','#8f5a3a','#1b1f2e','#8a7aa8'];
function shade(hex, f){
  const n = parseInt(hex.slice(1),16), m = v => Math.max(0, Math.min(255, Math.round(v*f)));
  return '#'+((1<<24)|(m(n>>16&255)<<16)|(m(n>>8&255)<<8)|m(n&255)).toString(16).slice(1);
}
function paintPerson(o, pose, back){
  const c = mkCanvas(40,76), g = c.getContext('2d');
  const r = (x,y,w,h,col) => px(g,x+4,y+12,w,h,col);
  const S = SKIN_C[o.skin], Hc = HAIR_C[o.hairCol], Tc = TOP_C[o.topCol], Bc = BOT_C[o.botCol], Sc = SHOE_C[o.shoeCol], Ac = ACC_C[o.accCol||0];
  const sit = pose.startsWith('sit') || pose.startsWith('eat'), dy = sit ? 10 : 0;
  const ws = pose === 'walk0' ? 3 : pose === 'walk1' ? -3 : 0;
  /* legs + shoes */
  if (!sit){
    const lt = 46, lb = o.bottom === 1 ? 53 : 58;
    r(9+ws,lt,6,lb-lt,Bc); r(17-ws,lt,6,lb-lt,Bc);
    if (o.bottom === 1){ r(9+ws,53,6,5,S); r(17-ws,53,6,5,S); }
    if (o.bottom === 2){ r(11+ws,lt,1,lb-lt,shade(Bc,.8)); r(19-ws,lt,1,lb-lt,shade(Bc,.8)); }
    for (const fx of [9+ws, 17-ws]){
      if (o.shoes === 0){ r(fx-1,58,8,5,Sc); r(fx-1,61,8,2,'#e8e6e0'); }
      else if (o.shoes === 1){ r(fx,54,6,9,Sc); r(fx-1,61,8,2,shade(Sc,.6)); }
      else if (o.shoes === 2){ r(fx-1,55,8,8,Sc); r(fx-1,60,8,3,'#e8e6e0'); r(fx-1,55,8,1,'#e8e6e0'); }
      else { r(fx,58,6,3,S); r(fx-1,61,8,2,'#e8e6e0'); }
    }
  } else { r(9,57,6,4,Bc); r(17,57,6,4,Bc); r(8,61,8,3,Sc); r(16,61,8,3,Sc); }
  /* torso + top */
  const Oc = OUTER_C[o.outerCol||0], HC = o.gloves ? GLOVE_C[o.gloves] : S;
  const armC = o.outer ? (o.outer === 3 ? '#efe3cf' : Oc) : (o.top === 4 ? shade(Tc,.75) : Tc), longSleeve = o.top !== 1 || !!o.outer;
  r(8,24+dy,16,22,o.top === 4 ? shade(Tc,.75) : Tc);
  if (o.top === 0){ r(14,30+dy,4,4,'#ffe14a'); r(15,28+dy,2,8,'#ffe14a'); r(12,31+dy,8,2,'#ffe14a'); }   // graphic tee: bolt-star
  if (o.top === 2){ r(9,21+dy,14,5,shade(Tc,.7)); r(11,38+dy,10,6,shade(Tc,.85)); r(14,26+dy,1,6,'#e8e6e0'); r(17,26+dy,1,6,'#e8e6e0'); }
  if (o.top === 3){ r(12,24+dy,3,3,'#fff'); r(17,24+dy,3,3,'#fff'); r(15,26+dy,2,12,'#b5463f'); r(14,38+dy,4,2,'#b5463f'); }
  if (o.top === 4){ r(13,24+dy,6,22,'#e8e6e0'); r(15,24+dy,2,22,shade(Tc,.5)); }
  if (o.pattern === 1) for (let i=0;i<5;i++) r(8,26+dy+i*4,16,1,shade(Tc,.65));
  if (o.outer){ const L = 22 + (o.outer === 2 ? 8 : 0); r(8,24+dy,5,L,Oc); r(19,24+dy,5,L,Oc); }
  if (o.belt) r(8,44+dy,16,2,'#5e4f3c');
  if (o.bag === 1){ r(10,24+dy,2,14,'#3f4658'); r(20,24+dy,2,14,'#3f4658'); } else if (o.bag === 2){ for (let i=0;i<14;i++) r(9+i,25+dy+i,2,1,'#5e4f3c'); }
  if (o.apron){ r(9,31+dy,14,15,'#f4f1ea'); r(11,25+dy,2,7,'#f4f1ea'); r(19,25+dy,2,7,'#f4f1ea'); r(13,36+dy,6,4,'#e8e6e0'); }
  let la = 24+dy+(ws>0?-1:ws<0?1:0), ra = 24+dy+(ws>0?1:ws<0?-1:0);
  const arm = (x,y,len) => { r(x,y+1,4,len,armC); if (o.top === 0 || o.top === 2) r(x,y+len-1,4,2,shade(armC,.7)); if (longSleeve) r(x,y+len+1,4,4,HC); else { r(x,y+len-8,4,9,S); r(x,y+len+1,4,4,HC); } };
  if (pose === 'eat0'){ arm(4,25+dy,16); r(22,16+dy,4,13,armC); r(21,13+dy,4,4,S); r(17,12+dy,4,1,'#e8e6e0'); }
  else if (pose === 'eat1'){ arm(4,25+dy,16); r(23,34+dy,4,9,armC); r(21,42+dy,4,4,S); r(16,44+dy,5,1,'#e8e6e0'); }
  else if (pose === 'reach'){ arm(4,la,16); r(24,23,10,4,armC); r(33,22,4,5,S); }
  else if (pose === 'holdsword'){
    arm(4,la,16); r(24,18,4,10,armC); r(24,15,4,4,S);
    r(25,8,2,8,'#8f5a3a'); r(22,7,8,2,'#a3aab8'); r(25,-10,3,17,'#e8e6e0'); r(27,-10,1,17,'#a3aab8'); r(25,-12,3,2,'#e8e6e0');
  } else { arm(4,la,16); arm(24,ra,16); }
  r(13,22+dy,6,3,S);                                                                           // neck
  const hy = dy;
  /* head + face */
  r(9,7+hy,14,15,S); r(10,22+hy,12,1,S); r(8,13+hy,1,4,S); r(23,13+hy,1,4,S);
  if (!back){
    if (o.face === 0){ r(10,12+hy,5,5,'#fff'); r(17,12+hy,5,5,'#fff'); r(12,13+hy,2,3,NAVY); r(19,13+hy,2,3,NAVY); r(10,10+hy,5,1,NAVY); r(17,10+hy,5,1,NAVY); r(14,19+hy,4,2,'#7a2a30'); }
    else if (o.face === 1){   // tired: heavy grey lids + bags, like the show's hero
      r(10,13+hy,5,4,'#fff'); r(17,13+hy,5,4,'#fff'); r(12,14+hy,2,2,NAVY); r(19,14+hy,2,2,NAVY);
      r(10,12+hy,5,2,'#8d94a3'); r(17,12+hy,5,2,'#8d94a3'); r(10,17+hy,5,1,'#8d94a3'); r(17,17+hy,5,1,'#8d94a3'); r(14,20+hy,4,1,'#7a2a30'); }
    else if (o.face === 2){ r(10,13+hy,4,4,'#fff'); r(18,13+hy,4,4,'#fff'); r(12,14+hy,2,3,NAVY); r(18,14+hy,2,3,NAVY);
      r(10,11+hy,2,1,NAVY); r(12,12+hy,2,1,NAVY); r(20,11+hy,2,1,NAVY); r(18,12+hy,2,1,NAVY); r(14,20+hy,5,1,'#7a2a30'); r(19,19+hy,1,1,'#7a2a30'); }
    else { r(10,15+hy,1,1,NAVY); r(11,14+hy,2,1,NAVY); r(13,15+hy,1,1,NAVY); r(18,15+hy,1,1,NAVY); r(19,14+hy,2,1,NAVY); r(21,15+hy,1,1,NAVY);
      r(13,19+hy,6,2,'#7a2a30'); r(14,19+hy,4,1,'#fff'); r(9,17+hy,2,1,'#e08f8a'); r(21,17+hy,2,1,'#e08f8a'); }
  }
  /* hair */
  if (back){ r(8,3+hy,16,19,Hc); if (o.hair === 3){ r(7,8+hy,4,26,Hc); r(21,8+hy,4,26,Hc); } }
  else if (o.hair === 0){ r(8,3+hy,16,8,Hc); r(7,7+hy,3,10,Hc); r(22,7+hy,3,10,Hc); r(12,0+hy,4,4,Hc); r(18,1+hy,4,3,Hc); r(10,11+hy,4,2,Hc); r(17,11+hy,3,2,Hc); r(6,8+hy,2,3,Hc); }
  else if (o.hair === 1){ r(9,4+hy,14,7,Hc); r(9,10+hy,2,5,Hc); r(21,10+hy,2,5,Hc); }
  else if (o.hair === 2){ r(9,5+hy,14,6,Hc); for (const x of [9,12,15,18,21]) r(x,1+hy+(x%2?1:0),3,5,Hc); }
  else if (o.hair === 3){ r(8,3+hy,16,8,Hc); r(7,8+hy,4,26,Hc); r(21,8+hy,4,26,Hc); }
  else if (o.hair === 4){ r(9,5+hy,14,4,shade(Hc,.9)); }
  else if (o.hair === 5){ r(8,3+hy,16,6,Hc); r(8,9+hy,6,5,Hc); r(18,9+hy,6,5,Hc); r(7,8+hy,2,10,Hc); r(23,8+hy,2,10,Hc); }
  else { r(9,4+hy,14,7,Hc); r(9,10+hy,2,5,Hc); r(21,10+hy,2,5,Hc); r(12,-2+hy,8,5,Hc); r(10,1+hy,12,2,Hc); }   // mom's bun
  /* accessories */
  if (o.acc === 1 && !back){ r(9,11+hy,7,1,NAVY); r(9,16+hy,7,1,NAVY); r(9,11+hy,1,6,NAVY); r(15,11+hy,1,6,NAVY); r(16,13+hy,1,1,NAVY); r(17,11+hy,7,1,NAVY); r(17,16+hy,7,1,NAVY); r(17,11+hy,1,6,NAVY); r(23,11+hy,1,6,NAVY); }
  if (o.acc === 2){ r(8,9+hy,16,2,Ac); r(23,9+hy,3,4,Ac); }
  if (o.acc === 3){ r(8,1+hy,16,8,Ac); r(6,8+hy,20,2,shade(Ac,.8)); }
  if (o.acc === 4){ r(8,16+hy,1,2,'#ffe14a'); }
  if (o.acc === 5){ r(9,22+hy,14,4,Ac); r(20,25+hy,3,8,Ac); }
  return c;
}
/* ---------- detailed head (shared by the portrait and the full-body figure) ---------- */
function drawHead(g, o, oy){
  const r = (x,y,w,h,col) => px(g,x,y+oy,w,h,col), cx = 32;
  const S = SKIN_C[o.skin], S1 = shade(S,1.1), S2 = shade(S,.86), S3 = shade(S,.7);
  const Hc = HAIR_C[o.hairCol], H1 = shade(Hc,1.6), H2 = shade(Hc,.7), Ec = EYE_C[o.eyes||0], Ac = ACC_C[o.accCol||0], LIP = '#7a2a30';
  for (let y=8;y<=46;y++){                                                            // rounded top, tapering chin, 3-tone shading
    const t = (y-8)/38, ct = t-0.4, hw = ct < 0 ? 14*Math.sqrt(Math.max(0,1-(ct/0.45)*(ct/0.45))) : 14*(1-ct*0.85), w = Math.max(2,Math.round(hw));
    r(cx-w,y,w*2,1,S); r(cx+w-4,y,4,1,S2); r(cx-w,y,2,1,S1);
  }
  r(cx-17,26,3,8,S); r(cx+14,26,3,8,S); r(cx-16,28,1,4,S2); r(cx+15,28,1,4,S2);       // ears
  r(cx-10,33,6,3,S1); r(cx+4,33,6,2,S1);                                              // cheek light
  const ey = 27, eye = (ex, side) => {
    const blind = o.marks === 2 && side > 0, ic = blind ? '#c9cdd6' : Ec, pc = blind ? '#e8e6e0' : NAVY;   // scarred eye: milky, no pupil
    if (o.face === 0){ r(ex-4,ey-3,8,6,'#fff'); r(ex-2,ey-2,4,5,ic); r(ex-1,ey-1,2,3,pc); if (!blind) r(ex-1,ey-2,1,1,'#fff'); r(ex-4,ey-4,8,1,NAVY); }
    else if (o.face === 1){ r(ex-4,ey-2,8,5,'#fff'); r(ex-2,ey-1,4,4,ic); r(ex-1,ey,2,2,pc); r(ex-4,ey-3,8,3,S2); r(ex-4,ey-3,8,1,NAVY); r(ex-4,ey+3,8,1,S3); }
    else if (o.face === 2){ r(ex-4,ey-2,8,5,'#fff'); r(ex-2,ey-1,4,4,ic); r(ex-1,ey,2,2,pc); if (!blind) r(ex-1,ey-1,1,1,'#fff'); r(ex-4,ey-3,8,1,NAVY); r(ex+(side>0?1:-4),ey-2,3,1,NAVY); }
    else { r(ex-4,ey+1,2,1,NAVY); r(ex-3,ey,6,1,NAVY); r(ex+2,ey+1,2,1,NAVY); r(ex-3,ey+1,6,1,S3); }
  };
  eye(cx-7,1); eye(cx+7,-1);
  for (const [ex,side] of [[cx-7,1],[cx+7,-1]]){                                       // brows sit just above the eyes
    if (o.brows === 0) r(ex-5,22,10,1,H2); else if (o.brows === 1) r(ex-5,21,10,2,H2);
    else if (o.brows === 2){ for (let i=0;i<3;i++) r(ex-5+(side>0 ? i*3 : (2-i)*3), 21+i, 4, 1, H2); }
    else { r(ex-5,23,2,1,H2); r(ex-3,22,6,1,H2); r(ex+3,23,2,1,H2); }
  }
  r(cx-1,30,2,7,S2); r(cx,30,1,5,S1); r(cx-2,37,4,2,S3); r(cx-2,36,1,1,S1);          // nose
  if (o.mouth === 0){ r(cx-4,41,8,1,LIP); r(cx-5,40,1,1,LIP); r(cx+4,40,1,1,LIP); r(cx-3,42,6,1,'#e08f8a'); }
  else if (o.mouth === 1){ r(cx-4,41,8,1,LIP); r(cx-3,42,6,1,'#e08f8a'); }
  else if (o.mouth === 2){ r(cx-4,41,7,1,LIP); r(cx+3,40,2,1,LIP); r(cx-3,42,5,1,'#e08f8a'); }
  else { r(cx-4,40,8,5,LIP); r(cx-3,40,6,1,'#fff'); r(cx-2,43,4,2,'#c9485a'); }
  if (o.facial === 1){ g.globalAlpha = 0.55; for (let y=37;y<46;y++) for (let x=cx-10+(y%2);x<cx+11;x+=2) r(x,y,1,1,H2); g.globalAlpha = 1; }
  else if (o.facial === 2){ r(cx-6,38,12,2,Hc); r(cx-7,39,2,2,Hc); r(cx+5,39,2,2,Hc); r(cx-5,38,10,1,H1); }
  else if (o.facial === 3){ r(cx-3,43,6,5,Hc); r(cx-5,38,10,1,Hc); r(cx-2,43,3,1,H1); }
  if (o.marks === 1){ for (const [x,y] of [[cx-9,32],[cx-7,34],[cx-11,35],[cx+8,32],[cx+6,34],[cx+10,35]]) r(x,y,1,1,S3); }
  else if (o.marks === 2){   // scar runs brow -> cheek but skips the eye itself
    for (let i=0;i<20;i++){ const y = 17+i; if (y >= ey-3 && y <= ey+3) continue; const x = cx-10+Math.floor(i*0.3); r(x,y,1,1,'#c9485a'); r(x-1,y,1,1,S3); }
    r(cx-9,ey-4,2,1,'#c9485a'); r(cx-8,ey+3,2,1,'#c9485a'); }
  else if (o.marks === 3){ g.globalAlpha = 0.6; r(cx-12,34,5,2,'#e08f8a'); r(cx+7,34,5,2,'#e08f8a'); g.globalAlpha = 1; }
  const hr = o.hair;                                                                   // hair, with highlight strands
  if (hr === 0){ r(cx-15,6,30,10,Hc); r(cx-16,12,5,16,Hc); r(cx+11,12,5,16,Hc); r(cx-8,2,6,6,Hc); r(cx+2,3,6,5,Hc); r(cx-14,5,5,5,Hc); r(cx-10,15,8,3,Hc); r(cx+3,15,7,4,Hc); r(cx-3,16,4,3,Hc); r(cx-6,8,5,1,H1); r(cx+3,6,4,1,H1); r(cx-12,10,3,1,H1); r(cx-15,16,30,1,H2); }
  else if (hr === 1){ r(cx-14,7,28,9,Hc); r(cx-15,13,3,10,Hc); r(cx+12,13,3,10,Hc); r(cx-12,15,24,2,Hc); r(cx-8,9,8,1,H1); r(cx+4,10,5,1,H1); r(cx-14,16,28,1,H2); }
  else if (hr === 2){ r(cx-14,8,28,8,Hc); for (let i=-3;i<=3;i++){ r(cx+i*4-2,2+(i%2?1:0)+(Math.abs(i)>2?2:0),4,8,Hc); r(cx+i*4-1,3+(i%2?1:0)+(Math.abs(i)>2?2:0),1,4,H1); } r(cx-15,13,3,9,Hc); r(cx+12,13,3,9,Hc); r(cx-14,15,28,1,H2); }
  else if (hr === 3){ r(cx-15,6,30,10,Hc); r(cx-17,10,6,50,Hc); r(cx+11,10,6,50,Hc); r(cx-12,14,24,3,Hc); r(cx-8,8,6,1,H1); r(cx-15,22,2,30,H1); r(cx+13,22,2,30,H2); }
  else if (hr === 4){ g.globalAlpha = 0.85; r(cx-13,9,26,5,H2); r(cx-14,13,2,8,H2); r(cx+12,13,2,8,H2); g.globalAlpha = 1; }
  else if (hr === 5){ r(cx-15,6,30,16,Hc); r(cx-16,10,4,24,Hc); r(cx+12,10,4,24,Hc); r(cx-7,6,5,1,H1); r(cx+3,7,6,1,H1); r(cx-2,14,2,8,H2); r(cx-15,21,30,1,H2); }
  else { r(cx-14,7,28,9,Hc); r(cx-15,13,3,10,Hc); r(cx+12,13,3,10,Hc); r(cx-12,15,24,2,Hc); r(cx-6,1,12,8,Hc); r(cx-8,3,16,4,Hc); r(cx-4,2,5,1,H1); }
  if (o.acc === 2){ r(cx-15,17,30,3,Ac); r(cx-15,20,30,1,shade(Ac,.7)); r(cx+14,16,5,6,Ac); r(cx+17,21,3,6,shade(Ac,.8)); }
  if (o.acc === 3){ r(cx-16,4,32,12,Ac); r(cx-16,4,32,2,shade(Ac,1.2)); r(cx-20,15,40,3,shade(Ac,.75)); }
  if (o.acc === 1){ g.globalAlpha = 0.3; r(cx-12,ey-3,10,6,'#bcd6e8'); r(cx+2,ey-3,10,6,'#bcd6e8'); g.globalAlpha = 1;
    for (const ex of [cx-7,cx+7]){ r(ex-6,ey-4,12,1,NAVY); r(ex-6,ey+3,12,1,NAVY); r(ex-6,ey-4,1,8,NAVY); r(ex+5,ey-4,1,8,NAVY); } r(cx-1,ey-1,2,1,NAVY); r(cx-18,ey-3,2,1,NAVY); r(cx+16,ey-3,2,1,NAVY); }
  if (o.acc === 4) r(cx-17,34,2,3,'#ffe14a');
}

/* ---------- waist-up portrait (64x72): creator HEAD tab + dialogue boxes ---------- */
function paintBust(o){
  const c = mkCanvas(64,72), g = c.getContext('2d'), r = (x,y,w,h,col) => px(g,x,y,w,h,col), cx = 32;
  const S = SKIN_C[o.skin], S2 = shade(S,.86), S3 = shade(S,.7), Tc = TOP_C[o.topCol], T2 = shade(Tc,.8), T3 = shade(Tc,.62), Ac = ACC_C[o.accCol||0], Oc = OUTER_C[o.outerCol||0];
  for (let y=52;y<72;y++){ const hw = Math.round(17+(y-52)*1.6); r(cx-hw,y,hw*2,1,Tc); r(cx+hw-9,y,9,1,T2); r(cx-hw,y,2,1,shade(Tc,1.12)); }
  if (o.pattern === 1) for (let y=56;y<72;y+=5) r(cx-30,y,60,2,T3); else if (o.pattern === 2){ for (let y=56;y<72;y+=6) r(cx-30,y,60,1,T3); for (let x=cx-28;x<cx+30;x+=6) r(x,54,1,18,T3); }
  r(26,44,12,10,S2); r(26,44,12,3,S3);                                              // neck + chin shadow
  if (o.top === 2){ r(15,49,34,7,T2); r(14,51,36,2,T3); r(27,56,2,12,'#e8e6e0'); r(36,56,2,12,'#e8e6e0'); r(26,67,4,2,'#e8e6e0'); r(35,67,4,2,'#e8e6e0'); r(20,64,24,6,T2); }
  else if (o.top === 3){ r(21,51,10,8,'#f4f1ea'); r(33,51,10,8,'#f4f1ea'); r(21,58,10,1,'#c9cdd6'); r(33,58,10,1,'#c9cdd6'); r(30,56,4,3,'#7a2a30'); r(30,59,4,13,'#b5463f'); r(31,59,1,13,'#e08f8a'); }
  else if (o.top === 4){ r(24,52,16,20,'#e8e6e0'); r(15,52,10,20,T3); r(39,52,10,20,T3); r(25,52,1,20,'#a3aab8'); r(38,52,1,20,'#a3aab8'); r(31,60,2,12,'#7d8597'); }
  else { r(23,51,18,3,T3); r(25,54,14,1,T2); if (o.top === 0){ r(30,60,4,4,'#ffe14a'); r(31,58,2,8,'#ffe14a'); r(28,61,8,2,'#ffe14a'); } }
  if (o.pattern === 3){ r(cx+6,58,6,6,'#e8e6e0'); r(cx+7,59,4,4,'#b5463f'); }
  if (o.outer){ for (let y=50;y<72;y++){ const hw = Math.round(17+(y-52)*1.6); r(cx-hw,y,hw-7,1,Oc); r(cx+8,y,hw-8,1,y%4 ? Oc : shade(Oc,.85)); }
    r(cx-10,48,5,8,shade(Oc,1.15)); r(cx+5,48,5,8,shade(Oc,1.15)); if (o.outer === 3){ r(cx-20,62,6,7,'#efe3cf'); } }
  if (o.bag === 1){ r(cx-12,52,3,20,'#3f4658'); r(cx+9,52,3,20,'#3f4658'); } else if (o.bag === 2){ for (let i=0;i<20;i++) r(cx-14+i*1.4|0,52+i,3,1,'#5e4f3c'); }
  if (o.acc === 5){ r(cx-14,47,28,8,Ac); r(cx-14,53,28,2,shade(Ac,.7)); r(cx+6,54,6,14,Ac); r(cx+6,66,6,2,shade(Ac,.7)); }
  drawHead(g, o, 0);
  return c;
}
const bustCache = {};
function bustCanvas(o){
  const key = [o.hair,o.hairCol,o.skin,o.face,o.eyes,o.brows,o.mouth,o.facial,o.marks,o.top,o.topCol,o.pattern,o.outer,o.outerCol,o.bag,o.acc,o.accCol].join();
  return bustCache[key] || (bustCache[key] = outlined(paintBust(o)));
}

/* ---------- detailed full-body figure (64x152): creator OUTFIT tab ---------- */
function paintFigure(o){
  const c = mkCanvas(64,152), g = c.getContext('2d'), r = (x,y,w,h,col) => px(g,Math.round(x),Math.round(y),w,h,col), cx = 32;
  const S = SKIN_C[o.skin], S2 = shade(S,.86), S3 = shade(S,.7), Tc = TOP_C[o.topCol], T2 = shade(Tc,.8), T3 = shade(Tc,.62);
  const Bc = BOT_C[o.botCol], B2 = shade(Bc,.78), B1 = shade(Bc,1.2), Sc = SHOE_C[o.shoeCol], Oc = OUTER_C[o.outerCol||0], Ac = ACC_C[o.accCol||0];
  const HC = o.gloves ? GLOVE_C[o.gloves] : S, shortSl = (o.top === 0 || o.top === 1) && !o.outer;
  const armC = o.outer ? (o.outer === 3 ? '#efe3cf' : Oc) : (o.top === 4 ? T3 : Tc);
  const tw = y => y < 56 ? [12,14,15,16][y-52] : y < 80 ? 16 : Math.round(16-(y-80)*0.2);   // torso half-width per row
  /* bag peeking out behind the shoulders */
  if (o.bag === 1){ r(cx-21,56,5,22,'#4b5266'); r(cx+16,56,5,22,'#4b5266'); }
  /* legs */
  if (o.bottom === 1){
    r(cx-13,96,26,18,Bc); r(cx-1,104,2,10,B2); r(cx-13,112,12,2,B2); r(cx+1,112,12,2,B2);
    r(cx-11,114,8,22,S); r(cx+3,114,8,22,S); r(cx-4,114,1,22,S2); r(cx+10,114,1,22,S2);
    r(cx-11,130,8,6,'#f4f1ea'); r(cx+3,130,8,6,'#f4f1ea'); r(cx-11,131,8,1,'#c9cdd6'); r(cx+3,131,8,1,'#c9cdd6');
  } else {
    const nw = o.bottom === 2 ? 11 : 12;
    r(cx-13,96,26,6,Bc); r(cx-1-nw+1,96,nw,40,Bc); r(cx+1,96,nw,40,Bc);
    r(cx-1,102,2,34,shade(Bc,.6)); r(cx+nw-1,98,1,38,B2); r(cx+nw-12,98,1,2,B2);
    if (o.bottom === 2){ r(cx-7,102,1,32,B2); r(cx+6,102,1,32,B2); }
    else { r(cx-13,98,1,38,B1); r(cx+12,98,1,38,B2); r(cx-10,116,6,2,B1); r(cx+4,118,6,2,B1); r(cx-12,98,5,1,B2); r(cx+7,98,5,1,B2); r(cx-13,132,12,3,B1); r(cx+1,132,12,3,B1); }
  }
  /* shoes */
  for (const fx of [cx-7, cx+7]){
    if (o.shoes === 0){ r(fx-7,136,14,8,Sc); r(fx+3,136,4,8,shade(Sc,.8)); r(fx-7,144,14,3,'#f4f1ea'); r(fx-7,147,14,1,'#c9cdd6'); r(fx-3,137,6,1,'#f4f1ea'); r(fx-3,139,6,1,'#f4f1ea'); r(fx-5,141,6,1,shade(Sc,.65)); }
    else if (o.shoes === 1){ r(fx-7,128,14,16,Sc); r(fx+3,128,4,16,shade(Sc,.75)); r(fx-7,144,14,4,'#2c3142'); for (let y=130;y<142;y+=3) r(fx-2,y,4,1,'#c9cdd6'); }
    else if (o.shoes === 2){ r(fx-7,130,14,14,Sc); r(fx+3,130,4,14,shade(Sc,.8)); r(fx-7,140,14,4,'#f4f1ea'); r(fx-7,144,14,3,'#f4f1ea'); r(fx+1,133,4,4,'#f4f1ea'); r(fx-3,132,5,1,'#f4f1ea'); r(fx-3,135,5,1,'#f4f1ea'); }
    else { r(fx-6,140,12,5,S); r(fx-6,140,12,1,S2); r(fx-7,141,14,3,Sc); r(fx-7,145,14,2,'#f4f1ea'); }
  }
  /* torso */
  for (let y=52;y<97;y++){ const w = tw(y); r(cx-w,y,w*2,1,Tc); r(cx+w-3,y,3,1,T2); r(cx-w,y,1,1,shade(Tc,1.12)); }
  if (o.pattern === 1) for (let y=56;y<95;y+=6){ const w = tw(y); r(cx-w,y,w*2,2,T3); }
  else if (o.pattern === 2){ for (let y=58;y<95;y+=7){ const w = tw(y); r(cx-w,y,w*2,1,T3); } for (let x=cx-14;x<cx+16;x+=7) r(x,53,1,42,T3); }
  r(27,44,10,9,S2); r(27,44,10,3,S3);                                                   // neck
  if (o.top === 0){ r(cx-6,52,12,2,T3); r(cx-5,63,10,10,NAVY); r(cx-4,64,8,8,'#ffe14a'); r(cx-1,61,2,14,'#ffe14a'); r(cx-7,67,14,2,'#ffe14a'); r(cx-3,65,6,6,'#e0a050'); r(cx-13,94,26,2,T2); }
  else if (o.top === 1){ r(cx-6,52,12,2,T3); r(cx-12,62,7,7,T2); r(cx-12,62,7,1,T3); r(cx-13,94,26,2,T2); }
  else if (o.top === 2){ r(cx-12,48,24,6,T2); r(cx-13,52,26,3,T3); r(cx-4,55,1,12,'#e8e6e0'); r(cx+3,55,1,12,'#e8e6e0'); r(cx-5,67,3,2,'#c9cdd6'); r(cx+2,67,3,2,'#c9cdd6');
    r(cx-10,80,20,10,T2); r(cx-10,80,20,1,T3); r(cx-1,80,2,10,T3); r(cx-13,92,26,4,T2); }
  else if (o.top === 3){ r(cx-8,51,6,5,'#f4f1ea'); r(cx+2,51,6,5,'#f4f1ea'); r(cx-2,54,4,3,'#7a2a30'); r(cx-2,57,4,26,'#b5463f'); r(cx-1,57,1,26,'#e08f8a'); r(cx-1,83,2,2,'#b5463f');
    r(cx+5,62,6,6,T2); for (let y=60;y<94;y+=8) r(cx+3,y,1,1,T3); }
  else { r(cx-5,52,10,44,'#e8e6e0'); r(cx-6,52,2,20,T3); r(cx+4,52,2,20,T3); r(cx-6,72,1,24,T3); r(cx+5,72,1,24,T3); r(cx-12,82,6,1,T3); r(cx+6,82,6,1,T3); }
  if (o.pattern === 3){ r(cx+6,60,6,6,'#e8e6e0'); r(cx+7,61,4,4,'#b5463f'); }
  /* outerwear over the top (open front) */
  if (o.outer){
    const bot = o.outer === 2 ? 124 : 97;
    for (let y=50;y<bot;y++){ const w = y < 97 ? tw(Math.max(52,y)) : 15; r(cx-w,y,w-6,1,Oc); r(cx+6,y,w-6,1,Oc); r(cx+w-3,y,3,1,shade(Oc,.8)); }
    r(cx-9,48,5,10,shade(Oc,1.15)); r(cx+4,48,5,10,shade(Oc,1.15));
    if (o.outer === 1){ r(cx-12,58,1,36,shade(Oc,1.3)); r(cx+11,58,1,36,shade(Oc,1.3)); r(cx-13,62,6,5,shade(Oc,.85)); r(cx+7,62,6,5,shade(Oc,.85)); }
    else if (o.outer === 2){ r(cx-16,90,32,3,shade(Oc,.7)); r(cx-10,96,1,28,shade(Oc,.8)); r(cx+9,96,1,28,shade(Oc,.8)); }
    else { r(cx-16,93,32,3,'#efe3cf'); r(cx-13,62,5,7,'#efe3cf'); r(cx-12,63,3,5,Oc); }
  }
  if (o.belt){ r(cx-13,94,26,3,'#5e4f3c'); r(cx-2,94,4,3,'#e0a050'); if (o.belt === 2) for (let x=cx-11;x<cx+11;x+=4) r(x,95,1,1,'#c9cdd6'); }
  /* arms + hands */
  for (const ax of [cx-23, cx+17]){
    if (shortSl){ r(ax,54,6,12,Tc); r(ax,64,6,2,T2); r(ax+1,66,5,26,S); r(ax+(ax<cx?1:4),66,1,26,S2); }
    else { r(ax,54,6,38,armC); r(ax+(ax<cx?0:4),54,2,38,shade(armC,.8)); if (o.top === 2 && !o.outer) r(ax,88,6,3,T2); if (o.outer === 3) r(ax,88,6,3,Oc); }
    r(ax,92,6,7,HC); r(ax,97,6,1,o.gloves ? shade(HC,.7) : S2); r(ax+(ax<cx?5:0),92,1,4,o.gloves ? shade(HC,1.2) : S3);
    if (o.gloves === 1){ r(ax,96,6,3,S); }
  }
  if (o.bag === 1){ r(cx-12,52,3,30,'#3f4658'); r(cx+9,52,3,30,'#3f4658'); r(cx-12,70,3,2,'#c9cdd6'); r(cx+9,70,3,2,'#c9cdd6'); }
  else if (o.bag === 2){ for (let i=0;i<40;i++) r(cx-14+i*0.7,52+i,3,1,'#5e4f3c'); r(cx+8,86,13,11,'#8f7b5e'); r(cx+8,86,13,3,'#5e4f3c'); r(cx+13,89,3,2,'#e0a050'); }
  if (o.acc === 5){ r(cx-12,46,24,7,Ac); r(cx-12,51,24,2,shade(Ac,.7)); r(cx+3,52,5,16,Ac); }
  drawHead(g, o, 0);
  return c;
}
const figureCache = {};
function figureCanvas(o){
  const key = Object.keys(PERSON_COUNTS).map(k => o[k]).join();
  return figureCache[key] || (figureCache[key] = outlined(paintFigure(o)));
}

/* ---------- boss: the Hiring Manager - a huge alien exec in a pinstripe suit, with tentacles (64x84) ---------- */
function paintBossRaw(state, frame){
  const c = mkCanvas(64,84), g = c.getContext('2d'), r = (x,y,w,h,col) => px(g,Math.round(x),Math.round(y),w,h,col);
  const SK = '#6b8650', SK2 = '#4a6b3c', SK3 = '#8fa66a', SU = '#2c3142', SU2 = '#3f4658', ox = 8, oy = 4;
  const s = state === 'walk' ? (frame ? 2 : -2) : 0, sw = frame ? 0.25 : -0.25;
  const tent = (x0,y0,a0,curl,len,w0) => { let x = x0, y = y0, a = a0;
    for (let i=0;i<len;i++){ const w = Math.max(1, Math.round(w0*(1-i/len)+0.5)); r(x-w/2,y-w/2,w,w,i%2 ? SK : SK2); if (i%3 === 1 && w > 1) r(x,y,1,1,'#e08f8a'); x += Math.cos(a); y += Math.sin(a); a += curl; } };
  const A = state === 'windup' ? [[-2.0,-0.05],[-1.6,0.05],[-1.1,0.05],[-1.5,-0.04]]       // raised overhead
          : state === 'attack' ? [[3.1,0.02],[2.8,-0.03],[0.0,-0.02],[0.3,0.03]]          // lashing out
          : [[2.5+sw,0.05],[2.8+sw,-0.04],[0.64-sw,-0.05],[0.34-sw,0.04]];                // splayed out to the sides, swaying
  tent(ox+9,oy+36,A[0][0],A[0][1],24,7); tent(ox+11,oy+44,A[1][0],A[1][1],22,6); tent(ox+39,oy+36,A[2][0],A[2][1],24,7); tent(ox+37,oy+44,A[3][0],A[3][1],22,6);
  r(ox+14+s,oy+60,8,15,SU); r(ox+26-s,oy+60,8,15,SU); r(ox+13+s,oy+74,10,4,NAVY); r(ox+25-s,oy+74,10,4,NAVY);   // legs
  r(ox+8,oy+30,32,32,SU); for (let x=ox+10;x<ox+40;x+=4) r(x,oy+31,1,30,'#4b5266'); r(ox+34,oy+30,6,32,shade(SU,.8));   // pinstripe jacket
  r(ox+20,oy+30,8,12,'#e8e6e0'); r(ox+17,oy+30,3,14,SU2); r(ox+28,oy+30,3,14,SU2);
  r(ox+21,oy+30,6,3,'#7a2a30'); r(ox+22,oy+33,4,20,'#b5463f'); r(ox+23,oy+33,1,20,'#e08f8a');                    // fat red tie
  r(ox+31,oy+40,8,10,NAVY); r(ox+32,oy+41,6,8,'#e8e6e0'); r(ox+32,oy+41,6,2,'#ff5a4a'); r(ox+33,oy+45,4,1,'#3f4658'); r(ox+33,oy+47,3,1,'#3f4658');
  r(ox+2,oy+32,7,24,SU); r(ox+39,oy+32,7,24,SU); r(ox+2,oy+54,7,2,'#e8e6e0'); r(ox+39,oy+54,7,2,'#e8e6e0');
  r(ox+2,oy+56,7,5,SK); r(ox+39,oy+56,7,5,SK); for (const hx of [ox+2,ox+5,ox+39,ox+42]) r(hx,oy+61,2,3,SK2);
  if (state === 'windup'){ r(ox+40,oy+16,9,12,NAVY); r(ox+41,oy+17,7,10,'#e8e6e0'); r(ox+42,oy+19,5,1,'#7d8597'); r(ox+42,oy+21,5,1,'#7d8597'); r(ox+42,oy+24,3,2,'#b5463f'); }   // offer letter
  r(ox+19,oy+26,10,5,SK2);                                                                                          // neck
  for (let y=0;y<28;y++){ const t = y/27, hw = Math.max(3, Math.round(14*Math.sqrt(Math.max(0,1-((t-0.42)/0.62)**2)))); r(ox+24-hw,oy+y,hw*2,1,SK); r(ox+24+hw-4,oy+y,4,1,SK2); r(ox+24-hw,oy+y,2,1,SK3); }
  r(ox+18,oy+6,12,1,SK2); r(ox+20,oy+9,8,1,SK2);                                                                   // forehead wrinkles
  for (const [ex,ey,ew,eh] of [[13,11,5,3],[16,13,5,3],[19,15,3,2]]){ r(ox+ex,oy+ey,ew,eh,NAVY); r(ox+48-ex-ew,oy+ey,ew,eh,NAVY); }
  r(ox+17,oy+13,2,2,'#ff5a4a'); r(ox+29,oy+13,2,2,'#ff5a4a');                                                     // glowing red pupils
  if (state === 'windup' || state === 'attack'){ r(ox+15,oy+20,18,5,'#7a2a30'); r(ox+15,oy+20,18,1,'#e8e6e0'); for (let x=ox+16;x<ox+33;x+=3) r(x,oy+24,1,1,'#e8e6e0'); }
  else r(ox+17,oy+21,14,1,NAVY);
  r(ox+16,0,2,5,SK2); r(ox+30,0,2,5,SK2); r(ox+15,0,4,2,'#ffe14a'); r(ox+29,0,4,2,'#ffe14a');                     // antennae
  tent(ox+19,oy+27,1.6+sw,0.05,9,2); tent(ox+24,oy+28,1.57,0.0,10,2); tent(ox+29,oy+27,1.5-sw,-0.05,9,2);           // chin tentacles
  return c;
}
const personCache = {};
function personCanvas(o, pose, back){
  const key = Object.keys(PERSON_COUNTS).map(k => o[k]).join() + (o.apron ? 'A' : '') + pose + (back ? 'B' : '');   // every look field, so outfit changes always refresh
  return personCache[key] || (personCache[key] = outlined(paintPerson(o, pose, back)));
}

/* ---------- boss: the Career Counselor (chapter 2). Built like the other recruiters (egg head, big slanted black eyes, antennae with bulbs, suit, tie, lanyard + ID badge,
   but pale lilac, with round glasses over the eyes, a clipboard and a very sharp red pencil ---------- */
function paintCounselorRaw(state, frame){
  const c = mkCanvas(64,84), g = c.getContext('2d'), r = (x,y,w,h,col) => px(g,Math.round(x),Math.round(y),w,h,col);
  const SK = '#c3b4e0', SK2 = '#9484bd', SK3 = '#ddd2f0', SU = '#4a3f66', SU2 = '#6b3a5c', ox = 8, oy = 4;
  const s = state === 'walk' ? (frame ? 2 : -2) : 0, sw = frame ? 0.25 : -0.25;
  const tent = (x0,y0,a0,curl,len,w0) => { let x = x0, y = y0, a = a0; for (let i=0;i<len;i++){ const w = Math.max(1, Math.round(w0*(1-i/len)+0.5)); r(x-w/2,y-w/2,w,w,i%2 ? SK : SK2); x += Math.cos(a); y += Math.sin(a); a += curl; } };
  r(ox+14+s,oy+60,8,15,SU); r(ox+26-s,oy+60,8,15,SU); r(ox+13+s,oy+74,10,4,NAVY); r(ox+25-s,oy+74,10,4,NAVY);                              // legs + shoes
  r(ox+8,oy+30,32,32,SU); r(ox+8,oy+30,3,32,SU2); r(ox+34,oy+30,6,32,shade(SU,.8));                                                       // suit jacket
  r(ox+20,oy+30,8,12,'#e8e6e0'); r(ox+17,oy+30,3,14,SU2); r(ox+28,oy+30,3,14,SU2); r(ox+21,oy+30,6,3,'#7a3a10'); r(ox+22,oy+33,4,20,'#e0a050'); r(ox+23,oy+33,1,20,'#ffe14a');   // shirt + mustard tie
  r(ox+19,oy+30,1,18,'#5f89ab'); r(ox+28,oy+30,1,18,'#5f89ab'); r(ox+30,oy+42,8,10,NAVY); r(ox+31,oy+43,6,8,'#e8e6e0'); r(ox+31,oy+43,6,2,'#5f89ab'); r(ox+32,oy+47,4,1,'#3f4658');   // lanyard + ID badge
  if (state === 'windup'){                                                                                                                 // clipboard raised overhead: "time for your review"
    r(ox+2,oy+32,7,18,SU); r(ox+39,oy+32,7,18,SU); r(ox+3,oy+16,5,18,SU); r(ox+40,oy+16,5,18,SU); r(ox+2,oy+11,6,6,SK); r(ox+40,oy+11,6,6,SK);
    r(ox+9,oy-3,30,20,NAVY); r(ox+11,oy-1,26,16,'#8f5a3a'); r(ox+13,oy+1,22,12,'#e8e6e0'); for (let i=0;i<3;i++) r(ox+15,oy+3+i*3,14,1,'#7d8597'); r(ox+30,oy+10,4,2,'#b5463f'); r(ox+19,oy-5,10,4,'#a3aab8');
  } else if (state === 'attack'){                                                                                                          // jabbing the red pencil
    r(ox+39,oy+32,7,8,SU); r(ox+44,oy+33,6,6,SK); r(ox+46,oy+35,18,3,NAVY); r(ox+47,oy+35,16,2,'#ffe14a'); r(ox+60,oy+34,4,5,'#b5463f'); r(ox+62,oy+35,2,3,'#7a2a30');
    r(ox+1,oy+32,7,24,SU); r(ox+1,oy+55,7,5,SK); r(ox-4,oy+40,12,16,NAVY); r(ox-3,oy+41,10,14,'#8f5a3a'); r(ox-2,oy+43,8,10,'#e8e6e0');
  } else {                                                                                                                                 // clipboard held at the chest, pencil hand resting
    r(ox+1,oy+32,7,24,SU); r(ox+1,oy+55,7,5,SK); r(ox-4,oy+36,14,18,NAVY); r(ox-3,oy+37,12,16,'#8f5a3a'); r(ox-1,oy+39,8,12,'#e8e6e0'); for (let i=0;i<4;i++) r(ox,oy+41+i*3,6,1,'#7d8597'); r(ox+4,oy+49,2,2,'#b5463f');
    r(ox+39,oy+32,7,26,SU); r(ox+39,oy+56,7,5,SK); r(ox+41,oy+58,2,12,'#ffe14a'); r(ox+41,oy+69,2,3,'#b5463f');
  }
  r(ox+19,oy+26,10,5,SK2);                                                                                                                 // neck
  for (let y=0;y<28;y++){ const t = y/27, hw = Math.max(3, Math.round(13*Math.sqrt(Math.max(0,1-((t-0.42)/0.62)**2)))); r(ox+24-hw,oy+y,hw*2,1,SK); r(ox+24+hw-4,oy+y,4,1,SK2); r(ox+24-hw,oy+y,2,1,SK3); }   // egg head
  for (const [ex,ey,ew,eh] of [[13,11,5,3],[16,13,5,3],[19,15,3,2]]){ r(ox+ex,oy+ey,ew,eh,NAVY); r(ox+48-ex-ew,oy+ey,ew,eh,NAVY); }       // big slanted black eyes (like everyone else's)
  r(ox+14,oy+11,1,1,'#fff'); r(ox+33,oy+11,1,1,'#fff');
  for (const gx of [ox+10, ox+27]){ r(gx+1,oy+8,10,1,NAVY); r(gx+1,oy+19,10,1,NAVY); r(gx,oy+9,1,10,NAVY); r(gx+11,oy+9,1,10,NAVY); r(gx+2,oy+9,3,1,'#fff'); }   // round glasses (frames only, the eyes show through)
  r(ox+22,oy+13,5,1,NAVY);                                                                                                                 // bridge
  if (state === 'windup' || state === 'attack'){ r(ox+16,oy+22,16,5,'#7a2a30'); r(ox+16,oy+22,16,1,'#e8e6e0'); for (let x=ox+17;x<ox+31;x+=3) r(x,oy+26,1,1,'#e8e6e0'); } else r(ox+18,oy+23,12,1,NAVY);   // mouth
  r(ox+17,oy+1,2,5,SK2); r(ox+29,oy+1,2,5,SK2); r(ox+16,oy-1,4,3,'#3cff8a'); r(ox+28,oy-1,4,3,'#3cff8a');                                  // antennae with bulbs
  return c;
}

/* ---------- the Ticket Inspector (chapter 2 elite recruiter): broader and tougher than a recruiter. Conductor cap, gold-buttoned navy jacket, red armband, a long baton ---------- */
function paintInspectorRaw(state, frame){
  const c = mkCanvas(40,72), g = c.getContext('2d'), r = (x,y,w,h,col) => px(g,Math.round(x),Math.round(y),w,h,col);
  const SK = '#c98a5a', SK2 = '#9a6240', SU = '#2a3a5c', SU2 = '#3f5580', GOLD = '#e0a050', oy = 3;
  const walk = state === 'walk', s = walk ? (frame ? 3 : -3) : 0, bob = walk && frame ? 1 : 0, hy = oy + bob;
  r(10+s,oy+48,7,16,SU); r(23-s,oy+48,7,16,SU); r(9+s,oy+63,9,4,NAVY); r(22-s,oy+63,9,4,NAVY); r(13+s,oy+48,1,16,'#b5463f'); r(26-s,oy+48,1,16,'#b5463f');   // legs, red trouser stripe
  r(6,oy+22+bob,28,27,SU); r(6,oy+22+bob,4,27,SU2); r(30,oy+22+bob,4,27,shade(SU,.75));                                                                        // wide double-breasted jacket
  r(17,oy+22+bob,6,13,'#e8e6e0'); r(19,oy+23+bob,2,13,'#b5463f');                                                                                                // shirt + tie
  for (let i=0;i<3;i++){ r(13,oy+34+i*4+bob,2,2,GOLD); r(25,oy+34+i*4+bob,2,2,GOLD); }                                                                           // gold buttons
  r(4,oy+21+bob,8,3,GOLD); r(28,oy+21+bob,8,3,GOLD); r(12,oy+22+bob,1,9,'#5f89ab'); r(27,oy+22+bob,1,9,'#5f89ab');                                              // epaulettes, lanyard
  if (state === 'windup'){                                                                                                                                       // baton raised overhead
    r(2,oy+8+bob,5,16,SU); r(33,oy+8+bob,5,16,SU); r(2,oy+4+bob,5,5,SK); r(33,oy+4+bob,5,5,SK); r(34,oy-4+bob,3,14,'#e8e6e0'); r(34,oy-4+bob,3,4,'#b5463f'); r(2,oy+22+bob,5,3,'#b5463f');
  } else if (state === 'attack'){                                                                                                                                // wide sweep across the front
    r(1,oy+26,8,5,SU); r(31,oy+26,9,5,SU); r(0,oy+25,4,7,SK); r(2,oy+37,36,3,'#e8e6e0'); r(2,oy+37,5,3,'#b5463f'); r(2,oy+27,5,3,'#b5463f');
  } else {
    r(2,oy+24+bob,5,18,SU); r(2,oy+42+bob,5,5,SK); r(2,oy+33+bob,5,4,'#b5463f'); r(33,oy+24+bob,5,18,SU); r(33,oy+42+bob,5,5,SK); r(35,oy+28+bob,2,22,'#e8e6e0'); r(35,oy+47+bob,2,4,'#b5463f');
  }
  r(16,oy+20+bob,8,3,SK2);                                                                                                                                       // neck
  r(15,hy+1,10,3,SK); r(12,hy+4,16,13,SK); r(14,hy+17,12,3,SK); r(16,hy+20,8,1,SK); r(26,hy+5,2,11,SK2); r(15,hy+19,10,1,SK2);                                   // egg head
  for (const [ex,ey,ew,eh] of [[13,9,3,3],[15,11,3,3],[17,13,2,2]]){ r(ex,hy+ey,ew,eh,NAVY); r(40-ex-ew,hy+ey,ew,eh,NAVY); }                                        // slanted black eyes
  r(14,hy+9,1,1,'#fff'); r(25,hy+9,1,1,'#fff');
  r(11,hy-1,18,5,SU); r(11,hy+3,18,2,GOLD); r(9,hy+5,22,2,shade(SU,.7)); r(19,hy,3,2,GOLD);                                                                      // conductor cap
  r(14,hy-4,1,4,SK2); r(25,hy-4,1,4,SK2); r(13,hy-5,3,2,'#ff5a4a'); r(24,hy-5,3,2,'#ff5a4a');                                                                    // antennae through the cap
  if (state === 'windup' || state === 'attack') r(16,hy+17,8,3,'#7a2a30'); else r(17,hy+18,6,1,NAVY);
  return c;
}
