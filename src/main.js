import { ThreeApp } from './app/ThreeApp.js';
import { EventBus } from './app/EventBus.js';
import { PlanDocument } from './plan/PlanDocument.js';
import { Grid3D } from './grid/Grid3D.js';
import { ModularBuilder } from './rules/ModularBuilder.js';
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
import { ConfigPanelController } from './editor/ConfigPanelController.js';
import { PerformanceStatsPanel } from './editor/PerformanceStatsPanel.js';
import { PropPlacementController } from './editor/PropPlacementController.js';
import { CodexLevelAgent } from './agent/CodexLevelAgent.js';
import { PropLibrary } from './props/PropLibrary.js';
import { createBrushPalette, createLightingConfig, createRuleToggles, createTypeConfig } from './config/editorDefaults.js';
import { LevelBuildController } from './level/LevelBuildController.js';
import { LevelPersistence } from './level/LevelPersistence.js';
import { applyCellState, clearGridLocks, getLockedCellStates as collectLockedCellStates } from './level/CellState.js';
import { LevelValidator } from './validation/LevelValidator.js';
import { exportLevelToGlb } from './export/GlbLevelExporter.js';

const viewport = document.getElementById('viewport');
const debugPanel = new DebugPanel();
const inspector = new InspectorPanel();
const registry = new ModularAssetRegistry();
const tileSet = registry.getTileSet();

const eventBus = new EventBus();
const plan = new PlanDocument();
const grid = new Grid3D({ width: 40, height: 4, depth: 40, cellSize: 1, originX: -20, originZ: -20 });
const app = new ThreeApp({
  container: viewport,
  onPointerDown: onPointer,
  onPointerMove: onMove,
  onPointerUp,
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

const ruleToggles = createRuleToggles();
const typeConfig = createTypeConfig();
const lightingConfig = createLightingConfig();
const brushPalette = createBrushPalette();

let currentTool = 'select';
let currentFloor = 0;
let currentStyle = uiStyleValue();
let selectedCell = null;
let selectedLightId = null;
let selectedShapeId = null;
let wfcSeed = 1;
let lastGeneratedBounds = null;
let hasAutoFitInitialView = false;
let selectionDrag = null;
let transformDrag = null;
let stackDrag = null;
let transformRebuildTimer = null;
const AUTO_CORRIDOR_MAX_GAP = 3;
const STACK_DRAG_PIXELS_PER_FLOOR = 48;
const solver = new WFCSolver({ seed: wfcSeed, maxIterations: 2500 });

const builder = new ModularBuilder(ruleToggles);
app.setCollisionWorld({
  grid,
  getFloor: () => currentFloor,
});

const ui = {
  toolButtons: new Map(),
  validateLevel: document.getElementById('validate-level'),
  clearSelection: document.getElementById('clear-selection'),
  rebuild: document.getElementById('rebuild'),
  clearPlan: document.getElementById('clear-plan'),
  openLevelFiles: document.getElementById('open-level-files'),
  saveLevelNow: document.getElementById('save-level-now'),
  saveLevelAs: document.getElementById('save-level-as'),
  exportGlb: document.getElementById('export-glb'),
  levelName: document.getElementById('level-name'),
  autosaveStatus: document.getElementById('autosave-status'),
  levelFilesModal: document.getElementById('level-files-modal'),
  levelFilesList: document.getElementById('level-files-list'),
  refreshLevelFiles: document.getElementById('refresh-level-files'),
  closeLevelFiles: document.getElementById('close-level-files'),
  loadAgentSample: document.getElementById('load-agent-sample'),
  copyPlanJson: document.getElementById('copy-plan-json'),
  agentPrompt: document.getElementById('agent-prompt'),
  agentApply: document.getElementById('agent-apply'),
  agentTranscript: document.getElementById('agent-transcript'),
  planJsonInput: document.getElementById('plan-json-input'),
  loadPlanJson: document.getElementById('load-plan-json'),
  autoRebuild: document.getElementById('auto-rebuild'),
  runWfc: document.getElementById('run-wfc'),
  stepWfc: document.getElementById('step-wfc'),
  resetWfc: document.getElementById('reset-wfc'),
  floorSelect: document.getElementById('current-floor'),
  showAllFloors: document.getElementById('show-all-floors'),
  freeCam: document.getElementById('camera-free-cam'),
  styleSelect: document.getElementById('current-style'),
  seedInput: document.getElementById('wfc-seed'),
  forceTileSelect: document.getElementById('force-tile'),
  configKind: document.getElementById('config-kind'),
  configDescription: document.getElementById('config-description'),
  configControls: document.getElementById('config-controls'),
  performanceStats: document.getElementById('performance-stats'),
  brushCurrent: document.getElementById('brush-current'),
  brushPalette: document.getElementById('brush-palette'),
  lighting: {
    sunIntensity: document.getElementById('lighting-sun-intensity'),
    sunElevation: document.getElementById('lighting-sun-elevation'),
    sunAzimuth: document.getElementById('lighting-sun-azimuth'),
    skyFill: document.getElementById('lighting-sky-fill'),
    interiorAmbient: document.getElementById('lighting-interior-ambient'),
    exposure: document.getElementById('lighting-exposure'),
    maxPointLights: document.getElementById('lighting-max-point-lights'),
    moduleShadows: document.getElementById('lighting-module-shadows'),
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

const propLibrary = new PropLibrary({
  brushPalette,
  onBrushPaletteChanged: () => renderBrushPalette(),
});

const buildController = new LevelBuildController({
  grid,
  plan,
  tileSet,
  solver,
  builder,
  typeConfig,
  lightingConfig,
  tileView,
  debugPanel,
  socketLabel,
  getRuleConfig,
  getWfcSeed: () => Number(ui.seedInput.value || 1),
  getPropDefinitions: () => getCustomPropDefinitions(),
  updatePlanView,
  updateTileView,
  onBuildUi: applyPostBuildUi,
  getDebugSnapshot: () => getLevelDebugSnapshot(),
});

const persistence = new LevelPersistence({
  ui,
  plan,
  debugPanel,
  getLevelJSON: () => makeLevelJSON(),
  loadPlanJSON,
});

const propPlacement = new PropPlacementController({
  grid,
  plan,
  propLibrary,
  brushTool,
  getCurrentStyle: () => currentStyle,
  isAutoRebuildEnabled: () => ui.autoRebuild.checked,
  rebuild: (...args) => rebuild(...args),
  updatePlanView,
  updateTileView,
  scheduleAutosave: (...args) => scheduleAutosave(...args),
  setStatusText: (text) => socketLabel.setText(text),
});

const validator = new LevelValidator({
  grid,
  plan,
  debugPanel,
  socketLabel,
  getCurrentStyle: () => currentStyle,
  rebuild: (...args) => rebuild(...args),
  scheduleAutosave: (...args) => scheduleAutosave(...args),
  markNeedsCameraFit: () => {
    hasAutoFitInitialView = false;
  },
});

const performanceStatsPanel = new PerformanceStatsPanel({
  container: ui.performanceStats,
  app,
  tileView,
  lightingConfig,
});

const configPanel = new ConfigPanelController({
  ui,
  typeConfig,
  tileView,
  isAutoRebuildEnabled: () => ui.autoRebuild.checked,
  rebuild: (...args) => rebuild(...args),
  updateTileView,
  onCellPanelRendered: () => {
    selectedLightId = null;
  },
});

const codexAgent = new CodexLevelAgent({
  ui,
  plan,
  grid,
  propLibrary,
  propPlacement,
  getCurrentStyle: () => currentStyle,
  setCurrentStyle: (style) => {
    currentStyle = style;
    ui.styleSelect.value = style;
  },
  getCurrentFloor: () => currentFloor,
  loadPlanJSON,
  getLevelDebugSnapshot,
  updatePlanView,
  updateTileView,
  rebuild: (...args) => rebuild(...args),
  scheduleAutosave: (...args) => scheduleAutosave(...args),
  markNeedsCameraFit: () => {
    hasAutoFitInitialView = false;
  },
  clearSelection: () => clearSelectionState(),
});

inspector.setTileOptions(registry.listTileIds());
renderBrushPalette();
setBrush(brushPalette.find((brush) => brush.id === 'wall-plaster') || brushPalette[0]);
wireLightingControls();
applyLightingConfig();

for (const tool of ['select', 'room', 'corridor', 'bridge', 'transform', 'stack', 'erase', 'brush']) {
  const button = document.getElementById(`tool-${tool}`);
  if (!button) continue;
  ui.toolButtons.set(tool, button);
  button.addEventListener('click', () => setTool(tool));
}

ui.floorSelect.addEventListener('change', () => {
  currentFloor = Number(ui.floorSelect.value);
  app.setFreeCameraFloor(currentFloor);
  updatePlanView();
  updateTileView();
  if (currentTool === 'select') debugPanel.log(`Current floor set to ${currentFloor}`);
});
ui.showAllFloors.addEventListener('change', () => {
  updatePlanView();
  updateTileView();
  debugPanel.log(`Show all floors ${ui.showAllFloors.checked ? 'on' : 'off'}`);
});
ui.freeCam.addEventListener('change', () => {
  app.setCameraMode(ui.freeCam.checked ? 'free' : 'orbit', {
    floor: currentFloor,
    bounds: lastGeneratedBounds,
    requestPointerLock: ui.freeCam.checked,
  });
  ui.freeCam.blur();
  debugPanel.log(`Free cam ${ui.freeCam.checked ? 'on' : 'off'}`);
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
ui.validateLevel.addEventListener('click', () => validateLevel());
ui.clearPlan.addEventListener('click', () => {
  plan.clear();
  clearSelectionState();
  updatePlanView();
  rebuild();
  scheduleAutosave('clear plan');
});
ui.openLevelFiles.addEventListener('click', () => openLevelFilesModal());
ui.saveLevelNow.addEventListener('click', () => saveCurrentLevel({ manual: true }));
ui.saveLevelAs.addEventListener('click', () => saveCurrentLevel({ manual: true, saveAs: true }));
ui.exportGlb.addEventListener('click', () => exportGlb());
ui.levelName.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveCurrentLevel({ manual: true, saveAs: true });
  }
});
ui.refreshLevelFiles.addEventListener('click', () => refreshLevelFiles());
ui.closeLevelFiles.addEventListener('click', () => closeLevelFilesModal());
ui.levelFilesModal.addEventListener('click', (event) => {
  if (event.target === ui.levelFilesModal) closeLevelFilesModal();
});
window.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveCurrentLevel({ manual: true });
  }
});
ui.loadAgentSample.addEventListener('click', () => {
  loadPlanFromUrl('/levels/two-story-saloon.json');
});
ui.agentApply.addEventListener('click', () => applyAgentPrompt());
ui.agentPrompt.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    applyAgentPrompt();
  }
});
ui.copyPlanJson.addEventListener('click', async () => {
  const text = JSON.stringify(makeLevelJSON(), null, 2);
  ui.planJsonInput.value = text;
  try {
    await navigator.clipboard?.writeText(text);
    debugPanel.log('Copied plan JSON');
  } catch (_err) {
    debugPanel.log('Plan JSON written to import box');
  }
});
ui.loadPlanJson.addEventListener('click', () => {
  try {
    loadPlanJSON(JSON.parse(ui.planJsonInput.value), { autosave: true }).catch((err) => {
      debugPanel.log(`Could not load plan JSON: ${err.message}`);
    });
  } catch (err) {
    debugPanel.log(`Could not load plan JSON: ${err.message}`);
  }
});
ui.autoRebuild.addEventListener('change', () => {
  debugPanel.log(`Auto rebuild ${ui.autoRebuild.checked ? 'on' : 'off'}`);
});

