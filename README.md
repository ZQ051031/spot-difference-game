# Little Elsewhere

[![make.fun bounty](https://make.fun/badge/best-spot-the-difference-game-20261121-0451.svg)](https://make.fun/bounty/best-spot-the-difference-game-20261121-0451)
[![Rank](https://make.fun/badge/best-spot-the-difference-game-20261121-0451/ZQ051031/spot-difference-game/rank.svg)](https://make.fun/bounty/best-spot-the-difference-game-20261121-0451)
[![Reward](https://make.fun/badge/best-spot-the-difference-game-20261121-0451/ZQ051031/spot-difference-game/reward.svg)](https://make.fun/bounty/best-spot-the-difference-game-20261121-0451)

A quiet game about the art of noticing. Explore five original, procedurally illustrated postcards, from a dusk harbour to a moonseed conservatory. Discover seven changing details in each scene, with gentle hints, synthesized sounds, optional sequenced music, and a locally saved personal best. Built with Canvas 2D and plain JavaScript: no libraries, build step, or external game resources.

![The quiet harbour: three differences left to discover](screenshots/1-play.jpg)

## Controls

- **Click either picture** to check a detail.
- **Arrow keys / WASD** move the crosshair; hold **Shift** to move faster.
- **Space / Enter** check at the crosshair, or continue from a menu.
- **H** uses a hint (three per postcard).
- **P / Esc** pause or resume.
- **M** toggles music; **N** toggles sound effects.

Misses add five seconds and a small score penalty. Several quick misses briefly lock clicks. Find all seven differences to collect a postcard; complete all five to see your final score.

## Run it

Use Node.js 22 or newer:

```sh
node serve.ts
```

Open http://localhost:8080 in desktop Chrome. Add `?seed=1` for a repeatable selection of differences.

Generate the submission dossier:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/dossier.json` and copies the game and screenshots into `out/`.

For screenshot and gameplay verification, run Chrome with `--headless=new --remote-debugging-port=9222` while the local server is running, then run `node tools/check.mjs`. The helper reads `shots.json`, verifies the four staged views and a full playthrough, and captures unedited 1600×900 JPEGs into `screenshots/` (plus PNG checks in `/tmp/check/`).

---

Made for [make.fun](https://make.fun/?ref=vbrytm16).
