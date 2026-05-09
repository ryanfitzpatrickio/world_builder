import { ThreeApp } from './app/ThreeApp.js';
import { EventBus } from './app/EventBus.js';
import { CommandHistory } from './app/CommandHistory.js';
import { PlanDocument } from './plan/PlanDocument.js';
import { Grid3D } from './grid/Grid3D.js';
import { rasterizePlanToGrid } from './grid/Rasterizer.js';
import { classifyCells } from './grid/CellClassifier.js';
import { ModularBuilder } from './rules/ModularBuilder.js';
import { prepareWFCConstraints } from './wfc/ConstraintMask.js';
import { WFCSolver } from './wfc/WFCSolver.js';
import { ModularAssetRegistry } from './assets/ModularAssetRegistry.js';
import { GridView } from './render/GridView.js';
import { ShapeView } from './render/ShapeView.js';
import { TileView } from './render/TileView.js';
import { HighlightView } from './render/HighlightView.js';
import { SocketLabelView } from './render/SocketLabelView.js';
import { GhostPreviewView } from './render/GhostPreviewView.js';
import { InspectorPanel } from './editor/InspectorPanel.js';
import { DebugPanel } from './editor/DebugPanel.js';
import { SelectionTool } from './editor/SelectionTool.js';
import { DrawingTool } from './editor/DrawingTool.js';
import { BrushTool } from './editor/BrushTool.js';

const sidebar = document.getElementById('sidebar');
const viewport = document.getElementById('viewport');
const debugPanel = new DebugPanel();
const inspector = new InspectorPanel();
const registry = new ModularAssetRegistry();
const tileSet = registry.getTileSet();

const eventBus = new EventBus();
const history = new CommandHistory(128);
const plan = new PlanDocument();
const grid = new Grid3D({ width: 40, height: 4, depth: 40, cellSize: 1, originX: -20, originZ: -20 });
const app = new ThreeApp({
  container: viewport,
  onPointerDown: onPointer,
  onPointerMove: onMove,
  onPointerUp: () => {},
});

const gridView = new GridView(app.scene, grid);
const shapeView = new ShapeView(app.scene, grid);
const tileView = new TileView(app.scene, registry);
const highlight = new HighlightView(app.scene, grid);
const socketLabel = new SocketLabelView(viewport);
const ghostPreview = new GhostPreviewView(app.scene);

const selectionTool = new SelectionTool();
const drawingTool = new DrawingTool();
const brushTool = new BrushTool();

const ruleToggles = {
  walls: true,
  doors: true,
  windows: true,
  bridges: true,
  roofs: true,
  props: true,
};

const typeConfig = {
  floor: { texture: 'woodPlanks' },
  wall: { texture: 'crackedPlaster', trim: 'darkWood' },
  door: { maxPerShape: 2, frequency: 100, texture: 'saloonWood' },
  window: { maxPerShape: 3, frequency: 25, texture: 'woodFrame' },
  roof: { texture: 'corrugatedRust', lightFrequency: 16 },
  prop: { density: 38, allowHallways: false, lighting: true, set: 'saloon' },
};

const lightingConfig = {
  sunIntensity: 1.25,
  sunElevation: 38,
  sunAzimuth: 305,
  skyFill: 0.72,
  interiorAmbient: 0.18,
  exposure: 1.08,
  roofShadows: true,
};

