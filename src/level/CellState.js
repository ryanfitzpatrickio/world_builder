export function applyCellState(cell, state) {
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

export function serializeCellState(cell) {
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

export function getLockedCellStates(grid) {
  return grid.getAllCells().filter((cell) => cell.lockedByUser).map(serializeCellState);
}

export function clearGridLocks(grid) {
  for (const cell of grid.getAllCells()) {
    cell.lockedByUser = false;
    cell.fixedTile = null;
  }
}