ui.clearSelection.addEventListener('click', () => {
  clearSelectionState();
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
loadPlanFromQuery();
startPerformanceStatsPanel();
installPanelFocusRelease();

function setTool(tool) {
  currentTool = tool;
  drawingTool.setMode(tool);
  ghostPreview.clear();
  selectionDrag = null;
  transformDrag = null;
  stackDrag = null;
  clearTransformRebuildTimer();
  for (const [id, button] of ui.toolButtons) {
    button.classList.toggle('active', id === tool);
  }
}

function uiStyleValue() {
  return document.getElementById('current-style')?.value || 'western';
}

function installPanelFocusRelease() {
  for (const panelId of ['sidebar', 'config-dock']) {
    const panel = document.getElementById(panelId);
    if (!panel) continue;
    panel.addEventListener('pointerup', (event) => {
      const target = event.target;
      if (!target || isTextEntryControl(target) || isComboBoxControl(target)) return;
      window.setTimeout(() => target.blur?.(), 0);
    });
    panel.addEventListener('change', (event) => {
      const target = event.target;
      if (!target || isTextEntryControl(target)) return;
      window.setTimeout(() => target.blur?.(), 0);
    });
  }
}

function isComboBoxControl(target) {
  return target.tagName === 'SELECT';
}

function isTextEntryControl(target) {
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  if (target.tagName !== 'INPUT') return false;
  return ['text', 'search', 'url', 'email', 'password', 'number'].includes(String(target.type || 'text').toLowerCase());
}

function onPointer({ point, objectHit, event }) {
  const hit = grid.cellAtWorld(point.x, Math.max(0, currentFloor), point.z);

  if (currentTool === 'select') {
    if (objectHit?.object?.userData?.selectableType === 'light') {
      selectLight(objectHit.object.userData.lightId);
      return;
    }
    selectionDrag = {
      start: snapWorldPoint(point),
      floor: currentFloor,
      startedAt: performance.now(),
    };
    const room = (hit?.shapeId ? findRoomShapeById(hit.shapeId) : null) || findRoomAtPoint(point, currentFloor);
    if (room) {
      selectShape(room);
      return;
    }
    if (hit) selectCell(hit);
    return;
  }

  if (!hit) return;

  if (currentTool === 'stack') {
    const selectedRoom = selectedShapeId ? findRoomShapeById(selectedShapeId) : null;
    const room =
      selectedRoom?.floor === currentFloor && selectedRoom.contains(point.x, point.z)
        ? selectedRoom
        : (hit?.shapeId ? findRoomShapeById(hit.shapeId) : null) || findRoomAtPoint(point, currentFloor);
    if (!room) return;
    selectShape(room);
    const stack = getRoomStack(room);
    stackDrag = {
      roomId: room.id,
      baseFloor: room.floor,
      startClientY: event?.clientY ?? 0,
      startFloors: stack.length,
      targetFloors: stack.length,
    };
    socketLabel.setText(`Stack ${room.id}: drag up to add floors, down to remove`);
    return;
  }

  if (currentTool === 'transform') {
    const selectedRoom = selectedShapeId ? findRoomShapeById(selectedShapeId) : null;
    const room =
      selectedRoom?.floor === currentFloor && selectedRoom.contains(point.x, point.z)
        ? selectedRoom
        : findRoomAtPoint(point, currentFloor);
    if (!room || room.type !== 'room') {
      const picked = findRoomAtPoint(point, currentFloor);
      if (picked) selectShape(picked);
      return;
    }
    if (!room.contains(point.x, point.z)) return;
    selectShape(room);
    transformDrag = {
      shapeId: room.id,
      start: snapWorldPoint(point),
      lastDelta: { x: 0, z: 0 },
      targets: getRoomMoveTargets(room),
    };
    socketLabel.setText(`Move ${room.id}: drag to reposition`);
    return;
  }

  if (currentTool === 'erase') {
    if (hit.shapeId) {
      plan.removeShapeById(hit.shapeId);
      if (selectedShapeId === hit.shapeId) selectedShapeId = null;
      updatePlanView();
      if (ui.autoRebuild.checked) rebuild();
      scheduleAutosave('erase shape');
    } else if (hit.occupancy === 'wall' || hit.occupancy === 'support' || hit.occupancy === 'roof') {
      hit.occupancy = 'empty';
      hit.tags.clear();
      if (ui.autoRebuild.checked) rebuild();
    }
    return;
  }

  if (currentTool === 'brush') {
    if (!brushTool.brush) return;
    const wasPropBrush = brushTool.brush.tags?.includes('propCandidate');
    if (wasPropBrush) {
      const placed = placePropBrush(hit);
      if (!placed) socketLabel.setText('Click a floor tile next to a wall, or click the wall beside that floor tile.');
      return;
    }
    brushTool.apply(hit);
    if (ui.autoRebuild.checked) rebuild();
    else updateTileView();
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
      updatePlanView();
      if (ui.autoRebuild.checked) rebuild();
      scheduleAutosave(`add ${created.shape.type}`);
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

function onMove({ point, event }) {
  const snap = snapWorldPoint(point);
  if (currentTool === 'stack' && stackDrag) {
    updateStackDrag(event);
    return;
  }
  if (currentTool === 'transform' && transformDrag) {
    updateTransformDrag(snap);
    return;
  }
  if (currentTool === 'select' && selectionDrag) {
    const dx = Math.abs(snap.x - selectionDrag.start.x);
    const dz = Math.abs(snap.z - selectionDrag.start.z);
    if (dx + dz > 0) socketLabel.setText(`Select rooms in ${selectionDrag.start.x},${selectionDrag.start.z} -> ${snap.x},${snap.z}`);
  }
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

function onPointerUp({ point }) {
  const snap = snapWorldPoint(point);
  if (currentTool === 'stack' && stackDrag) {
    finishStackDrag();
    return;
  }
  if (currentTool === 'select' && selectionDrag) {
    finishSelectionDrag(snap);
    return;
  }
  if (currentTool === 'transform' && transformDrag) {
    finishTransformDrag(snap);
  }
}

function getShapeById(id) {
  return plan.getShapes().find((shape) => shape.id === id) || null;
}

function findRoomShapeById(id) {
  const shape = getShapeById(id);
  return shape?.type === 'room' ? shape : null;
}

function findRoomAtPoint(point, floor = currentFloor) {
  return plan
    .getShapes()
    .filter((shape) => shape.type === 'room' && shape.floor === floor)
    .reverse()
    .find((room) => room.contains(point.x, point.z)) || null;
}

function selectShape(shape) {
  selectedLightId = null;
  selectedCell = null;
  selectedShapeId = shape?.id || null;
  selectionTool.clear();
  highlight.setSelected(null);
  if (shape) inspector.updateShape(shape);
  else inspector.update(null);
  renderConfigPanel(null);
  updatePlanView();
  if (shape) socketLabel.setText(`Selected ${shape.type} ${shape.id}`);
  return shape;
}

function finishSelectionDrag(end) {
  const drag = selectionDrag;
  selectionDrag = null;
  if (!drag) return null;
  const dx = Math.abs(end.x - drag.start.x);
  const dz = Math.abs(end.z - drag.start.z);
  if (dx + dz <= 0) return selectedShapeId ? getShapeById(selectedShapeId) : null;
  const room = findRoomInSelectionRect(drag.start, end, drag.floor);
  if (room) return selectShape(room);
  socketLabel.setText('No room in selection');
  return null;
}

function updateStackDrag(event) {
  const drag = stackDrag;
  if (!drag) return;
  const deltaPixels = drag.startClientY - (event?.clientY ?? drag.startClientY);
  const floorDelta = Math.round(deltaPixels / STACK_DRAG_PIXELS_PER_FLOOR);
  const maxFloors = grid.height - drag.baseFloor;
  const targetFloors = Math.max(1, Math.min(maxFloors, drag.startFloors + floorDelta));
  if (targetFloors === drag.targetFloors) return;
  drag.targetFloors = targetFloors;
  const room = applyRoomStack(drag.roomId, targetFloors);
  updatePlanView();
  socketLabel.setText(`Stack ${drag.roomId}: ${targetFloors} floor${targetFloors === 1 ? '' : 's'}`);
  if (ui.autoRebuild.checked) scheduleTransformRebuild();
  return room;
}

async function finishStackDrag() {
  const drag = stackDrag;
  stackDrag = null;
  clearTransformRebuildTimer();
  if (!drag) return null;
  const room = findRoomShapeById(drag.roomId);
  if (!room) return null;
  scheduleAutosave(`stack ${drag.roomId} to ${drag.targetFloors} floors`);
  await rebuild();
  selectShape(room);
  socketLabel.setText(`Stacked ${room.id} to ${drag.targetFloors} floor${drag.targetFloors === 1 ? '' : 's'}`);
  return room;
}

function applyRoomStack(roomId, targetFloors) {
  const baseRoom = findRoomShapeById(roomId);
  if (!baseRoom) return null;
  const maxFloors = grid.height - baseRoom.floor;
  const floors = Math.max(1, Math.min(maxFloors, Math.round(targetFloors || 1)));
  const stackKey = roomStackKey(baseRoom);
  const fingerprint = roomFootprintKey(baseRoom);
  baseRoom.tags.add(stackKey);

  for (const shape of plan.getShapes()) {
    if (shape.id === baseRoom.id || shape.floor < baseRoom.floor) continue;
    const ownedRoom = shape.type === 'room' && isStackRoomFor(shape, baseRoom, stackKey, fingerprint);
    const ownedStair = shape.type === 'stair' && shape.tags?.has(stackKey);
    if (!ownedRoom && !ownedStair) continue;
    if (ownedRoom && shape.floor >= baseRoom.floor + floors) plan.removeShapeById(shape.id);
    if (ownedStair && shape.floor >= baseRoom.floor + floors - 1) plan.removeShapeById(shape.id);
  }

  for (let offset = 1; offset < floors; offset += 1) {
    const floor = baseRoom.floor + offset;
    let upperRoom = findStackRoomAtFloor(baseRoom, floor, stackKey, fingerprint);
    if (!upperRoom) {
      upperRoom = plan.addRoom(baseRoom.points, floor, baseRoom.style || currentStyle);
    }
    upperRoom.points = baseRoom.points.map((point) => ({ x: point.x, z: point.z }));
    upperRoom.style = baseRoom.style || upperRoom.style;
    upperRoom.tags.add(stackKey);
    upperRoom.tags.add('stack-generated');
    upperRoom.tags.add(`stackBase:${baseRoom.id}`);
  }

  for (let floor = baseRoom.floor; floor < baseRoom.floor + floors - 1; floor += 1) {
    ensureStackStair(baseRoom, floor, stackKey);
  }

  return baseRoom;
}

function getRoomStack(room) {
  const stackKey = roomStackKey(room);
  const fingerprint = roomFootprintKey(room);
  const rooms = [room];
  for (let floor = room.floor + 1; floor < grid.height; floor += 1) {
    const next = findStackRoomAtFloor(room, floor, stackKey, fingerprint);
    if (!next) break;
    rooms.push(next);
  }
  return rooms;
}

function findStackRoomAtFloor(baseRoom, floor, stackKey = roomStackKey(baseRoom), fingerprint = roomFootprintKey(baseRoom)) {
  return (
    plan
      .getShapes()
      .find(
        (shape) =>
          shape.type === 'room' &&
          shape.floor === floor &&
          shape.id !== baseRoom.id &&
          (shape.tags?.has(stackKey) || shape.tags?.has(`stackBase:${baseRoom.id}`) || roomFootprintKey(shape) === fingerprint)
      ) || null
  );
}

function isStackRoomFor(shape, baseRoom, stackKey, fingerprint) {
  return shape.tags?.has(stackKey) || shape.tags?.has(`stackBase:${baseRoom.id}`) || roomFootprintKey(shape) === fingerprint;
}

function ensureStackStair(baseRoom, floor, stackKey) {
  const existing = plan.getShapes().find((shape) => shape.type === 'stair' && shape.floor === floor && shape.tags?.has(stackKey));
  const candidate = findStackStairCandidate(baseRoom, floor, stackKey);
  if (!candidate) {
    if (existing) plan.removeShapeById(existing.id);
    return null;
  }
  if (existing) {
    existing.x = candidate.x;
    existing.z = candidate.z;
    existing.direction = candidate.direction;
    existing.length = candidate.length;
    existing.width = candidate.width;
    existing.style = candidate.style;
    return existing;
  }
  const stair = plan.addStair(candidate, floor, candidate.style || baseRoom.style || currentStyle);
  stair.tags = new Set([stackKey, 'stack-generated', `stackBase:${baseRoom.id}`]);
  return stair;
}

function findStackStairCandidate(room, floor, stackKey) {
  const bounds = roomBounds(room);
  const reserved = getStackStairReservedCellsForFloor(floor, stackKey);
  const roomCells = grid
    .getAllCells()
    .filter((cell) => cell.y === room.floor && room.contains(grid.getWorldPosition(cell).x, grid.getWorldPosition(cell).z));
  roomCells.sort((a, b) => stackStairCandidateScore(room, a, floor) - stackStairCandidateScore(room, b, floor));
  const wideX = bounds.maxX - bounds.minX >= bounds.maxZ - bounds.minZ;
  const evenFloor = (floor - room.floor) % 2 === 0;
  const directions = wideX
    ? evenFloor
      ? ['PX', 'PZ', 'NX', 'NZ']
      : ['NX', 'NZ', 'PX', 'PZ']
    : evenFloor
      ? ['PZ', 'PX', 'NZ', 'NX']
      : ['NZ', 'NX', 'PZ', 'PX'];
  for (const length of [4, 3, 2]) {
    for (const width of [2, 1]) {
      for (const cell of roomCells) {
        if (grid.getCell(cell.x, room.floor, cell.z)?.tags.has('authoredProp')) continue;
        for (const direction of directions) {
          if (stairLowerFootprintOverlaps(cell, direction, length, width, reserved)) continue;
          if (!canStackStairFit(room, cell, direction, length, width)) continue;
          const position = grid.getWorldPosition(cell);
          return {
            x: position.x,
            z: position.z,
            direction,
            length,
            width,
            style: room.style || currentStyle,
          };
        }
      }
    }
  }
  return null;
}

function getStackStairReservedCellsForFloor(floor, stackKey) {
  const reserved = new Set();
  for (const stair of plan.getShapes()) {
    if (stair.type !== 'stair' || !stair.tags?.has(stackKey)) continue;
    if (stair.floor === floor - 1) {
      for (const key of getStairUpperReservationKeys(stair)) reserved.add(key);
    }
  }
  return reserved;
}

function getStairUpperReservationKeys(stair) {
  const keys = [];
  const start = grid.worldToCell(stair.x, stair.z, stair.floor);
  const direction = getStackStairDirectionVector(stair.direction);
  const length = Math.max(1, Math.round(stair.length || 4));
  const width = Math.max(1, Math.round(stair.width || 1));
  const sideOffsetStart = -Math.floor(width / 2);
  for (let offsetAlong = 0; offsetAlong <= length; offsetAlong += 1) {
    for (let side = 0; side < width; side += 1) {
      const sideOffset = sideOffsetStart + side;
      keys.push(`${start.x + direction.x * offsetAlong + direction.sideX * sideOffset},${start.z + direction.z * offsetAlong + direction.sideZ * sideOffset}`);
    }
  }
  return keys;
}

function stairLowerFootprintOverlaps(start, directionName, length, width, reserved) {
  if (!reserved.size) return false;
  const direction = getStackStairDirectionVector(directionName);
  const sideOffsetStart = -Math.floor(width / 2);
  for (let offsetAlong = -1; offsetAlong < length; offsetAlong += 1) {
    for (let side = 0; side < width; side += 1) {
      const sideOffset = sideOffsetStart + side;
      const key = `${start.x + direction.x * offsetAlong + direction.sideX * sideOffset},${start.z + direction.z * offsetAlong + direction.sideZ * sideOffset}`;
      if (reserved.has(key)) return true;
    }
  }
  return false;
}

function canStackStairFit(room, start, directionName, length, width) {
  const dir = getStackStairDirectionVector(directionName);
  const sideOffsetStart = -Math.floor(width / 2);
  for (let offsetAlong = -1; offsetAlong <= length; offsetAlong += 1) {
    for (let side = 0; side < width; side += 1) {
      const sideOffset = sideOffsetStart + side;
      const cell = grid.getCell(start.x + dir.x * offsetAlong + dir.sideX * sideOffset, room.floor, start.z + dir.z * offsetAlong + dir.sideZ * sideOffset);
      if (!cell) return false;
      const position = grid.getWorldPosition(cell);
      if (!room.contains(position.x, position.z)) return false;
      if (cell.tags.has('authoredProp')) return false;
    }
  }
  return true;
}

function getStackStairDirectionVector(direction) {
  if (direction === 'NX') return { x: -1, z: 0, sideX: 0, sideZ: 1 };
  if (direction === 'PZ') return { x: 0, z: 1, sideX: 1, sideZ: 0 };
  if (direction === 'NZ') return { x: 0, z: -1, sideX: 1, sideZ: 0 };
  return { x: 1, z: 0, sideX: 0, sideZ: 1 };
}

function stackStairCandidateScore(room, cell, floor) {
  const position = grid.getWorldPosition(cell);
  const bounds = roomBounds(room);
  if ((floor - room.floor) % 2 === 0) return Math.abs(position.x - bounds.minX) + Math.abs(position.z - bounds.minZ);
  return Math.abs(position.x - bounds.maxX) + Math.abs(position.z - bounds.maxZ);
}

function roomStackKey(room) {
  return `stack:${room.id}`;
}

function roomFootprintKey(room) {
  return room.points.map((point) => `${point.x},${point.z}`).join('|');
}

function findRoomInSelectionRect(start, end, floor) {
  const rect = makeSelectionRect(start, end);
  return plan
    .getShapes()
    .filter((shape) => shape.type === 'room' && shape.floor === floor && roomIntersectsRect(shape, rect))
    .sort((a, b) => roomArea(a) - roomArea(b))[0] || null;
}

function makeSelectionRect(start, end) {
  return {
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minZ: Math.min(start.z, end.z),
    maxZ: Math.max(start.z, end.z),
  };
}

function roomIntersectsRect(room, rect) {
  if (room.points.some((point) => pointInRect(point, rect))) return true;
  const corners = [
    { x: rect.minX, z: rect.minZ },
    { x: rect.maxX, z: rect.minZ },
    { x: rect.maxX, z: rect.maxZ },
    { x: rect.minX, z: rect.maxZ },
  ];
  if (corners.some((point) => room.contains(point.x, point.z))) return true;
  const bounds = roomBounds(room);
  return bounds.maxX >= rect.minX && bounds.minX <= rect.maxX && bounds.maxZ >= rect.minZ && bounds.minZ <= rect.maxZ;
}

function pointInRect(point, rect) {
  return point.x >= rect.minX && point.x <= rect.maxX && point.z >= rect.minZ && point.z <= rect.maxZ;
}

function roomBounds(room) {
  return room.points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minZ: Math.min(acc.minZ, point.z),
      maxZ: Math.max(acc.maxZ, point.z),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  );
}

function roomArea(room) {
  let area = 0;
  for (let i = 0; i < room.points.length; i += 1) {
    const current = room.points[i];
    const next = room.points[(i + 1) % room.points.length];
    area += current.x * next.z - next.x * current.z;
  }
  return Math.abs(area) / 2;
}

function getRoomMoveTargets(room) {
  const targets = [
    {
      id: room.id,
      kind: 'polygon',
      points: room.points.map((point) => ({ x: point.x, z: point.z })),
    },
  ];

  for (const shape of plan.getShapes()) {
    if (shape.id === room.id || shape.floor !== room.floor) continue;
    if ((shape.type === 'prop' || shape.type === 'stair') && room.contains(shape.x, shape.z)) {
      targets.push({
        id: shape.id,
        kind: 'point',
        x: shape.x,
        z: shape.z,
      });
    }
  }

  return targets;
}

function updateTransformDrag(snap) {
  const drag = transformDrag;
  if (!drag) return;
  const delta = {
    x: snap.x - drag.start.x,
    z: snap.z - drag.start.z,
  };
  if (delta.x === drag.lastDelta.x && delta.z === drag.lastDelta.z) return;
  applyRoomMoveTargets(drag.targets, delta);
  drag.lastDelta = delta;
  updatePlanView();
  drag.action = getTransformRoomAction(drag.shapeId);
  renderTransformActionPreview(drag.action);
  if (drag.action?.kind === 'merge') {
    socketLabel.setText(`Release to merge ${drag.shapeId} into ${drag.action.target.id}`);
  } else if (drag.action?.kind === 'corridor') {
    socketLabel.setText(`Release to connect ${drag.shapeId} to ${drag.action.target.id} with a hallway`);
  } else {
    socketLabel.setText(`Move ${drag.shapeId}: ${delta.x}, ${delta.z}`);
  }
  if (ui.autoRebuild.checked) scheduleTransformRebuild();
}

function applyRoomMoveTargets(targets, delta) {
  for (const target of targets) {
    const shape = getShapeById(target.id);
    if (!shape) continue;
    if (target.kind === 'polygon') {
      shape.points = target.points.map((point) => ({
        x: point.x + delta.x,
        z: point.z + delta.z,
      }));
    } else if (target.kind === 'point') {
      shape.x = target.x + delta.x;
      shape.z = target.z + delta.z;
    }
  }
}

function scheduleTransformRebuild() {
  if (transformRebuildTimer) return;
  transformRebuildTimer = window.setTimeout(() => {
    transformRebuildTimer = null;
    rebuild();
  }, 140);
}

function clearTransformRebuildTimer() {
  if (!transformRebuildTimer) return;
  window.clearTimeout(transformRebuildTimer);
  transformRebuildTimer = null;
}

async function finishTransformDrag(snap) {
  const drag = transformDrag;
  if (!drag) return null;
  updateTransformDrag(snap);
  transformDrag = null;
  clearTransformRebuildTimer();
  ghostPreview.clear();
  if (drag.lastDelta.x === 0 && drag.lastDelta.z === 0) return getShapeById(drag.shapeId);
  const action = drag.action || getTransformRoomAction(drag.shapeId);
  const result = action ? applyTransformRoomAction(action) : { shape: getShapeById(drag.shapeId), reason: `move ${drag.shapeId}` };
  scheduleAutosave(result.reason);
  await rebuild();
  const shape = result.shape ? getShapeById(result.shape.id) : getShapeById(drag.shapeId);
  if (shape) selectShape(shape);
  socketLabel.setText(result.message || `Moved ${drag.shapeId}`);
  return shape;
}

function getTransformRoomAction(roomId) {
  const room = findRoomShapeById(roomId);
  if (!room) return null;
  const merge = findMergeAction(room);
  if (merge) return merge;
  return findCorridorAction(room);
}

function findMergeAction(room) {
  const roomCells = collectRoomCellKeys(room);
  if (!roomCells.size) return null;
  for (const target of plan.getShapes()) {
    if (target.id === room.id || target.type !== 'room' || target.floor !== room.floor) continue;
    const targetCells = collectRoomCellKeys(target);
    if (!roomCellSetsTouch(roomCells, targetCells)) continue;
    const mergedPoints = buildMergedRoomPolygon(roomCells, targetCells);
    if (mergedPoints.length < 3) continue;
    return {
      kind: 'merge',
      room,
      target,
      points: mergedPoints,
    };
  }
  return null;
}

function findCorridorAction(room) {
  let best = null;
  for (const target of plan.getShapes()) {
    if (target.id === room.id || target.type !== 'room' || target.floor !== room.floor) continue;
    const connection = getRoomConnection(room, target);
    if (!connection || connection.distance <= 0 || connection.distance > AUTO_CORRIDOR_MAX_GAP) continue;
    if (!best || connection.distance < best.distance) {
      best = {
        kind: 'corridor',
        room,
        target,
        from: connection.from,
        to: connection.to,
        width: 2,
        distance: connection.distance,
      };
    }
  }
  return best;
}

function applyTransformRoomAction(action) {
  if (action.kind === 'merge') {
    action.target.points = action.points;
    plan.removeShapeById(action.room.id);
    selectedShapeId = action.target.id;
    return {
      shape: action.target,
      reason: `merge ${action.room.id} into ${action.target.id}`,
      message: `Merged ${action.room.id} into ${action.target.id}`,
    };
  }

  if (action.kind === 'corridor') {
    const corridor = plan.addCorridor(action.from, action.to, action.width, action.room.floor, action.room.style || action.target.style || currentStyle);
    return {
      shape: action.room,
      corridor,
      reason: `connect ${action.room.id} to ${action.target.id}`,
      message: `Connected ${action.room.id} to ${action.target.id} with ${corridor.id}`,
    };
  }

  return { shape: action.room, reason: `move ${action.room.id}` };
}

function renderTransformActionPreview(action) {
  if (action?.kind === 'corridor') {
    ghostPreview.setPreview({
      mode: 'corridor',
      start: action.from,
      end: action.to,
      floor: action.room.floor,
      width: action.width,
    });
    return;
  }
  ghostPreview.clear();
}

function collectRoomCellKeys(room) {
  const keys = new Set();
  for (const cell of grid.getAllCells()) {
    if (cell.y !== room.floor) continue;
    const point = grid.getWorldPosition(cell);
    if (room.contains(point.x, point.z)) keys.add(`${cell.x},${cell.z}`);
  }
  return keys;
}

function roomCellSetsTouch(a, b) {
  for (const key of a) {
    if (b.has(key)) return true;
    const [x, z] = key.split(',').map(Number);
    if (b.has(`${x + 1},${z}`) || b.has(`${x - 1},${z}`) || b.has(`${x},${z + 1}`) || b.has(`${x},${z - 1}`)) return true;
  }
  return false;
}

function buildMergedRoomPolygon(...cellSets) {
  const occupied = new Set();
  for (const set of cellSets) {
    for (const key of set) occupied.add(key);
  }
  if (!occupied.size) return [];

  const edges = [];
  for (const key of occupied) {
    const [x, z] = key.split(',').map(Number);
    if (!occupied.has(`${x},${z - 1}`)) edges.push(makeGridEdge(x, z, x + 1, z));
    if (!occupied.has(`${x + 1},${z}`)) edges.push(makeGridEdge(x + 1, z, x + 1, z + 1));
    if (!occupied.has(`${x},${z + 1}`)) edges.push(makeGridEdge(x + 1, z + 1, x, z + 1));
    if (!occupied.has(`${x - 1},${z}`)) edges.push(makeGridEdge(x, z + 1, x, z));
  }

  const loops = traceBoundaryLoops(edges);
  const best = loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0] || [];
  return simplifyOrthogonalPolygon(best);
}

function makeGridEdge(ax, az, bx, bz) {
  return {
    from: edgePoint(ax, az),
    to: edgePoint(bx, bz),
  };
}

function edgePoint(x, z) {
  return {
    x: grid.originX + x * grid.cellSize,
    z: grid.originZ + z * grid.cellSize,
  };
}

function edgeKey(point) {
  return `${point.x},${point.z}`;
}

function traceBoundaryLoops(edges) {
  const byStart = new Map();
  const unused = new Set();
  edges.forEach((edge, index) => {
    edge.id = String(index);
    const key = edgeKey(edge.from);
    if (!byStart.has(key)) byStart.set(key, []);
    byStart.get(key).push(edge);
    unused.add(edge.id);
  });

  const loops = [];
  while (unused.size) {
    const firstId = Array.from(unused)[0];
    const first = edges[Number(firstId)];
    const loop = [first.from];
    let edge = first;
    unused.delete(edge.id);

    for (let guard = 0; guard < edges.length + 4; guard += 1) {
      loop.push(edge.to);
      if (edgeKey(edge.to) === edgeKey(loop[0])) break;
      const nextEdges = byStart.get(edgeKey(edge.to)) || [];
      const next = nextEdges.find((candidate) => unused.has(candidate.id));
      if (!next) break;
      edge = next;
      unused.delete(edge.id);
    }

    if (loop.length >= 4) loops.push(removeRepeatedClosingPoint(loop));
  }
  return loops;
}

function removeRepeatedClosingPoint(points) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.x === last.x && first.z === last.z) return points.slice(0, -1);
  return points;
}

function simplifyOrthogonalPolygon(points) {
  const input = removeRepeatedClosingPoint(points);
  if (input.length <= 3) return input;
  return input.filter((point, index) => {
    const prev = input[(index - 1 + input.length) % input.length];
    const next = input[(index + 1) % input.length];
    return !((prev.x === point.x && point.x === next.x) || (prev.z === point.z && point.z === next.z));
  });
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.z - next.x * current.z;
  }
  return area / 2;
}