const brushPalette = [
  { id: 'floor-western', group: 'Floors', label: 'Wood floor', note: 'walkable plank cell', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable'] },
  { id: 'wall-plaster', group: 'Walls', label: 'Plaster wall', note: 'plain wall', occupancy: 'wall', fixedTile: 'wall_western_plaster', style: 'western', tags: ['wall', 'verticalSurface'] },
  { id: 'wall-corner', group: 'Walls', label: 'Corner post', note: 'timber post wall', occupancy: 'wall', fixedTile: 'wall_western_corner_post', style: 'western', tags: ['wall', 'corner', 'verticalSurface'] },
  { id: 'door-saloon', group: 'Openings', label: 'Saloon door', note: 'forced door', occupancy: 'wall', fixedTile: 'wall_western_swing_door', style: 'western', tags: ['wall', 'forcedDoor', 'variantDoor', 'verticalSurface'] },
  { id: 'window-wood', group: 'Openings', label: 'Window', note: 'forced window', occupancy: 'wall', fixedTile: 'wall_western_window', style: 'western', tags: ['wall', 'variantWindow', 'verticalSurface'] },
  { id: 'rail-western', group: 'Walls', label: 'Railing', note: 'boardwalk rail', occupancy: 'wall', fixedTile: 'wall_western_railing', style: 'western', tags: ['wall', 'railing', 'verticalSurface'] },
  { id: 'roof-trim', group: 'Roof', label: 'Roof trim', note: 'ceiling/roof cue', occupancy: 'roof', fixedTile: 'roof_western_trim', style: 'western', tags: ['roof'] },
  { id: 'bridge-boardwalk', group: 'Floors', label: 'Boardwalk', note: 'bridge/deck cell', occupancy: 'bridge', fixedTile: 'bridge_western_boardwalk', style: 'western', tags: ['bridge', 'walkable'] },
  { id: 'support-post', group: 'Walls', label: 'Support post', note: 'vertical support', occupancy: 'support', fixedTile: 'support_western_post', style: 'western', tags: ['support', 'verticalSurface'] },
  { id: 'prop-bar', group: 'Props', label: 'Bar counter', note: 'saloon bar', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propBarCounter', 'propFacePZ'] },
  { id: 'prop-poker', group: 'Props', label: 'Poker table', note: 'table and stools', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propPokerTable', 'propFacePZ'] },
  { id: 'prop-barrel', group: 'Props', label: 'Barrels', note: 'barrel stack', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propBarrelStack', 'propFacePZ'] },
  { id: 'prop-shelf', group: 'Props', label: 'Wall shelf', note: 'shelf prop', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propShelf', 'propFacePZ'] },
  { id: 'prop-bed', group: 'Props', label: 'Cot bed', note: 'lodging prop', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propBedCot', 'propFacePZ'] },
  { id: 'prop-piano', group: 'Props', label: 'Piano', note: 'saloon piano', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propPiano', 'propFacePZ'] },
  { id: 'prop-lantern', group: 'Props', label: 'Lantern', note: 'physical light', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propLanternStand', 'propFacePZ'] },
  { id: 'prop-crates', group: 'Props', label: 'Crates', note: 'crate stack', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propCrateStack', 'propFacePZ'] },
  { id: 'empty-cell', group: 'Erase', label: 'Empty', note: 'clear generated cell', occupancy: 'empty', fixedTile: 'empty', style: 'western', tags: ['empty'] },
];

let currentTool = 'select';
let currentFloor = 0;
let currentStyle = uiStyleValue();
let selectedCell = null;
let selectedLightId = null;
let wfcSeed = 1;
let lastGeneratedBounds = null;
let hasAutoFitInitialView = false;
const solver = new WFCSolver({ seed: wfcSeed, maxIterations: 2500 });

const builder = new ModularBuilder(ruleToggles);

const ui = {
  toolButtons: new Map(),
  clearSelection: document.getElementById('clear-selection'),
  rebuild: document.getElementById('rebuild'),
  clearPlan: document.getElementById('clear-plan'),
  autoRebuild: document.getElementById('auto-rebuild'),
  runWfc: document.getElementById('run-wfc'),
  stepWfc: document.getElementById('step-wfc'),
  resetWfc: document.getElementById('reset-wfc'),
  floorSelect: document.getElementById('current-floor'),
  styleSelect: document.getElementById('current-style'),
  seedInput: document.getElementById('wfc-seed'),
  forceTileSelect: document.getElementById('force-tile'),
  configKind: document.getElementById('config-kind'),
  configDescription: document.getElementById('config-description'),
  configControls: document.getElementById('config-controls'),
  brushCurrent: document.getElementById('brush-current'),
  brushPalette: document.getElementById('brush-palette'),
  lighting: {
    sunIntensity: document.getElementById('lighting-sun-intensity'),
    sunElevation: document.getElementById('lighting-sun-elevation'),
    sunAzimuth: document.getElementById('lighting-sun-azimuth'),
    skyFill: document.getElementById('lighting-sky-fill'),
    interiorAmbient: document.getElementById('lighting-interior-ambient'),
    exposure: document.getElementById('lighting-exposure'),
    roofShadows: document.getElementById('lighting-roof-shadows'),
  },
  rule: {
    walls: document.getElementById('rule-walls'),
    doors: document.getElementById('rule-doors'),
    windows: document.getElementById('rule-windows'),
    bridges: document.getElementById('rule-bridges'),
    roofs: document.getElementById('rule-roofs'),
    props: document.getElementById('rule-props'),
  },
};

inspector.setTileOptions(registry.listTileIds());
const firstTile = registry.listTileIds()[0];
renderBrushPalette();
setBrush(brushPalette.find((brush) => brush.id === 'wall-plaster') || brushPalette[0]);
wireLightingControls();
applyLightingConfig();

for (const tool of ['select', 'room', 'corridor', 'bridge', 'erase', 'brush']) {
  const button = document.getElementById(`tool-${tool}`);
  if (!button) continue;
  ui.toolButtons.set(tool, button);
  button.addEventListener('click', () => setTool(tool));
}

ui.floorSelect.addEventListener('change', () => {
  currentFloor = Number(ui.floorSelect.value);
  if (currentTool === 'select') debugPanel.log(`Current floor set to ${currentFloor}`);
});
ui.styleSelect.addEventListener('change', () => {
  currentStyle = ui.styleSelect.value;
});

for (const [key, checkbox] of Object.entries(ui.rule)) {
  checkbox.addEventListener('change', () => {
    ruleToggles[key] = checkbox.checked;
    if (ui.autoRebuild.checked) rebuild();
  });
}

ui.rebuild.addEventListener('click', () => rebuild());
ui.clearPlan.addEventListener('click', () => {
  plan.clear();
  shapeView.update(plan);
  rebuild();
});
ui.autoRebuild.addEventListener('change', () => {
  debugPanel.log(`Auto rebuild ${ui.autoRebuild.checked ? 'on' : 'off'}`);
});

ui.clearSelection.addEventListener('click', () => {
  selectedCell = null;
  selectedLightId = null;
  selectionTool.clear();
  highlight.setSelected(null);
  inspector.update(null);
  renderConfigPanel(null);
});

ui.runWfc.addEventListener('click', () => {
  runWfcOnly();
});
ui.resetWfc.addEventListener('click', () => {
  for (const c of grid.getAllCells()) {
    c.collapsedTile = null;
  }
  runWfcOnly();
});
ui.stepWfc.addEventListener('click', () => {
  runWfcOnly();
});

ui.forceTileSelect.addEventListener('change', () => {
  if (!selectedCell) return;
  if (!ui.forceTileSelect.value) {
    selectedCell.lockedByUser = false;
    selectedCell.fixedTile = null;
    selectedCell.possibleTiles = new Set();
  } else {
    const tileId = ui.forceTileSelect.value;
    brushTool.setTile(tileId);
    brushTool.apply(selectedCell);
  }
  if (ui.autoRebuild.checked) rebuild();
});

ui.seedInput.addEventListener('change', () => {
  wfcSeed = Number(ui.seedInput.value || 1);
  solver.seed = wfcSeed;
});

plan.addRoom(
  [
    { x: -6, z: -4 },
    { x: 2, z: -4 },
    { x: 2, z: 2 },
    { x: -6, z: 2 },
  ],
  0,
  'western'
);
plan.addCorridor({ x: 2, z: -1 }, { x: 8, z: -1 }, 2, 0, 'western');
plan.addBridge([{ x: 8, z: -1 }, { x: 15, z: -1 }], 2, 1, 'western');

setTool('select');
rebuild();
installDebugApi();
renderConfigPanel(null);

function setTool(tool) {
  currentTool = tool;
  drawingTool.setMode(tool);
  ghostPreview.clear();
  for (const [id, button] of ui.toolButtons) {
    button.classList.toggle('active', id === tool);
  }
}

function uiStyleValue() {
  return document.getElementById('current-style')?.value || 'western';
}

function onPointer({ point, objectHit }) {
  const hit = grid.cellAtWorld(point.x, Math.max(0, currentFloor), point.z);

  if (currentTool === 'select') {
    if (objectHit?.object?.userData?.selectableType === 'light') {
      selectLight(objectHit.object.userData.lightId);
      return;
    }
    if (!hit) return;
    selectCell(hit);
    return;
  }

  if (!hit) return;

  if (currentTool === 'erase') {
    if (hit.shapeId) {
      plan.removeShapeById(hit.shapeId);
      shapeView.update(plan);
      if (ui.autoRebuild.checked) rebuild();
    } else if (hit.occupancy === 'wall' || hit.occupancy === 'support' || hit.occupancy === 'roof') {
      hit.occupancy = 'empty';
      hit.tags.clear();
      if (ui.autoRebuild.checked) rebuild();
    }
    return;
  }

  if (currentTool === 'brush') {
    if (!brushTool.brush) return;
    brushTool.apply(hit);
    if (ui.autoRebuild.checked) rebuild();
    else tileView.update(grid);
    return;
  }

  const created = drawingTool.handlePointer(
    snapWorldPoint(point),
    (kind, payload) => {
      if (kind === 'room') {
        return plan.addRoom(payload.points, currentFloor, currentStyle);
      }
      if (kind === 'corridor') {
        return plan.addCorridor(payload.points[0], payload.points[1], payload.width || 2, currentFloor, currentStyle);
      }
      return plan.addBridge(payload.points, payload.width || 2, currentFloor, currentStyle);
    },
    { floor: currentFloor, style: currentStyle }
  );

  if (created.handled) {
    updateGhostPreview(snapWorldPoint(point));
    if (created.message) {
      socketLabel.setText(`${created.message}. Move mouse to preview, click again to place.`);
      debugPanel.log(created.message);
    }
    if (created.shape) {
      ghostPreview.clear();
      shapeView.update(plan);
      if (ui.autoRebuild.checked) rebuild();
      debugPanel.log(`Created ${created.shape.type} ${created.shape.id}`);
    }
  }
}

function snapWorldPoint(point) {
  return {
    x: Math.round(point.x),
    z: Math.round(point.z),
  };
}

function onMove({ point }) {
  const snap = snapWorldPoint(point);
  updateGhostPreview(snap);
  const hovered = grid.cellAtWorld(point.x, Math.max(0, currentFloor), point.z);
  if (hovered) {
    highlight.setHover(hovered);
    if (drawingTool.start && ['room', 'corridor', 'bridge'].includes(currentTool)) {
      socketLabel.setText(`Preview ${currentTool}: start ${drawingTool.start.x},${drawingTool.start.z} -> ${snap.x},${snap.z}`);
    } else {
      socketLabel.setText(`hover x=${hovered.x} y=${hovered.y} z=${hovered.z} type=${hovered.occupancy}`);
    }
  }
}

function updateGhostPreview(point = null) {
  if (!['room', 'corridor', 'bridge'].includes(currentTool) || !drawingTool.start) {
    ghostPreview.clear();
    return;
  }

  ghostPreview.setPreview({
    mode: currentTool,
    start: drawingTool.start,
    end: point,
    floor: currentFloor,
    width: 2,
  });
}

function selectCell(cell) {
  selectedLightId = null;
  selectedCell = cell;
  selectionTool.pick(cell);
  highlight.setSelected(cell);
  inspector.update(cell);
  renderConfigPanel(cell);
  socketLabel.setText(`Selected: ${cell.key()} occupancy=${cell.occupancy}`);
  return cell;
}

function selectLight(lightId) {
  selectedLightId = lightId;
  selectedCell = null;
  selectionTool.clear();
  highlight.setSelected(null);
  inspector.update(null);
  renderLightConfigPanel(lightId);
  socketLabel.setText(`Selected light ${lightId}`);
}

function getRuleConfig() {
  return {
    walls: ui.rule.walls.checked,
    doors: ui.rule.doors.checked,
    windows: ui.rule.windows.checked,
    bridges: ui.rule.bridges.checked,
    stairs: true,
    roofs: ui.rule.roofs.checked,
    props: ui.rule.props.checked,
    typeConfig,
  };
}

function clearGenerated(changedRegion = null) {
  grid.clearGeneratedData(changedRegion);
  tileView.clear();
}

function rebuild(changedRegion = null) {
  tileView.setTypeConfig(typeConfig);
  tileView.setLightingConfig(lightingConfig);
  clearGenerated(changedRegion);
  rasterizePlanToGrid(plan, grid, changedRegion);
  classifyCells(grid, changedRegion);

  builder.apply(grid, getRuleConfig());

  prepareWFCConstraints(grid, tileSet);
  runWfcOnly(true);
  shapeView.update(plan);
  tileView.update(grid);
  lastGeneratedBounds = computeGeneratedBounds();
  if (!hasAutoFitInitialView) {
    app.fitToBounds(lastGeneratedBounds);
    hasAutoFitInitialView = true;
  }
  inspector.update(selectedCell);
  if (selectedLightId && tileView.getLightInfo(selectedLightId)) renderLightConfigPanel(selectedLightId);
  else renderConfigPanel(selectedCell);
  socketLabel.setText(`Rebuilt ${grid.getAllCells().length} cells`);
  debugPanel.log('Rebuild complete');
}

function computeGeneratedBounds() {
  let bounds = null;
  for (const cell of grid.getAllCells()) {
    const tileId = cell.collapsedTile || cell.fixedTile;
    if (!tileId || tileId === 'empty') continue;

    const position = grid.getWorldPosition(cell);
    const minX = position.x - 0.5;
    const maxX = position.x + 0.5;
    const minY = position.y;
    const maxY = position.y + 1;
    const minZ = position.z - 0.5;
    const maxZ = position.z + 0.5;

    if (!bounds) {
      bounds = { minX, maxX, minY, maxY, minZ, maxZ };
      continue;
    }

    bounds.minX = Math.min(bounds.minX, minX);
    bounds.maxX = Math.max(bounds.maxX, maxX);
    bounds.minY = Math.min(bounds.minY, minY);
    bounds.maxY = Math.max(bounds.maxY, maxY);
    bounds.minZ = Math.min(bounds.minZ, minZ);
    bounds.maxZ = Math.max(bounds.maxZ, maxZ);
  }
  return bounds;
}

function runWfcOnly(keepCollapsed = false) {
  solver.seed = Number(ui.seedInput.value || 1);
  for (const cell of grid.getAllCells()) {
    if (!keepCollapsed || cell.occupancy === 'empty') {
      cell.contradiction = false;
      if (!cell.lockedByUser && cell.occupancy !== 'empty') {
        cell.collapsedTile = null;
      }
    }
  }
  const ok = solver.run(grid, tileSet, { typeConfig });
  debugPanel.log(ok ? 'WFC solved' : 'WFC failed');
  tileView.update(grid);
  if (selectedCell) {
    const current = grid.getCell(selectedCell.x, selectedCell.y, selectedCell.z);
    selectedCell = current;
    inspector.update(selectedCell);
    renderConfigPanel(selectedCell);
  } else if (selectedLightId && tileView.getLightInfo(selectedLightId)) {
    renderLightConfigPanel(selectedLightId);
  }
}

function getSemanticType(cell) {
  if (!cell) return null;
  if (cell.tags.has('propCandidate')) return 'prop';
  if (cell.tags.has('forcedDoor') || cell.collapsedTile?.includes('door') || cell.fixedTile?.includes('door')) return 'door';
  if (cell.tags.has('variantWindow') || cell.collapsedTile?.includes('window') || cell.fixedTile?.includes('window')) return 'window';
  if (cell.occupancy === 'floor' || cell.occupancy === 'bridge') return 'floor';
  if (cell.occupancy === 'wall' || cell.tags.has('railing')) return 'wall';
  if (cell.occupancy === 'roof') return 'roof';
  return cell.occupancy === 'empty' ? null : cell.occupancy;
}

function renderConfigPanel(cell) {
  selectedLightId = null;
  const type = getSemanticType(cell);
  ui.configKind.textContent = type ? `${type.toUpperCase()} settings apply to the whole level` : 'Select a wall, floor, door, window, roof, or prop.';
  ui.configDescription.textContent = type
    ? `Selected cell ${cell.x}, ${cell.y}, ${cell.z}. Changes below affect all generated ${type} modules.`
    : '';
  ui.configControls.innerHTML = '';
  if (!type || !typeConfig[type]) return;

  if (type === 'floor') {
    addSelectControl(type, 'texture', 'Texture', [
      ['woodPlanks', 'weathered wood planks'],
      ['scuffedWood', 'dark scuffed wood'],
      ['stonePavers', 'stone pavers'],
      ['packedDirt', 'packed dirt'],
    ]);
  }

  if (type === 'wall') {
    addSelectControl(type, 'texture', 'Wall texture', [
      ['crackedPlaster', 'cracked plaster'],
      ['woodSiding', 'wood siding'],
      ['redPaintedWood', 'red painted wood'],
      ['brick', 'old brick'],
      ['corrugatedMetal', 'corrugated metal'],
    ]);
    addSelectControl(type, 'trim', 'Trim material', [
      ['darkWood', 'dark wood beams'],
      ['rawWood', 'raw timber'],
      ['metal', 'dark metal'],
    ]);
  }

  if (type === 'door') {
    addRangeControl(type, 'maxPerShape', 'Max doors per room/shape', 0, 6, 1);
    addRangeControl(type, 'frequency', 'Door frequency %', 0, 100, 5);
    addSelectControl(type, 'texture', 'Door style', [
      ['saloonWood', 'saloon wood'],
      ['plainWood', 'plain wood'],
      ['darkMetal', 'dark metal'],
    ]);
  }

  if (type === 'window') {
    addRangeControl(type, 'maxPerShape', 'Max windows per room/shape', 0, 10, 1);
    addRangeControl(type, 'frequency', 'Window frequency %', 0, 100, 5);
    addSelectControl(type, 'texture', 'Window style', [
      ['woodFrame', 'wood frame'],
      ['smallAdobe', 'small adobe opening'],
      ['wideShop', 'wide shop window'],
    ]);
  }

  if (type === 'roof') {
    addSelectControl(type, 'texture', 'Roof / ceiling texture', [
      ['corrugatedRust', 'rusted corrugated metal'],
      ['darkWood', 'dark timber'],
      ['hay', 'hay/thatch'],
    ]);
    addRangeControl(type, 'lightFrequency', 'Ceiling lantern frequency %', 0, 50, 1);
  }

  if (type === 'prop') {
    addRangeControl(type, 'density', 'Prop density %', 0, 100, 5);
    addCheckboxControl(type, 'allowHallways', 'Allow props in hallways');
    addCheckboxControl(type, 'lighting', 'Props can emit light');
    addSelectControl(type, 'set', 'Prop set', [
      ['saloon', 'saloon'],
      ['storage', 'storage'],
      ['lodging', 'lodging'],
      ['mixed', 'mixed'],
    ]);
  }
}

function renderLightConfigPanel(lightId) {
  const info = tileView.getLightInfo(lightId);
  ui.configControls.innerHTML = '';
  if (!info) {
    ui.configKind.textContent = 'Light no longer exists after rebuild';
    ui.configDescription.textContent = 'Select another light handle.';
    return;
  }

  ui.configKind.textContent = 'LIGHT settings';
  ui.configDescription.textContent = `Selected ${info.id} in cell ${info.cellKey}. These controls affect this individual light.`;
  addLightRangeControl(lightId, 'position.x', 'Local X', -1.5, 1.5, 0.01, info.position.x);
  addLightRangeControl(lightId, 'position.y', 'Local Y', 0, 2.4, 0.01, info.position.y);
  addLightRangeControl(lightId, 'position.z', 'Local Z', -1.5, 1.5, 0.01, info.position.z);
  addLightRangeControl(lightId, 'intensity', 'Intensity', 0, 3, 0.02, info.intensity);
  addLightRangeControl(lightId, 'distance', 'Range', 0.5, 10, 0.1, info.distance);
  addLightColorControl(lightId, info.color);
}

function addLightRangeControl(lightId, key, label, min, max, step, currentValue) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const value = document.createElement('small');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(currentValue);
  const sync = () => {
    value.textContent = `${label}: ${input.value}`;
  };
  sync();
  input.addEventListener('input', () => {
    sync();
    updateLightOverride(lightId, key, Number(input.value));
  });
  wrap.append(value, input);
  ui.configControls.appendChild(wrap);
}

function addLightColorControl(lightId, currentColor) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.textContent = 'Color';
  const input = document.createElement('input');
  input.type = 'color';
  input.value = currentColor;
  input.addEventListener('input', () => updateLightOverride(lightId, 'color', input.value));
  wrap.append(label, input);
  ui.configControls.appendChild(wrap);
}

function updateLightOverride(lightId, key, value) {
  const current = tileView.getLightInfo(lightId);
  if (!current) return;
  if (key.startsWith('position.')) {
    const axis = key.split('.')[1];
    tileView.setLightOverride(lightId, {
      position: {
        ...current.position,
        [axis]: value,
      },
    });
    return;
  }
  tileView.setLightOverride(lightId, { [key]: value });
}

function addSelectControl(type, key, label, options) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  const select = document.createElement('select');
  for (const [value, text] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  }
  select.value = typeConfig[type][key];
  select.addEventListener('change', () => updateTypeConfig(type, key, select.value));
  wrap.append(labelEl, select);
  ui.configControls.appendChild(wrap);
}

function addRangeControl(type, key, label, min, max, step) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const labelEl = document.createElement('label');
  const value = document.createElement('small');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(typeConfig[type][key]);
  const sync = () => {
    value.textContent = `${label}: ${input.value}`;
  };
  sync();
  input.addEventListener('input', sync);
  input.addEventListener('change', () => updateTypeConfig(type, key, Number(input.value)));
  wrap.append(labelEl, value, input);
  ui.configControls.appendChild(wrap);
}

function addCheckboxControl(type, key, label) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const labelEl = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!typeConfig[type][key];
  input.addEventListener('change', () => updateTypeConfig(type, key, input.checked));
  labelEl.append(input, ` ${label}`);
  wrap.appendChild(labelEl);
  ui.configControls.appendChild(wrap);
}

function updateTypeConfig(type, key, value) {
  typeConfig[type][key] = value;
  tileView.setTypeConfig(typeConfig);
  if (ui.autoRebuild.checked) rebuild();
  else tileView.update(grid);
}

function wireLightingControls() {
  const numericControls = [
    ['sunIntensity', ui.lighting.sunIntensity],
    ['sunElevation', ui.lighting.sunElevation],
    ['sunAzimuth', ui.lighting.sunAzimuth],
    ['skyFill', ui.lighting.skyFill],
    ['interiorAmbient', ui.lighting.interiorAmbient],
    ['exposure', ui.lighting.exposure],
  ];

  for (const [key, input] of numericControls) {
    input.addEventListener('input', () => {
      lightingConfig[key] = Number(input.value);
      applyLightingConfig();
    });
  }

  ui.lighting.roofShadows.addEventListener('change', () => {
    lightingConfig.roofShadows = ui.lighting.roofShadows.checked;
    applyLightingConfig();
    tileView.update(grid);
  });
}

function applyLightingConfig() {
  app.setLightingConfig(lightingConfig);
  tileView.setLightingConfig(lightingConfig);
}

function renderBrushPalette() {
  ui.brushPalette.innerHTML = '';
  const groups = new Map();
  for (const brush of brushPalette) {
    if (!groups.has(brush.group)) groups.set(brush.group, []);
    groups.get(brush.group).push(brush);
  }

  for (const [group, brushes] of groups) {
    const title = document.createElement('div');
    title.className = 'field';
    title.innerHTML = `<label>${group}</label>`;
    ui.brushPalette.appendChild(title);

    const gridEl = document.createElement('div');
    gridEl.className = 'brush-grid';
    for (const brush of brushes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'brush-option';
      button.dataset.brushId = brush.id;
      button.innerHTML = `${brush.label}<small>${brush.note}</small>`;
      button.addEventListener('click', () => {
        setBrush(brush);
        setTool('brush');
      });
      gridEl.appendChild(button);
    }
    ui.brushPalette.appendChild(gridEl);
  }
}

function setBrush(brush) {
  brushTool.setBrush(brush);
  ui.brushCurrent.textContent = brush ? `${brush.group}: ${brush.label}` : 'No brush selected';
  for (const button of ui.brushPalette.querySelectorAll('.brush-option')) {
    button.classList.toggle('active', button.dataset.brushId === brush?.id);
  }
}

function getLevelDebugSnapshot() {
  const cells = grid.getAllCells();
  const counts = cells.reduce(
    (acc, cell) => {
      acc.occupancy[cell.occupancy] = (acc.occupancy[cell.occupancy] || 0) + 1;
      if (cell.collapsedTile) acc.collapsed += 1;
      if (cell.contradiction) acc.contradictions += 1;
      if (cell.lockedByUser) acc.locked += 1;
      return acc;
    },
    {
      occupancy: {},
      collapsed: 0,
      contradictions: 0,
      locked: 0,
    }
  );

  return {
    ready: true,
    planShapes: plan.getShapes().map((shape) => shape.toJSON()),
    counts,
    solver: {
      solved: solver.solved,
      iterations: solver.iterations,
      statistics: solver.statistics,
    },
    scene: {
      children: app.scene.children.length,
      tileMeshes: tileView.meshes.size,
      shapeLines: shapeView.group.children.length,
      canvas: {
        width: app.renderer.domElement.width,
        height: app.renderer.domElement.height,
        clientWidth: app.renderer.domElement.clientWidth,
        clientHeight: app.renderer.domElement.clientHeight,
      },
      camera: {
        x: app.camera.position.x,
        y: app.camera.position.y,
        z: app.camera.position.z,
      },
      target: {
        x: app.controls.target.x,
        y: app.controls.target.y,
        z: app.controls.target.z,
      },
      generatedBounds: lastGeneratedBounds,
    },
    selected: selectedCell
      ? {
          x: selectedCell.x,
          y: selectedCell.y,
          z: selectedCell.z,
          occupancy: selectedCell.occupancy,
          collapsedTile: selectedCell.collapsedTile,
          fixedTile: selectedCell.fixedTile,
          tags: Array.from(selectedCell.tags),
        }
      : null,
  };
}

function installDebugApi() {
  window.levelMakerDebug = {
    app,
    grid,
    plan,
    registry,
    tileView,
    shapeView,
    ghostPreview,
    lightingConfig,
    selectWorld(worldX, worldZ, floor = currentFloor) {
      const cell = grid.cellAtWorld(worldX, floor, worldZ);
      return cell ? selectCell(cell) : null;
    },
    rebuild,
    frameLevel() {
      app.fitToBounds(lastGeneratedBounds);
    },
    runWfcOnly,
    getSnapshot: getLevelDebugSnapshot,
  };
}

eventBus.emit('ready');
