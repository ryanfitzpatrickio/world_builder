const HORIZONTAL_DIRS = ['PX', 'NX', 'PZ', 'NZ'];

const DIRS = {
  PX: { x: 1, z: 0 },
  NX: { x: -1, z: 0 },
  PZ: { x: 0, z: 1 },
  NZ: { x: 0, z: -1 },
};

const PROP_TAGS = [
  'propBarCounter',
  'propPokerTable',
  'propBarrelStack',
  'propShelf',
  'propBedCot',
  'propPiano',
  'propWantedPoster',
  'propLanternStand',
  'propRug',
  'propStoolPair',
  'propCrateStack',
];

export const propRule = {
  id: 'prop-rule',
  enabled: true,
  apply(grid, context = {}) {
    const config = context.typeConfig?.prop || {};
    for (const cell of grid.getAllCells()) {
      if (cell.occupancy !== 'floor') continue;
      if (cell.lockedByUser && cell.generatedBy === 'paint-brush') continue;
      clearPropTags(cell);

      if (cell.style === 'western') {
        assignWesternProp(grid, cell, config);
      } else {
        assignDefaultProp(cell, config);
      }
    }
  },
};

function clearPropTags(cell) {
  cell.tags.delete('propCandidate');
  for (const tag of PROP_TAGS) cell.tags.delete(tag);
  for (const dir of HORIZONTAL_DIRS) cell.tags.delete(`propFace${dir}`);
}

function assignDefaultProp(cell, config) {
  const density = config.density ?? 18;
  if (cell.tags.has('nearExterior') && positiveHash(cell.x, cell.y, cell.z) % 100 < density) {
    cell.tags.add('propCandidate');
  }
}

function assignWesternProp(grid, cell, config) {
  if (!config.allowHallways && (cell.tags.has('corridor') || isHallwayCell(grid, cell))) return;

  const wallDir = nearestWallDir(grid, cell);
  const openScore = openNeighborCount(grid, cell);
  const hash = positiveHash(cell.x, cell.y, cell.z);
  const density = config.density ?? 38;
  const set = config.set || 'saloon';
  if (hash % 100 >= density) return;

  if (wallDir && ['saloon', 'storage', 'mixed'].includes(set) && hash % 17 === 0) {
    markProp(cell, 'propShelf', wallDir);
    return;
  }

  if (wallDir && ['saloon', 'mixed'].includes(set) && hash % 13 === 0) {
    markProp(cell, 'propBarCounter', wallDir);
    return;
  }

  if (wallDir && ['lodging', 'mixed'].includes(set) && hash % 23 === 0) {
    markProp(cell, 'propBedCot', wallDir);
    return;
  }

  if (wallDir && ['saloon', 'mixed'].includes(set) && hash % 29 === 0) {
    markProp(cell, 'propPiano', wallDir);
    return;
  }

  if (cell.tags.has('nearExterior') && ['storage', 'mixed'].includes(set) && hash % 7 === 0) {
    markProp(cell, 'propBarrelStack', wallDir || 'NZ');
    return;
  }

  if (openScore >= 3 && ['saloon', 'mixed'].includes(set) && hash % 8 === 0) {
    markProp(cell, 'propPokerTable', 'PZ');
    return;
  }

  if (openScore >= 2 && ['saloon', 'mixed'].includes(set) && hash % 9 === 0) {
    markProp(cell, 'propStoolPair', 'PZ');
    return;
  }

  if (hash % 31 === 0) {
    markProp(cell, 'propLanternStand', wallDir || 'PX');
    return;
  }

  if (['storage', 'mixed'].includes(set) && hash % 37 === 0) {
    markProp(cell, 'propCrateStack', wallDir || 'NX');
    return;
  }

  if (openScore >= 3 && hash % 11 === 0) {
    markProp(cell, 'propRug', 'PZ');
  }
}

function markProp(cell, tag, dir) {
  cell.tags.add('propCandidate');
  cell.tags.add(tag);
  cell.tags.add(`propFace${dir}`);
}

function nearestWallDir(grid, cell) {
  for (const dir of HORIZONTAL_DIRS) {
    const d = DIRS[dir];
    const neighbor = grid.getCell(cell.x + d.x, cell.y, cell.z + d.z);
    if (neighbor?.occupancy === 'wall') return dir;
  }
  return null;
}

function openNeighborCount(grid, cell) {
  let count = 0;
  for (const dir of HORIZONTAL_DIRS) {
    const d = DIRS[dir];
    const neighbor = grid.getCell(cell.x + d.x, cell.y, cell.z + d.z);
    if (neighbor?.occupancy === 'floor') count += 1;
  }
  return count;
}

function isHallwayCell(grid, cell) {
  const px = grid.getCell(cell.x + 1, cell.y, cell.z)?.occupancy === 'floor';
  const nx = grid.getCell(cell.x - 1, cell.y, cell.z)?.occupancy === 'floor';
  const pz = grid.getCell(cell.x, cell.y, cell.z + 1)?.occupancy === 'floor';
  const nz = grid.getCell(cell.x, cell.y, cell.z - 1)?.occupancy === 'floor';
  const runsX = px && nx && !pz && !nz;
  const runsZ = pz && nz && !px && !nx;
  return runsX || runsZ;
}

function positiveHash(x, y, z) {
  return Math.abs((x * 73856093) ^ (y * 19349663) ^ (z * 83492791));
}
