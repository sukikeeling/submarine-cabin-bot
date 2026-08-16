# THIRD-PARTY NOTICES

This project (submarine-cabin-bot) is a derivative work. The following
upstream projects are used, all under the MIT License.

## vibe-submarine

- **Repository**: https://github.com/zhulin025/vibe-submarine
- **Author**: zhulin025 (Scott Sun)
- **License**: MIT — Copyright (c) 2026 Scott Sun
- **Used for**: Three.js WebGPU scene architecture (procedural geometry,
  porcelain/brass materials, studio lighting, submarine model), copied into
  `src/submarine/` and adapted for embedding a pet bot inside the cabin.

## moodie-pet

- **Repository**: https://github.com/sukikeeling/moodie-pet
- **Author**: sukikeeling
- **License**: MIT — Copyright (c) 2026 sukikeeling
- **Used for**: The pet face animation engine (25 expressions, 39 states,
  auto-polling scheduler), ported to a pure-logic module in `src/bot/face-engine.js`
  and rendered to a Canvas hologram sphere.

## LaoA-GrokBot

- **Repository**: https://github.com/zhulin025/LaoA-GrokBot
- **Author**: zhulin025 (老A玩AI)
- **License**: MIT
- **Used for**: Original expression coordinate data and animation engine
  (via moodie-pet, which is itself a port of this project).

## Third-party runtime libraries

- **three.js** (MIT) — 3D engine, `three` npm dependency
- **vite** (MIT) — build tooling, devDependency

MIT License texts of upstream projects are preserved in their respective
repositories. This project adds no additional restrictions on top of MIT.
