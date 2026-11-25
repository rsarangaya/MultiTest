# STATUS - The Super Slasher 5000

Updated: 2026-11-24 (chapter select added)

## What it is
First-person hack & slash (three.js, plain HTML/JS, optional Electron portable exe). Pixel-art look from the *Dead-End Job* opening
(style reference only). Aliens run the planet through **BizNes Corp**; the player just wants milk. See `README.md` for flow and controls.

## Story structure
- **Chapter 1 - the milk run:** comic prologue -> isometric intro (wake up, mirror/creator, mom, wallet, sword, door) -> arrival shot -> street, knock on the closed
  MOO-MART door -> street waves 1-3 (Hiring Manager boss at wave 3) -> MOO-MART opens: isometric stealth store (`store.js`) -> leave -> **the way home**: street fight
  ending with the Hiring Manager *again* (phase `home`) -> beacon + HOME sign (phase `gohome`) -> **homecoming cutscene**: mom ("You took forever. Did you get the milk?" ...
  "Quit being a baby. You lived."), up the stairs, sleep -> `END OF CHAPTER 1`.
- **Chapter 2 - the next day** (NOT finished: it ends when you are back home): `CHAPTER 2 / THE NEXT DAY`. You wake up and *control* the character in the isometric rooms (no mirror): bedroom ->
  stairs -> kitchen, E to talk to mom (she sends you to pick up her order in the next town, by train), grab the wallet, take the sword, out the door -> arrival shot -> **Station Road**
  (no waves: a constant rush of recruiters that gets thicker toward the station) -> at the entrance a **first-person cutscene**: tentacles grab you, you are hoisted and dragged
  away, thrown (tumbling camera) into the station hall -> **1v1 vs the Career Counselor** (coffee drops every ~10 s) -> back out on the plaza (phase `gostation`): walk into the station ->
  **isometric station interior** (`stationInteriorScript`, `drawStationHall`): talk to the clerk and buy a ticket (turnstiles stay shut until you have one), the ticket machine is broken,
  Platform 1 (HR Express) and 3 (out of service) are jokes, Platform 2 = the Nextown Local -> `ALL ABOARD` card -> **the train: a side-scrolling, Street-Fighter-style brawler** (`train.js`,
  state `train`) through three cars, first pass ends with `TO BE CONTINUED` (Nextown, mom's order and the way back home are still to build; **chapter 2 ends only when you are home**).
  Brawler: one lane, 2D: A/D move, SPACE/W jump, S/C crouch (ducks thrown memos), click/J = 3-hit sword combo (3rd hit is heavy), right-click/K block (a block in the first ~0.2 s is a PARRY and
  staggers the attacker), Q dash (i-frames), E whirlwind (3.4 s cooldown), air attacks. Each car has scripted waves (they spawn from both screen edges and lock the camera until cleared;
  "GO >>" unlocks the door). **Skill-gated:** WHIRLWIND (E) needs the Whirlwind skill, a slash during a dash needs DASH SLASH, heavy hits launching/juggling enemies needs LAUNCHER, a lethal hit leaving you at 25 HP needs SECOND WIND
  (once per car); IRON GUARD widens the parry window; the dash cooldown follows FOOTWORK. The basic combo, jump, crouch, block and dash are always available. Locked moves show a hint; the HUD only lists unlocked moves.
  **Feel (second pass):** attack/jump/dash/whirlwind presses are buffered ~0.2 s (read every frame, so none are lost in hit-stop, and combos chain from a mash); walking eases in/out; every swing steps
  forward and has wind-up / strike / recover poses; hit-stop is shorter; everything draws on whole pixels. Enemies spawn just off-screen, walk in (`entering`), then are clamped inside the locked screen
  (`trClampE`), so none sit outside the picture.
  **Cars:** 5 (CAR 1-4 + the BOSS CAR). **More enemies:** INTERN (tiny, fast, 2 HP, comes in swarms), SECURITY GUARD (riot shield blocks light front hits; the heavy 3rd hit, whirlwind, dash slash,
  jump-ins and hits from behind get through; a heavy hit breaks the shield for ~2 s). **Boss: THE EFFICIENCY CONSULTANT** (`trUpdateConsultant`, HP 70, ignores light hits): PINK SLIPS (low = jump, mid = crouch),
  a WARP behind you (red marker) into a snip, a SLAM with floor shockwaves (jump them); at 75 / 50 / 25% HP he DOWNSIZES: bulkheads slam in and shrink the arena (452 -> ~234 px) and he calls in
  recruiters while invulnerable. Beating him unlocks the exit -> `TO BE CONTINUED`.
  **Coffee on the train:** higher drop rates (grunt/runner/thrower 30%, guard 50%, inspector 70%, intern 12%), a free cup after every cleared wave (two after a car's last wave), and in the boss car a
  cup every ~9 s plus two at each downsizing, so heavy fights can always be healed through.
  **Look:** a train car interior (rounded windows with blinds, adverts, grab rail + swaying straps, continuous bench), scenery that whips past (far skyline, mid buildings, blurred telegraph poles + wires, embankment), tunnels every ~14 s (dark, streaking lights, dimmed car), rail clack sound + a small jolt and sway. Enemies are the same recruiters (grunt punch, runner lunge, thrower memos you can deflect, Ticket Inspector with armour + baton sweep). Coffee drops, XP, style
  rank and skill bonuses apply.
- Phases (`OBJ.phase`): `arrive goto cut survive open enter (store) home gohome homecoming nextday station pulled boss bossdone gostation ticket train traindone`. Saves/Continue cover all of them
  (`beginGame(sv)`): station/boss, plaza (`backToPlaza`), station interior, and the train car you were in (`startTrain(car)`). Dying in the hall or on the train offers CONTINUE.

## Testing helper
- **CHAPTER SELECT (TESTING)** on the main menu (`chapterItems()` in `game.js`): jump to 1.1 intro, 1.2 street, 1.3 waves, 1.4 store, 1.5 way home, 1.6 homecoming,
  2.1 next day, 2.2 Station Road, 2.3 Career Counselor. Keeps your current level/skills (debug key 7 maxes them). Remove the menu item + `chapterItems()` when done testing.

## Files
`index.html`, `art.js` (textures, facades incl. the station), `sprites.js` (people, enemies, bosses incl. the Career Counselor), `world.js` (street), `game.js` (logic, HUD,
menus), `music.js`, `intro.js` (iso scenes: intro, homecoming, next day + free roam), `store.js` (chapter 1 store), `station.js` (chapter 2: Station Road, hall, pull/throw
cutscene, Career Counselor, plaza + walk-in), `train.js` (the train brawler, part of chapter 2), `three.min.js`; packaging: `main.js`, `package.json`, `build.js`, `BUILD EXE.bat`, `START HERE.bat`. `deadendtest\` holds an old v2 copy (not used).
Beware: scripts share one global scope, so new helper names must not collide with existing ones (`STA`, `SX`, `AZ`, `PULL`, `FLIP`, `BON`, `ROOF`, `HOME` are taken).

## How the new pieces work
- **Iso scene runner** (`intro.js`): `startScene(genFn)` runs a generator script (`A.say`, `A.walk`, `A.fade`, `A.title`, `A.free`...). `A.free()` is player-controlled walking
  (`freeStep`, furniture rectangles in `SCENE_ROOMS`, interaction spots in `freeSpots`). A script ends with `IN.next = fn` (what to start next); ESC runs `IN.skipFn`.
- **Station map** (`station.js`): lives at x = 500 (street is at the origin) so nothing overlaps; the hall is at z = -300. `beginStation()` -> `updateStation()` (spawner) ->
  `startPull()/updatePull()/drawTentacles()` -> `enterArena()` + `updateThrow()` -> `spawnCounselor()` / `updateCounselor()`.
- **Ticket Inspector** (`kind:'inspector'`, chapter 2 elite recruiter, `paintInspectorRaw`): HP 16 (recruiter 6), ignores light hits (heavy swings, the launcher and parries still stagger him), long
  readable windup then a wide baton sweep for 22 damage, 60% chance to drop coffee, 36 XP. **Whistle:** every ~9-12 s (when he has recruiters within 15 m and you are > 5.5 m away) he raises his arm for 0.8 s, then every recruiter within 15 m is hurried
  for 4.5 s (x1.5 speed, faster attacks, glows yellow). Stagger him during the windup (heavy swing, launcher, parry) to cancel it. Spawns on Station Road: ~6% at the start, ~22% near the station, at most 2-4 at once (`spawnRushEnemy`).
- **Counselor** (`kind:'boss'`, `sub:'counselor'`, skin `counselor`): QUIZ (fan of answer sheets, deflectable), REVIEW (slow ground ring - jump it), RED PEN (three quick stabs),
  below 50% HP faster + double quiz; COFFEE BREAK every ~10 s drops a cup in the hall. HP 80. Parrying staggers him like the Hiring Manager.
- **Movement = damage** (`momentumInfo()`, additive, capped at +150%, +10% per style rank): SPEED, CHARGE, PLUNGE, FLIP, WALL RUN, SLIDE, jump-pad LAUNCH, COMBO,
  CLOSE CALL (dodge at speed), ROOFTOP (route of 4 tokens on the roofs the pads lead to), STYLE. HUD shows `DAMAGE xN` + the active bonuses.
- **Pan-out camera** (`panCam()`): wall flips (somersault seen from behind / side-flip roll), ground slam (head-first dive) and whirlwind pan out to third person.
- **Launcher slash** sends enemies ~5.5 m up; you spring after them with your air jump ready.
- **Store** (`store.js`): 16x11 map, 5 guards, recruiter battles HP 30. Door-rattle arm animation, fade transitions in/out (`FADE`/`fadeTo()`).
- **Mobile (testing build):** taps = clicks; intro, scenes and menus work with on-screen WASD/OK/FAST/SKIP buttons; name entry is a real text box. Street, store and boss
  have no touch controls yet (a MENU button is shown).

## Rest of chapter 2 (to build)
- Arrival in Nextown and the pickup counter for mom's order, then the way back and **home** (that ends chapter 2). (The Middle Manager boss idea below is free for a later chapter.)
- More brawler moves: launcher + juggle, a charged heavy, enemy grabs; a car with a **drink cart** hazard or **passengers** to protect; the same movement-damage idea (speed/combo/style) tuned for 2D.

## Other boss ideas (not built)
Each fits the "BizNes Corp ruins a normal errand" tone and reuses the boss framework (`kind:'boss'` + `sub` + a skin + an `update...` function).
- **The Landlord** (chapter 3, apartment block): rent-due timer; floors "evict" (collapse into hazards), throws eviction notices, summons a leaf-blower swarm; hit his
  "security deposit" glowing weak point after he overextends.
- **The Middle Manager** (train): fights across train cars; tells you to "loop in" copies of himself (clones with one real one), CC-all email blast fills the screen.
- **The Compliance Officer**: arena of laser tripwires and form-filling; you can only damage him while you are standing in the "approved" colored squares, which move.
- **The Gym Franchise Owner**: rooftop muscle-suit boss, dumbbell throws and slams; his membership drones are hit-and-run; vulnerable while "cancelling" (you must interrupt).
- **The Influencer (Brand Ambassador)**: floating camera drones; any hit gets filmed - if you stay in the spotlight too long you get "cancelled" (debuff). Fight in a mall.
- **The Customer Service Rep**: hold music zone slows you; "please hold" shield; you win by parrying six scripted lines in a row.
- **The Tax Auditor**: stamps arena tiles red (audit zones); fire-sale phase where he drops loot you must grab fast.
- **BizNes Corp CEO** (final): a rocket-chair, several phases, one per earlier boss's move set; ending depends on the optional objectives.

## Done earlier (kept for reference)
- Main menu, options, save/continue, debug mode (` key; 6 skips the current phase, 9 teleports to the next objective). Timing fix (fixed 1/60 s sub-steps), freeze fix (the
  `burst()` name clash; `frame()` catches errors per frame), skill tree (sword), levels, style rank, dash/double jump/slam, coffee + vending healing, procedural music,
  game-over "hired" cubicle scene, rename OmniCorp -> BizNes Corp.
- Rooftop routes, close call, style-rank scaling, launcher; flip/slam/whirl pan-outs; jump pads keep your momentum.

## Verified (scripted, in the preview browser)
- Same walk distance at 30/60/144/240 Hz; 40 s of simulated play without console errors.
- Chapter 1 door + store + leave; homecoming + sleep + next-day free roam with real key presses; Station Road rush; pull/throw into the hall; every Counselor move, phase 2,
  coffee drop, defeat -> end title -> menu; death in the hall -> Continue -> back in the hall; touch intro + name box. (Headless browser: slow, so timings were checked by state, not feel.)

## Not verified
- Not hand-played with a real mouse / pointer lock; the `.exe` is not rebuilt. Boss difficulty, rush density and the Counselor's HP are untuned guesses.
- Small one-off hitches remain on first use of some content (about 70 ms once mid-fight, about 60 ms on the first death-screen paint).

## Next / ideas
- Finish chapter 2 (Nextown + mom's order + the way home), then chapter 3; the Landlord / Middle Manager bosses above.
- Other weapons + their trees (chain with grapple, axe, greatsword, gauntlet, crossbows); snipers at higher levels; air combat as an unlock.
- Touch controls for the street/boss; pre-warm speech-bubble and death-scene textures.
