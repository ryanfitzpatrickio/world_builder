export const bridgeWallRule = {
  id: 'bridge-supports',
  enabled: true,
  apply(grid) {
    const bridgeCells = grid.getAllCells().filter((c) => c.occupancy === 'bridge');
    for (const cell of bridgeCells) {
      const below = grid.getCell(cell.x, cell.y - 1, cell.z);
      if (below && below.occupancy === 'empty') {
        below.occupancy = 'support';
        below.generatedBy = 'bridge-supports';
        below.tags.add('support');
      }

      const left = grid.getCell(cell.x - 1, cell.y, cell.z);
      const right = grid.getCell(cell.x + 1, cell.y, cell.z);
      const up = grid.getCell(cell.x, cell.y, cell.z - 1);
      const down = grid.getCell(cell.x, cell.y, cell.z + 1);
      if (left && left.occupancy === 'empty') {
        left.occupancy = 'wall';
        left.tags.add('railing');
        left.generatedBy = 'bridge-rail';
      }
      if (right && right.occupancy === 'empty') {
        right.occupancy = 'wall';
        right.tags.add('railing');
        right.generatedBy = 'bridge-rail';
      }
      if (up && up.occupancy === 'empty') {
        up.occupancy = 'wall';
        up.tags.add('railing');
        up.generatedBy = 'bridge-rail';
      }
      if (down && down.occupancy === 'empty') {
        down.occupancy = 'wall';
        down.tags.add('railing');
        down.generatedBy = 'bridge-rail';
      }
    }
  },
};
