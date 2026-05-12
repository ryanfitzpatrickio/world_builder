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
        if (isWalkableOccupancy(cell.occupancy)) {
          cell.tags.add('wallBoundaryCandidate');
        }
        continue;
      }

      if (n && isWalkableOccupancy(cell.occupancy) && ['floor', 'bridge', 'stair', 'roof'].includes(n.occupancy)) {
        cell.tags.add('nearInterior');
      }
    }

    if (cell.occupancy === 'floor' || cell.occupancy === 'stair') {
      cell.tags.add('walkable');
      if (hasEmptyHorizontalNeighbor(neighborSet)) cell.tags.add('nearExterior');
      if (isRoomBoundary(cell, neighborSet)) cell.tags.add('boundary');
      markPartitionWalls(cell, neighborSet);
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

function markPartitionWalls(cell, neighbors) {
  if (cell.occupancy !== 'floor' || cell.tags.has('corridor')) return;
  for (const dir of ['PX', 'PZ']) {
    const neighbor = neighbors[dir];
    if (!shouldPartition(cell, neighbor)) continue;
    cell.tags.add(`partitionWall:${dir}`);
  }
}

function shouldPartition(cell, neighbor) {
  if (!neighbor || neighbor.occupancy !== 'floor') return false;
  if (!cell.shapeId || !neighbor.shapeId || cell.shapeId === neighbor.shapeId) return false;
  if (neighbor.tags.has('corridor') || neighbor.tags.has('stairLanding')) return false;
  if (String(cell.shapeId).startsWith('corridor_') || String(neighbor.shapeId).startsWith('corridor_')) return false;
  if (String(cell.shapeId).startsWith('stair_') || String(neighbor.shapeId).startsWith('stair_')) return false;
  return true;
}

function isCornerWall(neighbors) {
  const interiorDirs = HORIZONTAL_DIRS.filter((dir) => isWalkableOccupancy(neighbors[dir]?.occupancy));
  return interiorDirs.some((a, index) => {
    return interiorDirs.slice(index + 1).some((b) => !areOppositeDirs(a, b));
  });
}

function areOppositeDirs(a, b) {
  return (
    (a === 'PX' && b === 'NX') ||
    (a === 'NX' && b === 'PX') ||
    (a === 'PZ' && b === 'NZ') ||
    (a === 'NZ' && b === 'PZ')
  );
}

function canBecomeWindow(neighbors) {
  return !!(
    neighbors.PY && neighbors.PY.occupancy === 'empty' &&
    (isWalkableOccupancy(neighbors.PX?.occupancy) || isWalkableOccupancy(neighbors.NX?.occupancy) ||
      isWalkableOccupancy(neighbors.PZ?.occupancy) || isWalkableOccupancy(neighbors.NZ?.occupancy))
  );
}

function canBecomeDoor(neighbors) {
  const axisX = isWalkableOccupancy(neighbors.PX?.occupancy) && isWalkableOccupancy(neighbors.NX?.occupancy);
  const axisZ = isWalkableOccupancy(neighbors.PZ?.occupancy) && isWalkableOccupancy(neighbors.NZ?.occupancy);
  return (axisX || axisZ) && neighbors.PY && neighbors.PY.occupancy === 'empty';
}

function isWalkableOccupancy(occupancy) {
  return occupancy === 'floor' || occupancy === 'bridge' || occupancy === 'stair';
}
