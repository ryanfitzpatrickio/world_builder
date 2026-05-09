export const windowRule = {
  id: 'window-rule',
  enabled: true,
  apply(grid, context = {}) {
    const config = context.typeConfig?.window || {};
    const frequency = config.frequency ?? 25;
    const windowCountByShape = new Map();

    for (const cell of grid.getAllCells()) {
      if (cell.occupancy !== 'wall') continue;
      if (cell.lockedByUser && cell.generatedBy === 'paint-brush') continue;
      cell.tags.delete('variantWindow');
      if (!cell.tags.has('windowCandidate') && !isExteriorWallWithInteriorFloor(grid, cell)) continue;
      if (cell.tags.has('forcedDoor') || cell.tags.has('corner') || cell.tags.has('railing')) continue;

      const shapeId = cell.shapeId || 'unknown';
      const limit = config.maxPerShape ?? (cell.style === 'western' ? 3 : 5);
      const count = windowCountByShape.get(shapeId) || 0;
      if (count >= limit) continue;
      if (windowScore(cell) % 100 >= frequency) continue;

      cell.tags.add('variantWindow');
      windowCountByShape.set(shapeId, count + 1);
    }
  },
};

const DIRS = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

function isExteriorWallWithInteriorFloor(grid, cell) {
  let hasFloor = false;
  let hasEmpty = false;
  for (const dir of DIRS) {
    const neighbor = grid.getCell(cell.x + dir.x, cell.y, cell.z + dir.z);
    if (neighbor?.occupancy === 'floor') hasFloor = true;
    if (!neighbor || neighbor.occupancy === 'empty') hasEmpty = true;
  }
  return hasFloor && hasEmpty;
}

function windowScore(cell) {
  return Math.abs((cell.x * 92837111) ^ (cell.y * 689287499) ^ (cell.z * 283923481));
}
