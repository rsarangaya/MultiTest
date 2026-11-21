# The Super Slasher 5000

First-person hack & slash. BizNes Corp, an alien conglomerate in corporate suits, bought the planet in a week.
You just want milk - and the only store is closed until 9 AM. Pixel-art look: flat dusty palette, navy outlines,
mood swap to crimson during waves. Plain HTML/JS (three.js) - no build needed to play.

## Play
- **Browser:** double-click `START HERE.bat` (opens `index.html`).
- **Portable .exe:** double-click `BUILD EXE.bat` once (needs Node.js). It creates `dist\SuperSlasher5000-win32-x64\` with
  `SuperSlasher5000.exe` beside `resources\app\` - the loose game source. Copy that whole folder anywhere; edit files in
  `resources\app\` and relaunch, no rebuild needed. F11 = fullscreen.

## Flow
Main menu (Start / Continue / Options / Exit) -> **comic prologue** (7 dark flashback stills with caption boxes: first contact, the summit,
"...in business", the first alien-owned company, the 80% hostile takeover, humans hiding, then the empty fridge; click/Enter pages, ESC skips;
each still is painted once and cached) -> isometric intro (wake up, mirror + character creator, breakfast with mom,
name entry, wallet from the stand, weapon from the chest, out the door; ESC skips) -> arrival shot outside (iso view, then the camera pans into first person) -> **get to MOO-MART now**
(follow the beam, north-east) -> the door is locked until 9 AM -> **survive 3 waves of alien recruiters** (the clock runs
8:30 -> 9:00) -> the store opens -> get the milk.
**Chapter 2 - inside MOO-MART (isometric stealth, `store.js`):** recruiters patrol with vision cones (yellow -> orange -> red); shelves
block sight. Hold C to sneak (quiet, shorter detection range), Shift runs (loud - they hear you). Space/click from behind or the side
= instant takedown. Get spotted and it's a small turn-based battle (Slash / Heavy Slash / Guard / Coffee / Run). Grab the milk from the
dairy fridges (E), pay at the register (E) while the cashier bonks a recruiter with a baguette, then walk out the exit - back on the
street to head home (next chapter). Debug keys inside the store: 3 battle, 5 all guards down, 6 milk + paid, 8 heal.

Lose and you're **hired**: a game-over scene of you in a suit, typing in an BizNes Corp cubicle forever, with NEW GAME / EXIT.

## Controls (all rebindable in OPTIONS, plus mouse sensitivity and field of view)
WASD move - Shift sprint - Space jump / wall-jump / mantle - C slide - Q dash - E wall flip (skill) - Left click slash (3-hit combo) - Right click block/parry
Cutscenes: hold F to fast-forward, ESC to skip the intro.

## Debug mode (testing)
Press **`** (backtick) anywhere to toggle a debug panel: frame ms / FPS, state + phase, wave and enemy counts, position, speed,
dash/air-jump/style, HP/level/SP. While it is open the number keys are actions:
1 god mode - 2 +5 skill points - 3 spawn recruiter - 4 spawn boss - 5 kill all - 6 next wave (also skips the store walk) -
7 max all skills - 8 full heal - 9 teleport to the store - 0 time scale (1x / 0.5x / 0.25x / 2x).

## Movement + flow
- **Dash:** 2 charges (1.1 s recharge each); every kill refunds one.
- **Double jump:** tap jump in the air; it bends your momentum toward your input. Refreshes on landing, wall-jumps and jump pads.
- **Ground slam:** slide key in the air. Shockwave on landing; hold jump to bounce ~2x a normal jump, hold slide to shoot into a slide.
- **Momentum:** moving fast adds up to +60% damage.
- **Style rank (D-C-B-A-S):** rises with kills, air/slide/wall kills, flips, parries; drains when you stand still or get hit. Higher rank = more XP; A/S heal on kill.
- **Jump pads:** five yellow pads; four launch you onto the rooftops.

## Music
`music.js` generates a calm lo-fi track live (no audio files): electric-piano jazz chords, soft bass, a swung lazy beat, a sparse
bell melody, vinyl crackle and tape wobble. It starts on your first click/key (browser audio rule), opens up slightly during waves,
and has its own volume slider in OPTIONS (sound effects have a separate slider).

## Healing
Coffee cups (recruiters sometimes drop one, the boss drops 3; +15, they drift to you when hurt) and the two vending machines on the
south sidewalk (+40, once per wave, restock when the next wave starts). Kills also heal a little.

## Boss: the Hiring Manager (wave 3, then every 5th wave)
Twice a recruiter's height, pinstripe suit, tentacles. Slam (red ground ring - jump it), Grab (tentacle reel-in - dash to break free),
Offer-letter barrage (deflect with a slash or block), Charge, and Calling HR (summons recruiters at 66% / 33% health). Parry his melee to stagger him.

## Levels and the skill tree (sword)
Kills and cleared waves give XP; each level gives 1 skill point. Spend them in Pause > Skills (arrow keys/WASD or mouse, Enter/click to buy,
RESET TREE refunds everything). Each weapon will get its own tree.
- **BLADE:** Sword Slash (5 ranks, +12% damage) -> Whirlwind (needs Slash 2) -> Launcher (needs Slash 3; air combat)
- **MOBILITY:** Footwork (3 ranks, faster dash recharge) -> Dash Slash (Footwork 1), Slide Chain (Footwork 2), Wall Flip (Footwork 3)
- **BODY:** Vitality (5 ranks, +15 HP) -> Iron Guard (Vitality 2; bigger parry window) -> Second Wind (Iron Guard 2; survive one lethal hit per wave)
Weapons shown but locked (coming soon): chain, battle axe, greatsword, gauntlet, auto crossbows.

## Files
| file | what it is |
|---|---|
| `index.html` | page shell, loads the scripts in order |
| `art.js` | palettes, quantizer, procedural textures and shopfront facades |
| `sprites.js` | alien recruiters + the customizable person (small sprite and detailed portrait) |
| `world.js` | the street arena, collision boxes, sky |
| `game.js` | movement, combat, skills, levels, enemies, waves, store objective, menus, rebinding, saving, outline pass |
| `intro.js` | isometric cutscene, character creator, name entry, weapon chest |
| `three.min.js` | three.js r128 (vendored, works offline) |
| `main.js`, `package.json`, `build.js`, `BUILD EXE.bat` | Electron packaging only |

Settings, character and the Continue save live in browser/app localStorage.
