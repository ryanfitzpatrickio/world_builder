const HORIZONTAL_PAIRS = [
  ['PX', 'NX'],
  ['PZ', 'NZ'],
];

const DIRS = {
  PX: { x: 1, z: 0 },
  NX: { x: -1, z: 0 },
  PZ: { x: 0, z: 1 },
  NZ: { x: 0, z: -1 },
};

export const doorRule = {
  id: 'door-rule',
  enabled: true,
  apply(grid, context = {}) {
    const config = context.typeConfig?.door || {};
    const maxPerShape = config.maxPerShape ?? 2;
    const frequency = config.frequency ?? 100;
    const candidatesByConnection = new Map();

    for (const cell of grid.getAllCells()) {
      if (cell.occupancy !== 'wall') continue;
      if (cell.lockedByUser && cell.generatedBy === 'paint-brush') continue;
      cell.tags.delete('forcedDoor');
      cell.tags.delete('variantDoor');

      const connection = getInteriorConnection(grid, cell);
      if (!connection) continue;

      const key = connection.shapeIds.sort().join('::');
      const current = candidatesByConnection.get(key);
      if (!current || scoreDoorCandidate(cell) < scoreDoorCandidate(current)) {
        candidatesByConnection.set(key, cell);
      }
    }

    const doorCountByShape = new Map();
    for (const cell of candidatesByConnection.values()) {
      const connection = getInteriorConnection(grid, cell);
      if (!connection) continue;
      if (scoreDoorCandidate(cell) % 100 >= frequency) continue;

      const canPlace = connection.shapeIds.every((shapeId) => (doorCountByShape.get(shapeId) || 0) < maxPerShape);
      if (!canPlace) continue;

      cell.tags.add('forcedDoor');
      cell.tags.add('variantDoor');
      cell.style = cell.style || 'stone';
      cell.generatedBy = 'door-rule';

      for (const shapeId of connection.shapeIds) {
        doorCountByShape.set(shapeId, (doorCountByShape.get(shapeId) || 0) + 1);
      }
    }
  },
};

function getInteriorConnection(grid, cell) {
  for (const [a, b] of HORIZONTAL_PAIRS) {
    const na = neighbor(grid, cell, a);
    const nb = neighbor(grid, cell, b);
    if (na?.occupancy !== 'floor' || nb?.occupancy !== 'floor') continue;
    if (!na.shapeId || !nb.shapeId || na.shapeId === nb.shapeId) continue;
    return {
      axis: a === 'PX' ? 'x' : 'z',
      shapeIds: [na.shapeId, nb.shapeId],
    };
  }
  return null;
}

function neighbor(grid, cell, dir) {
  const d = DIRS[dir];
  return grid.getCell(cell.x + d.x, cell.y, cell.z + d.z);
}

function scoreDoorCandidate(cell) {
  return Math.abs((cell.x * 73856093) ^ (cell.y * 19349663) ^ (cell.z * 83492791));
}
