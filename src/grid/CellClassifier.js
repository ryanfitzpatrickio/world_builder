import { DIRS } from './Neighborhood.js';

const HORIZONTAL_DIRS = ['PX', 'NX', 'PZ', 'NZ'];

export function classifyCells(grid, _changedRegion = null) {
  for (const cell of grid.getAllCells()) {
    if (cell.occupancy === 'empty') {
      cell.tags.add('empty');
      continue;
    }

    const neighborSet = {};
    for (const [dir, delta] of Object.entries(DIRS)) {
      const n = grid.getCell(cell.x + delta.x, cell.y + delta.y, cell.z + delta.z);
      neighborSet[dir] = n;
      if (HORIZONTAL_DIRS.includes(dir) && (!n || n.occupancy === 'empty')) {
        if (cell.occupancy === 'floor') {
          cell.tags.add('wallBoundaryCandidate');
        }
        continue;
      }

      if (n && cell.occupancy === 'floor' && ['floor', 'bridge', 'stair', 'roof'].includes(n.occupancy)) {
        cell.tags.add('nearInterior');
      }
    }

    if (cell.occupancy === 'floor') {
      cell.tags.add('walkable');
      if (hasEmptyHorizontalNeighbor(neighborSet)) cell.tags.add('nearExterior');
      if (isRoomBoundary(cell, neighborSet)) cell.tags.add('boundary');
    }

    if (cell.occupancy === 'bridge') {
      cell.tags.add('walkable');
      cell.tags.add('needsSupport');
    }

    if (cell.occupancy === 'wall') {
      cell.tags.add('verticalSurface');
      if (isCornerWall(neighborSet)) cell.tags.add('corner');
      if (canBecomeWindow(neighborSet)) cell.tags.add('windowCandidate');
      if (canBecomeDoor(neighborSet)) cell.tags.add('doorCandidate');
    }

    if (cell.occupancy === 'support') {
      cell.tags.add('verticalSurface');
      cell.tags.add('support');
    }
  }
}

function hasEmptyHorizontalNeighbor(neighbors) {
  return HORIZONTAL_DIRS.some((dir) => {
    const n = neighbors[dir];
    return !n || n.occupancy === 'empty';
  });
}

function isRoomBoundary(_cell, neighbors) {
  return HORIZONTAL_DIRS.some((dir) => {
    const n = neighbors[dir];
    return !n || n.occupancy === 'wall' || n.occupancy === 'empty';
  });
}

function isCornerWall(neighbors) {
  const wallAxes = HORIZONTAL_DIRS.filter((dir) => {
    const n = neighbors[dir];
    return !n || n.occupancy === 'empty' || n.occupancy === 'wall';
  });
  return wallAxes.length >= 2;
}

function canBecomeWindow(neighbors) {
  return !!(
    neighbors.PY && neighbors.PY.occupancy === 'empty' &&
    (neighbors.PX?.occupancy === 'floor' || neighbors.NX?.occupancy === 'floor' ||
      neighbors.PZ?.occupancy === 'floor' || neighbors.NZ?.occupancy === 'floor')
  );
}

function canBecomeDoor(neighbors) {
  const axisX = neighbors.PX?.occupancy === 'floor' && neighbors.NX?.occupancy === 'floor';
  const axisZ = neighbors.PZ?.occupancy === 'floor' && neighbors.NZ?.occupancy === 'floor';
  return (axisX || axisZ) && neighbors.PY && neighbors.PY.occupancy === 'empty';
}
