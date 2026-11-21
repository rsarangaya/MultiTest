# STATUS - The Super Slasher 5000

Updated: 2026-11-21

## What it is
First-person hack & slash (three.js, plain HTML/JS, optional Electron portable exe). Pixel-art look from the *Dead-End Job* opening
(style reference only). Aliens run the planet through **BizNes Corp**; the player just wants milk. See `README.md` for flow and controls.

## Done
- Main menu, options (keybinds, sensitivity, FOV, music/sfx), save/continue, debug mode (` key).
- **Comic prologue:** 6 cached stills with caption boxes (first contact, summit, "...in business", first alien company, 80% takeover,
  humans hiding). Aliens use the in-game recruiter look (`alienLook` in `intro.js`).
- Isometric intro (wake up, creator, mom, wallet, weapon chest, door), arrival shot, street waves, Hiring Manager boss.
- Skill tree (sword), levels, style rank, dash/double jump/slam, coffee + vending healing.
- Chapter 2: isometric stealth grocery store with turn-based battle (`store.js`).
- Game-over "hired" cubicle scene. Music (procedural lo-fi). Rename OmniCorp -> **BizNes Corp** everywhere.
- **Timing fix (this session):** game speed is real elapsed time. Frames longer than 0.1 s are capped; gameplay runs in fixed sub-steps
  of at most 1/60 s, so movement distance is identical at 30 / 60 / 144 / 240 Hz.
- **Freeze fix (this session):** root cause was a name clash - the comic helper `burst()` in `intro.js` overwrote the game's particle
  `burst()`, which threw an error on the first enemy spawn/hit. That error stopped the frame loop. Helper renamed `starBurst`, and
  `frame()` now catches errors per frame and always re-queues itself (`tick()` holds the real work).
- **Store polish:** first visit now shows a first-person arm grabbing and rattling the closed door. Entering the open store walks to the door, pulls it
  (chime), fades to black and fades the store in; leaving walks out the door and fades to the street (`FADE` / `fadeTo()` in `game.js`).
- **Store difficulty:** map is 16x11 (was 14x10), 5 patrolling guards (faster, longer/wider vision, quicker suspicion, wider look sweeps), recruiter
  battle HP 30 (was 14) and harder hits. Cashier + gag recruiter live in the bottom-left corner, no patrol route goes near it.

## Verified (scripted, in the preview browser)
- Same walk distance at 30/60/144/240 Hz; intro clock = real time at every rate.
- 40 s of simulated play with spawns, god mode, boss, attacks: no console errors; about 1.3 ms CPU per frame.
- All 6 prologue panels rendered and paged through into the intro.

## Not verified
- Not hand-played with a real mouse / pointer lock; the `.exe` is not rebuilt.
- Small one-off hitches remain on first use of some content (about 70 ms once mid-fight, about 60 ms on the first death-screen paint). Could be
  pre-warmed.

## Next / ideas
- Chapter 3: walk home through another wave (`home` phase is a stub).
- Other weapons + their trees (chain with grapple, axe, greatsword, gauntlet, crossbows); snipers at higher levels; air combat as an unlock.
- Pre-warm speech-bubble and death-scene textures to remove the first-use hitches.

## Files
`index.html`, `art.js`, `sprites.js`, `world.js`, `game.js`, `music.js`, `intro.js`, `store.js`, `three.min.js`; packaging:
`main.js`, `package.json`, `build.js`, `BUILD EXE.bat`, `START HERE.bat`. `deadendtest\` holds an old v2 copy (not used).
Beware: scripts share one global scope, so new helper names must not collide with existing ones.
