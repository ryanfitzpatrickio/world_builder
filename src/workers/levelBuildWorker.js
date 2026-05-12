import { PlanDocument } from '../plan/PlanDocument.js';
import { Grid3D } from '../grid/Grid3D.js';
import { rasterizePlanToGrid } from '../grid/Rasterizer.js';
import { classifyCells } from '../grid/CellClassifier.js';
import { ModularBuilder } from '../rules/ModularBuilder.js';
import { ModularAssetRegistry } from '../assets/ModularAssetRegistry.js';
import { prepareWFCConstraints } from '../wfc/ConstraintMask.js';
import { WFCSolver } from '../wfc/WFCSolver.js';

self.onmessage = (event) => {
  const job = event.data;
  try {
    const result = buildLevel(job);
    self.postMessage({ type: 'result', id: job.id, result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: job.id,
      error: error?.message || 'Level build worker failed',
    });
  }
};

function buildLevel(job) {
  const registry = new ModularAssetRegistry();
  const tileSet = registry.getTileSet();
  const plan = new PlanDocument().loadJSON(job.plan || { shapes: [] });
  const grid = new Grid3D(job.gridConfig);

  applyLockedCells(grid, job.lockedCells || []);

  rasterizePlanToGrid(plan, grid);
  classifyCells(grid);

  const builder = new ModularBuilder(job.ruleConfig || {});
  builder.apply(grid, job.ruleConfig || {});
  classifyCells(grid);

  prepareWFCConstraints(grid, tileSet);

  const solver = new WFCSolver({
    seed: Number(job.wfcSeed || 1),
    maxIterations: Number(job.maxIterations || 2500),
  });
  const solved = solver.run(grid, tileSet, { typeConfig: job.ruleConfig?.typeConfig || {} });

  return {
    solved,
    cells: grid.getAllCells().map(serializeCell),
    bounds: computeGeneratedBounds(grid),
    counts: getCounts(grid),
    solver: {
      solved: solver.solved,
      iterations: solver.iterations,
      statistics: solver.statistics,
    },
  };
}

function applyLockedCells(grid, lockedCells) {
  for (const state of lockedCells) {
    const cell = grid.getCell(state.x, state.y, state.z);
    if (!cell) continue;
    applyCellState(cell, state);
  }
}

function applyCellState(cell, state) {
  cell.occupancy = state.occupancy || 'empty';
  cell.zoneId = state.zoneId || null;
  cell.shapeId = state.shapeId || null;
  cell.floor = state.floor ?? state.y;
  cell.style = state.style || 'stone';
  cell.tags = new Set(state.tags || []);
  cell.fixedTile = state.fixedTile || null;
  cell.possibleTiles = new Set(state.possibleTiles || []);
  cell.collapsedTile = state.collapsedTile || null;
  cell.generatedBy = state.generatedBy || null;
  cell.lockedByUser = !!state.lockedByUser;
  cell.contradiction = !!state.contradiction;
}

function serializeCell(cell) {
  return {
    x: cell.x,
    y: cell.y,
    z: cell.z,
    occupancy: cell.occupancy,
    zoneId: cell.zoneId,
    shapeId: cell.shapeId,
    floor: cell.floor,
    style: cell.style,
    tags: Array.from(cell.tags),
    fixedTile: cell.fixedTile,
    possibleTiles: Array.from(cell.possibleTiles),
    collapsedTile: cell.collapsedTile,
    generatedBy: cell.generatedBy,
    lockedByUser: cell.lockedByUser,
    contradiction: cell.contradiction,
  };
}

function getCounts(grid) {
  return grid.getAllCells().reduce(
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
}

function computeGeneratedBounds(grid) {
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