function getRoomConnection(a, b) {
  const aBounds = roomBounds(a);
  const bBounds = roomBounds(b);
  const dx = Math.max(0, aBounds.minX - bBounds.maxX, bBounds.minX - aBounds.maxX);
  const dz = Math.max(0, aBounds.minZ - bBounds.maxZ, bBounds.minZ - aBounds.maxZ);
  const distance = Math.hypot(dx, dz);
  if (distance <= 0) return null;

  return {
    distance,
    ...getClosestBoundaryPoints(aBounds, bBounds),
  };
}

function getClosestBoundaryPoints(a, b) {
  if (a.maxX < b.minX) {
    const z = rangeMidpointOverlapOrGap(a.minZ, a.maxZ, b.minZ, b.maxZ);
    return { from: { x: a.maxX, z }, to: { x: b.minX, z } };
  }
  if (b.maxX < a.minX) {
    const z = rangeMidpointOverlapOrGap(a.minZ, a.maxZ, b.minZ, b.maxZ);
    return { from: { x: a.minX, z }, to: { x: b.maxX, z } };
  }
  if (a.maxZ < b.minZ) {
    const x = rangeMidpointOverlapOrGap(a.minX, a.maxX, b.minX, b.maxX);
    return { from: { x, z: a.maxZ }, to: { x, z: b.minZ } };
  }
  if (b.maxZ < a.minZ) {
    const x = rangeMidpointOverlapOrGap(a.minX, a.maxX, b.minX, b.maxX);
    return { from: { x, z: a.minZ }, to: { x, z: b.maxZ } };
  }

  const aCenter = boundsCenter(a);
  const bCenter = boundsCenter(b);
  return {
    from: clampPointToBounds(bCenter, a),
    to: clampPointToBounds(aCenter, b),
  };
}

