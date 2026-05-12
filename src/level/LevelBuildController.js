import { rasterizePlanToGrid } from '../grid/Rasterizer.js';
import { classifyCells } from '../grid/CellClassifier.js';
import { prepareWFCConstraints } from '../wfc/ConstraintMask.js';
import { applyCellState, getLockedCellStates } from './CellState.js';

export class LevelBuildController {
  constructor({
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
    getWfcSeed,
    getPropDefinitions,
    updatePlanView,
    updateTileView,
    onBuildUi,
    getDebugSnapshot,
  }) {
    this.grid = grid;
    this.plan = plan;
    this.tileSet = tileSet;
    this.solver = solver;
    this.builder = builder;
    this.typeConfig = typeConfig;
    this.lightingConfig = lightingConfig;
    this.tileView = tileView;
    this.debugPanel = debugPanel;
    this.socketLabel = socketLabel;
    this.getRuleConfig = getRuleConfig;
    this.getWfcSeed = getWfcSeed;
    this.getPropDefinitions = getPropDefinitions;
    this.updatePlanView = updatePlanView;
    this.updateTileView = updateTileView;
    this.onBuildUi = onBuildUi;
    this.getDebugSnapshot = getDebugSnapshot;
    this.pending = new Map();
    this.jobId = 0;
    this.worker = this.initWorker();
  }

  initWorker() {
    if (typeof Worker === 'undefined') return null;
    try {
      const worker = new Worker(new URL('../workers/levelBuildWorker.js', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event) => {
        const { type, id, result, error } = event.data || {};
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        if (type === 'error') pending.reject(new Error(error || 'Level build worker failed'));
        else pending.resolve(result);
      });
      worker.addEventListener('error', (event) => {
        const error = new Error(event.message || 'Level build worker failed');
        for (const [, pending] of this.pending) pending.reject(error);
        this.pending.clear();
        this.worker = null;
      });
      return worker;
    } catch (error) {
      console.warn('Level build worker unavailable; falling back to main-thread rebuild.', error);
      return null;
    }
  }

  rebuild(changedRegion = null) {
    if (!this.worker) return this.rebuildOnMainThread(changedRegion);

    const jobId = ++this.jobId;
    this.tileView.setTypeConfig(this.typeConfig);
    this.tileView.setPropDefinitions(this.getPropDefinitions());
    this.tileView.setLightingConfig(this.lightingConfig);
    this.updatePlanView();
    this.socketLabel.setText('Rebuilding level...');

    const job = {
      id: jobId,
      plan: this.plan.toJSON(),
      gridConfig: {
        width: this.grid.width,
        height: this.grid.height,
        depth: this.grid.depth,
        cellSize: this.grid.cellSize,
        originX: this.grid.originX,
        originZ: this.grid.originZ,
      },
      ruleConfig: this.getRuleConfig(),
      wfcSeed: this.getWfcSeed(),
      maxIterations: this.solver.maxIterations,
      lockedCells: getLockedCellStates(this.grid),
    };

    return new Promise((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject });
      this.worker.postMessage(job);
    })
      .then((result) => {
        if (jobId !== this.jobId) return this.getDebugSnapshot();
        this.applyBuildResult(result);
        return this.getDebugSnapshot();
      })
      .catch((error) => {
        if (jobId !== this.jobId) return this.getDebugSnapshot();
        this.debugPanel.log(`Worker rebuild failed; using main thread: ${error.message}`);
        return this.rebuildOnMainThread(changedRegion);
      });
  }

  rebuildOnMainThread(changedRegion = null) {
    this.tileView.setTypeConfig(this.typeConfig);
    this.tileView.setPropDefinitions(this.getPropDefinitions());
    this.tileView.setLightingConfig(this.lightingConfig);
    this.clearGenerated(changedRegion);
    rasterizePlanToGrid(this.plan, this.grid, changedRegion);
    classifyCells(this.grid, changedRegion);

    this.builder.apply(this.grid, this.getRuleConfig());
    classifyCells(this.grid, changedRegion);

    prepareWFCConstraints(this.grid, this.tileSet);
    this.runWfcOnly(true, false);
    this.updatePlanView();
    this.onBuildUi(this.solver.solved, this.computeGeneratedBounds(), 'Rebuild complete');
    return this.getDebugSnapshot();
  }

  clearGenerated(changedRegion = null) {
    this.grid.clearGeneratedData(changedRegion);
    this.tileView.clear();
  }

  applyBuildResult(result) {
    for (const state of result.cells || []) {
      const cell = this.grid.getCell(state.x, state.y, state.z);
      if (cell) applyCellState(cell, state);
    }

    this.solver.solved = !!result.solver?.solved;
    this.solver.iterations = result.solver?.iterations || 0;
    this.solver.statistics = result.solver?.statistics || { steps: 0, backtracks: 0 };
    this.updatePlanView();
    this.onBuildUi(result.solved, result.bounds, result.solved ? 'Worker rebuild complete' : 'Worker WFC failed');
  }

  computeGeneratedBounds() {
    let bounds = null;
    for (const cell of this.grid.getAllCells()) {
      const tileId = cell.collapsedTile || cell.fixedTile;
      if (!tileId || tileId === 'empty') continue;

      const position = this.grid.getWorldPosition(cell);
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

  runWfcOnly(keepCollapsed = false, updateView = true) {
    this.solver.seed = this.getWfcSeed();
    for (const cell of this.grid.getAllCells()) {
      if (!keepCollapsed || cell.occupancy === 'empty') {
        cell.contradiction = false;
        if (!cell.lockedByUser && cell.occupancy !== 'empty') {
          cell.collapsedTile = null;
        }
      }
    }
    const ok = this.solver.run(this.grid, this.tileSet, { typeConfig: this.typeConfig });
    this.debugPanel.log(ok ? 'WFC solved' : 'WFC failed');
    if (updateView) this.updateTileView();
    return ok;
  }
}
