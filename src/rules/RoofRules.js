export const roofRule = {
  id: 'roof-rule',
  enabled: true,
  apply(grid) {
    for (const cell of grid.getAllCells()) {
      if (cell.occupancy !== 'floor') continue;
      const above = grid.getCell(cell.x, cell.y + 1, cell.z);
      if (!above) continue;
      if (above.occupancy === 'empty' && !cell.tags.has('boundary')) {
        above.occupancy = 'roof';
        above.style = cell.style;
        above.shapeId = cell.shapeId;
        above.generatedBy = 'roof-rule';
      }
    }
  },
};