function rangeMidpointOverlapOrGap(aMin, aMax, bMin, bMax) {
  const overlapMin = Math.max(aMin, bMin);
  const overlapMax = Math.min(aMax, bMax);
  if (overlapMin <= overlapMax) return Math.round((overlapMin + overlapMax) / 2);
  return Math.round((Math.min(aMax, bMax) + Math.max(aMin, bMin)) / 2);
}

function boundsCenter(bounds) {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
}

function clampPointToBounds(point, bounds) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, point.z)),
  };
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
  selectedShapeId = null;
  selectedLightId = null;
  selectedCell = cell;
  selectionTool.pick(cell);
  highlight.setSelected(cell);
  inspector.update(cell);
  renderConfigPanel(cell);
  updatePlanView();
  socketLabel.setText(`Selected: ${cell.key()} occupancy=${cell.occupancy}`);
  return cell;
}

function selectLight(lightId) {
  selectedShapeId = null;
  selectedLightId = lightId;
  selectedCell = null;
  selectionTool.clear();
  highlight.setSelected(null);
  inspector.update(null);
  renderLightConfigPanel(lightId);
  socketLabel.setText(`Selected light ${lightId}`);
}

function clearSelectionState() {
  selectedCell = null;
  selectedLightId = null;
  selectedShapeId = null;
  selectionTool.clear();
  highlight.setSelected(null);
  inspector.update(null);
  updatePlanView();
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

function getFloorView() {
  return {
    activeFloor: ui.showAllFloors.checked ? null : currentFloor,
    selectedShapeId,
  };
}

function updateTileView() {
  tileView.setPropDefinitions(getCustomPropDefinitions());
  tileView.update(grid, getFloorView());
}

function updatePlanView() {
  shapeView.update(plan, getFloorView());
}

function rebuild(changedRegion = null) {
  return buildController.rebuild(changedRegion);
}

function applyPostBuildUi(solved, bounds, message) {
  updateTileView();
  lastGeneratedBounds = bounds || computeGeneratedBounds();
  if (!hasAutoFitInitialView) {
    app.fitToBounds(lastGeneratedBounds);
    hasAutoFitInitialView = true;
  }
  const selectedShape = selectedShapeId ? getShapeById(selectedShapeId) : null;
  if (selectedShape) inspector.updateShape(selectedShape);
  else inspector.update(selectedCell);
  if (selectedLightId && tileView.getLightInfo(selectedLightId)) renderLightConfigPanel(selectedLightId);
  else renderConfigPanel(selectedCell);
  socketLabel.setText(`Rebuilt ${grid.getAllCells().length} cells`);
  debugPanel.log(message || (solved ? 'Rebuild complete' : 'WFC failed'));
}

async function validateLevel() {
  return validator.validateLevel();
}

function getLockedCellStates() {
  return collectLockedCellStates(grid);
}

function computeGeneratedBounds() {
  return buildController.computeGeneratedBounds();
}

function runWfcOnly(keepCollapsed = false, updateView = true) {
  const ok = buildController.runWfcOnly(keepCollapsed, updateView);
  if (!updateView) return ok;
  if (selectedCell) {
    const current = grid.getCell(selectedCell.x, selectedCell.y, selectedCell.z);
    selectedCell = current;
    inspector.update(selectedCell);
    renderConfigPanel(selectedCell);
  } else if (selectedLightId && tileView.getLightInfo(selectedLightId)) {
    renderLightConfigPanel(selectedLightId);
  } else if (selectedShapeId) {
    const selectedShape = getShapeById(selectedShapeId);
    if (selectedShape) inspector.updateShape(selectedShape);
  }
  return ok;
}

function renderConfigPanel(cell) {
  configPanel.renderCell(cell);
}

function renderLightConfigPanel(lightId) {
  configPanel.renderLight(lightId);
}

function wireLightingControls() {
  const numericControls = [
    ['sunIntensity', ui.lighting.sunIntensity],
    ['sunElevation', ui.lighting.sunElevation],
    ['sunAzimuth', ui.lighting.sunAzimuth],
    ['skyFill', ui.lighting.skyFill],
    ['interiorAmbient', ui.lighting.interiorAmbient],
    ['exposure', ui.lighting.exposure],
    ['maxPointLights', ui.lighting.maxPointLights],
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
    updateTileView();
  });
  ui.lighting.moduleShadows.addEventListener('change', () => {
    lightingConfig.moduleShadows = ui.lighting.moduleShadows.checked;
    applyLightingConfig();
    updateTileView();
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
      cameraMode: app.getCameraMode(),
      generatedBounds: lastGeneratedBounds,
    },
    view: {
      currentFloor,
      showAllFloors: ui.showAllFloors.checked,
    },
    selectedShape: selectedShapeId ? getShapeById(selectedShapeId)?.toJSON() || null : null,
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
    performance: app.getPerformanceStats(),
  };
}

