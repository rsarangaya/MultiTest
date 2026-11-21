"use strict";
/* ============================================================================
   WORLD  -  the street arena (60 x 60 m), collision boxes, skyline, sky dome
   ============================================================================ */
const scene = new THREE.Scene();
const SKY_COL = 0xbcd6e8;
scene.background = new THREE.Color(SKY_COL);
scene.fog = new THREE.Fog(SKY_COL, 34, 150);

const solids = [];                                    // axis-aligned collision boxes
const fx = new THREE.Group(); scene.add(fx);          // sprites/particles live here (hidden during the outline depth pass)
const FACE_TINT = [0xd2d2d2, 0x9a9a9a, 0xffffff, 0x555555, 0xe4e4e4, 0xa8a8a8];   // +x -x +y -y +z -z (fake flat shading)
const FACE_IDX = { '+x':0, '-x':1, '+y':2, '-y':3, '+z':4, '-z':5 };
const bm = (map, tint) => new THREE.MeshBasicMaterial({ map, color: tint, fog: true });

function addBox(o){
  const y0 = o.y0 || 0, w = o.w, d = o.d, h = o.h, tile = o.tile || 4, mats = [];
  for (const f of ['+x','-x','+y','-y','+z','-z']){
    let map;
    if (o.facade && o.facade.face === f) map = paintFacade(o.facade.kind, f[1]==='x' ? d : w, h, o.facade.bump);
    else if (f[1] === 'y') map = tiled(o.top || o.side, w/tile, d/tile);
    else map = tiled(o.side, (f[1]==='x' ? d : w)/tile, h/tile);
    mats.push(bm(map, FACE_TINT[FACE_IDX[f]]));
  }
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mats);
  m.position.set(o.cx, y0+h/2, o.cz); scene.add(m);
  if (o.solid !== false) solids.push({ minx:o.cx-w/2, maxx:o.cx+w/2, miny:y0, maxy:y0+h, minz:o.cz-d/2, maxz:o.cz+d/2, id:solids.length });
  return m;
}
function decorPlane(cx, cz, w, d, name, y){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w,d), new THREE.MeshBasicMaterial({ map: tiled(name, w/4, d/4), fog:true }));
  m.rotation.x = -Math.PI/2; m.position.set(cx, y, cz); scene.add(m);
}
function flatStrip(cx, cz, w, d, color, y){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w,d), new THREE.MeshBasicMaterial({ color, fog:true }));
  m.rotation.x = -Math.PI/2; m.position.set(cx, y, cz); scene.add(m);
}

