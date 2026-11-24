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

- **Mobile (testing build):** taps act as clicks; the intro and all menus are playable on a phone (on-screen WASD, OK, FAST, SKIP, TAB buttons; name entry
  via the system prompt). Street and store have no touch controls yet (a MENU button is shown). Touch code is in `game.js` (`IS_TOUCH`, `drawTouchUI`).

- **Pan-out camera (flip, ground slam, whirlwind):** `panCam()` in `game.js`. The first-person camera no longer spins for flips or the whirlwind; it eases out to
  show you tumbling (flip), diving head-first (slam) or spinning (whirl: front/edge/back squash), then back into the head. Details below.
- **Front/back flips** are seen from behind and tip end over end (foreshortens, shows the front upside-down, comes round); side flips still roll in the screen plane.
- **Flip camera:** wall flips no longer spin the first-person camera. The camera eases out to a side (front/back flips) or behind (side flips) view, the
  character is drawn as a billboard tumbling in the screen plane, then it eases back into the head. Falls back to a closer/other angle in tight spots and
  stays first person when there is no room (`flipCam()` in `game.js`). The tumbling sprite only uses the `stand` pose for now.

- **Movement = damage** (`momentumInfo()` in `game.js`, additive, capped at +150%): SPEED (up to +60%), CHARGE (up to +40%, speed straight at the target),
  PLUNGE (up to +50% falling, ground slam scales with fall height), FLIP (+50% for 2.5 s), WALL RUN (+25%), SLIDE (+20%), jump-pad LAUNCH (+40% for 1.6 s),
  COMBO (+2% per hit, max 30%). HUD shows `DAMAGE xN` with the active bonuses; damage numbers turn orange at +100%.

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