function startPerformanceStatsPanel() {
  performanceStatsPanel.start();
}

function makeLevelJSON() {
  return persistence.makeLevelJSON({
    propDefinitions: getCustomPropDefinitions(),
    lockedCells: getLockedCellStates(),
  });
}

function scheduleAutosave(_reason = 'edit') {
  persistence.scheduleAutosave(_reason);
}

async function saveCurrentLevel({ manual = false, saveAs = false } = {}) {
  return persistence.saveCurrentLevel({ manual, saveAs });
}

async function exportGlb({ download = true } = {}) {
  const name = ui.levelName?.value || makeLevelJSON().name || 'level';
  socketLabel.setText('Exporting optimized GLB...');
  try {
    const result = await exportLevelToGlb({ grid, tileView, name, download });
    const sizeKb = (result.byteLength / 1024).toFixed(1);
    const summary = `Exported ${result.filename}: ${result.meshCount} meshes, ${result.triangleCount.toLocaleString()} tris, ${sizeKb} KB`;
    debugPanel.log(summary);
    socketLabel.setText(summary);
    return result;
  } catch (error) {
    const message = `GLB export failed: ${error.message}`;
    debugPanel.log(message);
    socketLabel.setText(message);
    throw error;
  }
}

async function openLevelFilesModal() {
  return persistence.openLevelFilesModal();
}