let skyDome = null;
function buildLevel(){
  /* ground + sidewalks + road paint */
  const g = new THREE.Mesh(new THREE.PlaneGeometry(320,320), new THREE.MeshBasicMaterial({ map: tiled('asphalt',80,80), fog:true }));
  g.rotation.x = -Math.PI/2; scene.add(g);
  decorPlane(0,-27.5,60,5,'sidewalk',0.03); decorPlane(0,27.5,60,5,'sidewalk',0.03);
  decorPlane(-27.5,0,5,50,'sidewalk',0.03); decorPlane(27.5,0,5,50,'sidewalk',0.03);
  for (let x=-22;x<=22;x+=8) flatStrip(x, 3, 4, 0.28, 0xe8e6e0, 0.04);
  for (let z=-20;z<=20;z+=8) if (Math.abs(z-3) > 4) flatStrip(0, z, 0.28, 4, 0xe8e6e0, 0.04);

  /* enclosing buildings: each has a hand-painted shopfront facade facing the arena */
  const kinds = ['shutter','staffing','cstore','plain'];
  const NH = [10,8,11], SH = [9,12,8], EH = [11,9,10], WH = [9,10,11];
  for (let i=0;i<3;i++){
    const c = -20 + i*20;
    addBox({ cx:c,  cz:-36, w:20, d:12, h:NH[i], side:'wallCream', top:'roof', facade:{ face:'+z', kind:['shutter','staffing','cstore'][i], bump:i } });
    addBox({ cx:c,  cz: 36, w:20, d:12, h:SH[i], side:'wallCream', top:'roof', facade:{ face:'-z', kind:['staffing','plain','shutter'][i], bump:i+3 } });
    addBox({ cx: 36, cz:c,  w:12, d:20, h:EH[i], side:'wallCream', top:'roof', facade:{ face:'-x', kind:['plain','cstore','staffing'][i], bump:i+6 } });
    addBox({ cx:-36, cz:c,  w:12, d:20, h:WH[i], side:'wallCream', top:'roof', facade:{ face:'+x', kind:['cstore','shutter','plain'][i], bump:i+9 } });
  }
  for (const [x,z] of [[-36,-36],[36,-36],[-36,36],[36,36]]) addBox({ cx:x, cz:z, w:12, d:12, h:13, side:'concrete', top:'roof' });

  /* fire escape up the middle north building (stacked steps) -> rooftop */
  for (let i=0;i<6;i++) addBox({ cx:-10+i*2.6, cz:-28.4, w:2.6, d:3.2, h:1.2*(i+1), side:'metal', top:'metal', tile:2 });
  addBox({ cx:11, cz:-27.5, w:1.4, d:1.4, h:1.2, side:'crate', tile:1.2, y0:8 });          // roof crate -> next roof
  addBox({ cx:-12, cz:-33, w:2.4, d:1.8, h:1.2, side:'metal', tile:2, y0:8 });             // roof AC units
  addBox({ cx:4, cz:-34, w:2.4, d:1.8, h:1.2, side:'metal', tile:2, y0:8 });
  addBox({ cx:-22, cz:-33, w:3, d:2, h:1.4, side:'metal', tile:2, y0:10 });
  addBox({ cx:22, cz:-33, w:3, d:2, h:1.4, side:'metal', tile:2, y0:11 });

  /* wall-run / wall-jump corridors */
  addBox({ cx:-14, cz:-6,  w:14, d:0.8, h:6, side:'concrete', top:'roof', tile:4 });
  addBox({ cx:-14, cz:-10, w:14, d:0.8, h:6, side:'tag', top:'roof', tile:4 });
  addBox({ cx: 14, cz:-6,  w:14, d:0.8, h:6, side:'tag', top:'roof', tile:4 });
  addBox({ cx: 14, cz:-10, w:14, d:0.8, h:6, side:'concrete', top:'roof', tile:4 });

  /* mid-field cover + parkour props */
  for (const [x,z] of [[0,11],[-7,13],[7,13],[-3,-1],[4,-3]]) addBox({ cx:x, cz:z, w:3, d:0.8, h:0.9, side:'barrier', top:'barrier', tile:2 });
  for (const [x,z,r] of [[-22,17,0],[22,15,0],[-21,-17,0],[23,-13,0]]) addBox({ cx:x, cz:z, w:r?1.4:2.4, d:r?2.4:1.4, h:1.3, side:'dumpster', top:'dumpster', tile:2 });
  addBox({ cx:24, cz:-20, w:6, d:2.6, h:2.6, side:'metal', top:'metal', tile:2 });           // container
  addBox({ cx:20.4, cz:-18.4, w:1.2, d:1.2, h:1.2, side:'crate', tile:1.2 });
  addBox({ cx:19.1, cz:-20, w:1.2, d:1.2, h:2.4, side:'crate', tile:1.2 });
  addBox({ cx:-24, cz:-20, w:1.2, d:1.2, h:1.2, side:'crate', tile:1.2 });
  addBox({ cx:-24, cz:-18.7, w:1.2, d:1.2, h:2.4, side:'crate', tile:1.2 });
  addBox({ cx:-24, cz:-17.4, w:1.2, d:1.2, h:3.6, side:'crate', tile:1.2 });
  addBox({ cx:0, cz:-15, w:10, d:6, h:0.5, side:'sidewalk', top:'sidewalk', tile:4 });       // low plaza
  addBox({ cx:0, cz:-15, w:4, d:3, h:1.6, side:'concrete', top:'roof', tile:3 });
  for (const x of [-9,9]) addBox({ cx:x, cz:27.2, w:1.1, d:0.9, h:1.9, side:'vend', top:'metal', tile:1.5 });
  for (const [x,z] of [[-12,10],[12,10],[-12,-18],[12,-18]]) addBox({ cx:x, cz:z, w:0.3, d:0.3, h:7, side:'metal', top:'metal', tile:2 });

  /* sky dome + distant skyline */
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(220,24,12), new THREE.MeshBasicMaterial({ map: paintSky(), side: THREE.BackSide, fog:false, depthWrite:false }));
  skyDome.renderOrder = -10; scene.add(skyDome);
  _s = 31337;
  const tt = paintTower();
  for (let i=0;i<26;i++){
    const a = i/26*Math.PI*2 + rnd()*0.1, r = 95 + rnd()*30, w = 12 + rnd()*10, h = 40 + rnd()*55;
    const map = tt.clone(); map.needsUpdate = true; map.repeat.set(w/6, h/24);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,w), new THREE.MeshBasicMaterial({ map, fog:true }));
    m.position.set(Math.cos(a)*r, h/2, Math.sin(a)*r); scene.add(m);
  }
}

/* ---------- collision queries (player is an AABB: half width HW, height h) ---------- */
const HW = 0.34;
function collides(x, y, z, h){
  for (const b of solids)
    if (x+HW>b.minx && x-HW<b.maxx && z+HW>b.minz && z-HW<b.maxz && y+h>b.miny+0.001 && y<b.maxy-0.001) return b;
  return null;
}
function maxTopOverlap(x, y, z, h){
  let top = -1;
  for (const b of solids)
    if (x+HW>b.minx && x-HW<b.maxx && z+HW>b.minz && z-HW<b.maxz && y+h>b.miny+0.001 && y<b.maxy-0.001 && b.maxy>top) top = b.maxy;
  return top;
}
function supportY(x, y, z){
  let gy = 0;
  for (const b of solids)
    if (x+HW>b.minx && x-HW<b.maxx && z+HW>b.minz && z-HW<b.maxz && b.maxy<=y+0.1 && b.maxy>gy) gy = b.maxy;
  return gy;
}
/* is there a wall within 'e' metres in direction (dx,dz)?  (needs to reach above the player's knees) */
function wallProbe(x, y, z, h, dx, dz){
  const e = 0.2;
  for (const b of solids){
    if (b.maxy < y+0.9 || b.miny > y+h-0.2) continue;
    if (x+dx*e+HW>b.minx && x+dx*e-HW<b.maxx && z+dz*e+HW>b.minz && z+dz*e-HW<b.maxz) return b;
  }
  return null;
}
function circleBlocked(x, z, r, minH){       // minH: obstacles lower than this are stepped over (the boss ignores knee-high cover)
  const mh = minH || 0.6;
  for (const b of solids)
    if (b.maxy>mh && b.miny<1.8 && x+r>b.minx && x-r<b.maxx && z+r>b.minz && z-r<b.maxz) return true;
  return false;
}
