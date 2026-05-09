export const floorRule = {
  id: 'floor-normalize',
  enabled: true,
  apply(grid) {
    for (const cell of grid.getAllCells()) {
      if (cell.occupancy === 'floor') {
        cell.generatedBy = 'floor-rule';
        cell.tags.add('floor');
      }
    }
  },
};