function closeLevelFilesModal() {
  persistence.closeLevelFilesModal();
}

async function refreshLevelFiles() {
  return persistence.refreshLevelFiles();
}

function loadPropDefinitions(definitions = []) {
  propLibrary.loadDefinitions(definitions);
  tileView.setPropDefinitions(getCustomPropDefinitions());
}

function getCustomPropDefinitions() {
  return propLibrary.getDefinitions();
}

function placePropBrush(hit) {
  return propPlacement.placeBrush(hit);
}

async function loadPlanJSON(data, { filename = null, autosave = false } = {}) {
  loadPropDefinitions(data?.propDefinitions || []);
  clearGridLocks(grid);
  plan.loadJSON(data);
  for (const state of data?.lockedCells || []) {
    const cell = grid.getCell(state.x, state.y, state.z);
    if (cell) applyCellState(cell, state);
  }
  persistence.setLoadedLevel({ data, filename });
  selectedCell = null;
  selectedLightId = null;
  selectedShapeId = null;
  selectionTool.clear();
  highlight.setSelected(null);
  inspector.update(null);
  updatePlanView();
  hasAutoFitInitialView = false;
  await rebuild();
  debugPanel.log(`Loaded plan with ${plan.getShapes().length} shapes`);
  if (autosave) scheduleAutosave('load plan');
  return getLevelDebugSnapshot();
}

