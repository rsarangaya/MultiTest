"use strict";
/* ============================================================================
   MUSIC  -  procedural lo-fi (slice-of-life anime vibe), pure WebAudio, no files.
   Warm electric-piano maj7/min9 chords, soft bass, lazy swung boom-bap, a sparse bell
   melody, vinyl crackle and a slow tape wobble.
   Cost: a 50 ms timer schedules ~0.25 s ahead (a handful of nodes per beat); nothing per frame.
   During waves the low-pass opens and the hats get busier; it stays calm.
   ============================================================================ */
const Music = { on:false, bus:null, filt:null, lfoGain:null, noise:null, next:0, step:0, bpm:76, timer:null, intense:false };
const NOTE = n => 440*Math.pow(2, (n-69)/12);
const PROG = [                                   // 8 bars, one chord each (MIDI notes)
  { root:41, ch:[53,57,60,64] },                 // Fmaj7
  { root:40, ch:[52,55,59,62] },                 // Em7
  { root:38, ch:[50,53,57,60] },                 // Dm7
  { root:36, ch:[52,55,59,62] },                 // Cmaj9 (no root)
  { root:45, ch:[55,59,60,64] },                 // Am9
  { root:38, ch:[53,57,60,64] },                 // Dm9
  { root:43, ch:[53,57,59,64] },                 // G13
  { root:36, ch:[52,55,59,62] } ];               // Cmaj9
const PENTA = [72,74,76,79,81,84];

function musicInit(){
  const a = audio(); if (!a || Music.bus) return;
  Music.bus = a.createGain(); Music.bus.gain.value = 0;
  Music.filt = a.createBiquadFilter(); Music.filt.type = 'lowpass'; Music.filt.frequency.value = 2400; Music.filt.Q.value = 0.4;
  const comp = a.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
  Music.bus.connect(Music.filt); Music.filt.connect(comp); comp.connect(a.destination);
  const lfo = a.createOscillator(); lfo.frequency.value = 0.3; Music.lfoGain = a.createGain(); Music.lfoGain.gain.value = 6; lfo.connect(Music.lfoGain); lfo.start();   // tape wobble (cents)
  const n = a.sampleRate, nb = a.createBuffer(1, n, n), nd = nb.getChannelData(0); for (let i=0;i<n;i++) nd[i] = Math.random()*2-1; Music.noise = nb;
  const cn = n*3, cb = a.createBuffer(1, cn, n), cd = cb.getChannelData(0);                                   // vinyl crackle loop
  for (let i=0;i<cn;i++) cd[i] = (Math.random() < 0.0006 ? (Math.random()*2-1)*0.8 : 0) + (Math.random()*2-1)*0.01;
  const cs = a.createBufferSource(), cf = a.createBiquadFilter(), cg = a.createGain();
  cs.buffer = cb; cs.loop = true; cf.type = 'bandpass'; cf.frequency.value = 2400; cf.Q.value = 0.5; cg.gain.value = 0.6;
  cs.connect(cf); cf.connect(cg); cg.connect(Music.bus); cs.start();
}
const musicLevel = () => (settings.music ?? 6)/10*0.5;
function startMusic(){
  const a = audio(); if (!a) return;
  if (a.state === 'suspended') a.resume();
  musicInit(); if (Music.on) return;
  Music.on = true; Music.next = a.currentTime + 0.1; Music.step = 0;
  Music.bus.gain.setTargetAtTime(musicLevel(), a.currentTime, 1.5);                 // gentle fade-in
  Music.timer = setInterval(musicTick, 50);
}
function setMusicVolume(){ if (Music.bus) Music.bus.gain.setTargetAtTime(musicLevel(), audio().currentTime, 0.15); }
function musicTick(){
  const a = audio(), spe = 60/Music.bpm/2;                                          // seconds per 8th note
  while (Music.next < a.currentTime + 0.25){ scheduleStep(Music.step, Music.next, spe); Music.step++; Music.next += spe; }
  Music.filt.frequency.setTargetAtTime(Music.intense ? 3800 : 2400, a.currentTime, 1.5);
}
function scheduleStep(s, t, spe){
  const pos = s%8, c = PROG[Math.floor(s/8)%PROG.length], tt = t + (pos%2 ? spe*0.18 : 0);   // swung off-beats
  if (pos === 0) chord(c.ch, tt, 0.1, false);
  if (pos === 3 && Math.random() < 0.6) chord(c.ch, tt, 0.045, true);
  if (pos === 0 || pos === 4) bass(c.root, tt, pos === 0 ? 0.3 : 0.22);
  if (pos === 7 && Math.random() < 0.35) bass(c.root+7, tt, 0.16);
  if (pos === 0 || (pos === 5 && Math.random() < 0.5)) kick(tt);
  if (pos === 2 || pos === 6) snare(tt);
  if (pos%2 === 1 || Music.intense) hat(tt, pos%2 ? 0.045 : 0.025);
  if (pos%2 === 0 && Math.random() < 0.25) bell(PENTA[Math.floor(Math.random()*PENTA.length)], tt);
}
function voice(type, f, t, dur, vol, attack, cents){
  const a = audio(), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = f; if (cents) o.detune.value = cents; Music.lfoGain.connect(o.detune);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t+attack); g.gain.exponentialRampToValueAtTime(0.0008, t+dur);
  o.connect(g); g.connect(Music.bus); o.start(t); o.stop(t+dur+0.05);
}
function chord(notes, t, vol, soft){
  for (const n of notes){ const f = NOTE(n), st = t + Math.random()*0.03;            // slight strum
    voice('sine', f, st, soft ? 1.6 : 2.8, vol, 0.03); voice('triangle', f*2, st, soft ? 0.8 : 1.4, vol*0.16, 0.02, 4); }
}
function bass(n, t, vol){ const f = NOTE(n-12); voice('triangle', f, t, 0.9, vol, 0.02); voice('sine', f, t, 1.0, vol*0.8, 0.02); }
function bell(n, t){ voice('sine', NOTE(n), t, 1.8, 0.045, 0.005); voice('sine', NOTE(n)*3, t, 0.5, 0.01, 0.005); }
function kick(t){
  const a = audio(), o = a.createOscillator(), g = a.createGain();
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t+0.14);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.38); o.connect(g); g.connect(Music.bus); o.start(t); o.stop(t+0.4);
}
function noiseHit(t, freq, type, q, vol, dur){
  const a = audio(), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = Music.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t+dur);
  s.connect(f); f.connect(g); g.connect(Music.bus); s.start(t, Math.random()*0.5, dur+0.05);
}
function snare(t){ noiseHit(t, 1700, 'bandpass', 0.8, 0.14, 0.2); voice('triangle', 190, t, 0.12, 0.06, 0.002); }
function hat(t, vol){ noiseHit(t, 7500, 'highpass', 0.7, vol, 0.05); }
