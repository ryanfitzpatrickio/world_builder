# World Builder

A browser-based modular level editor for drawing and generating western interior/exterior spaces. It uses Vite, Three.js, deterministic modular rules, and WFC-style tile constraints.

## Features

- Draw rooms, corridors, and bridges on a grid.
- Rebuild level structure from authored plans.
- Generate western saloon-style floors, walls, doors, windows, roof cues, props, and lighting.
- Paint individual floors, walls, doors, windows, props, supports, and empty cells.
- Configure level-wide rules from the UI.
- Select and tune generated lights.
- Debug WFC state and tile/cell metadata.
- Includes a classified western texture atlas manifest at `src/assets/atlases/western-town-atlas.json`.

## Quick start

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run debug:level
```

## Controls

- Left click: use the active editor tool.
- Command + left drag: orbit camera.
- Shift + left drag: pan camera.
- Mouse wheel: zoom.
- WASD: pan camera.
- Shift + WASD: fast pan.

## Project structure

- `src/app`: Three.js app shell and shared app utilities.
- `src/editor`: selection, drawing, brush, and inspector tools.
- `src/grid`: grid cells, rasterization, and classification.
- `src/plan`: authored room/corridor/bridge shapes.
- `src/rules`: deterministic modular build rules.
- `src/wfc`: tile definitions, sockets, constraints, and solver.
- `src/assets`: theme tile definitions and atlas metadata.
- `src/render`: Three.js visual layers.
- `vitexec`: browser-based debug checks.

## Notes

The western atlas JSON is currently classified from a supplied reference image. The actual atlas PNG is not committed yet, so several wall/floor materials use procedural placeholder textures until atlas UV sampling is wired in.