async function applyAgentPrompt() {
  return codexAgent.applyPrompt();
}

async function loadPlanFromUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return loadPlanJSON(await response.json());
  } catch (err) {
    debugPanel.log(`Could not load ${url}: ${err.message}`);
    return null;
  }
}

function loadPlanFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const level = params.get('level');
  if (level) loadPlanFromUrl(level);
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
    selectShapeById(id) {
      const shape = getShapeById(id);
      return shape ? selectShape(shape)?.toJSON() : null;
    },
    selectRoomAt(worldX, worldZ, floor = currentFloor) {
      const room = findRoomAtPoint({ x: worldX, z: worldZ }, floor);
      return room ? selectShape(room)?.toJSON() : null;
    },
    async moveSelectedRoom(deltaX, deltaZ) {
      const room = selectedShapeId ? findRoomShapeById(selectedShapeId) : null;
      if (!room) return null;
      const targets = getRoomMoveTargets(room);
      applyRoomMoveTargets(targets, { x: Math.round(Number(deltaX || 0)), z: Math.round(Number(deltaZ || 0)) });
      const action = getTransformRoomAction(room.id);
      const result = action ? applyTransformRoomAction(action) : { shape: getShapeById(room.id), reason: `move ${room.id}` };
      scheduleAutosave(result.reason);
      updatePlanView();
      await rebuild();
      return result.shape ? getShapeById(result.shape.id)?.toJSON() || null : null;
    },
    async stackSelectedRoom(floors) {
      const room = selectedShapeId ? findRoomShapeById(selectedShapeId) : null;
      if (!room) return null;
      applyRoomStack(room.id, floors);
      scheduleAutosave(`stack ${room.id} to ${floors} floors`);
      updatePlanView();
      await rebuild();
      return getLevelDebugSnapshot();
    },
    setTool(tool) {
      setTool(tool);
      return getLevelDebugSnapshot();
    },
    setCurrentFloor(floor) {
      currentFloor = Math.max(0, Math.min(grid.height - 1, Math.round(Number(floor || 0))));
      ui.floorSelect.value = String(currentFloor);
      updatePlanView();
      updateTileView();
      return getLevelDebugSnapshot();
    },
    setShowAllFloors(showAll) {
      ui.showAllFloors.checked = Boolean(showAll);
      updatePlanView();
      updateTileView();
      return getLevelDebugSnapshot();
    },
    rebuild,
    validateLevel,
    frameLevel() {
      app.fitToBounds(lastGeneratedBounds);
    },
    setFreeCam(enabled) {
      ui.freeCam.checked = Boolean(enabled);
      app.setCameraMode(ui.freeCam.checked ? 'free' : 'orbit', {
        floor: currentFloor,
        bounds: lastGeneratedBounds,
      });
      return getLevelDebugSnapshot();
    },
    loadPlanJSON,
    loadPlanFromUrl,
    saveCurrentLevel,
    exportGlb,
    refreshLevelFiles,
    exportPlanJSON() {
      return makeLevelJSON();
    },
    runWfcOnly,
    getSnapshot: getLevelDebugSnapshot,
  };
}

eventBus.emit('ready');
