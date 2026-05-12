export const roofRule = {
  id: 'roof-rule',
  enabled: true,
  apply(grid) {
    for (const cell of grid.getAllCells()) {
      if (!['floor', 'bridge', 'stair'].includes(cell.occupancy)) continue;
      const above = grid.getCell(cell.x, cell.y + 1, cell.z);
      if (!above) continue;
      if (above.occupancy === 'empty') {
        above.occupancy = 'roof';
        above.style = cell.style;
        above.shapeId = cell.shapeId;
        above.generatedBy = 'roof-rule';
        above.tags.delete('empty');
        above.tags.add('roof');
        above.tags.add('flatRoof');
        above.tags.add(`roofForFloor:${cell.y}`);
      }
    }

    for (const cell of grid.getAllCells()) {
      if (cell.occupancy !== 'roof' || !cell.tags.has('flatRoof')) continue;
      for (const dir of ['PX', 'NX', 'PZ', 'NZ']) {
        const neighbor = grid.getCell(
          cell.x + (dir === 'PX' ? 1 : dir === 'NX' ? -1 : 0),
          cell.y,
          cell.z + (dir === 'PZ' ? 1 : dir === 'NZ' ? -1 : 0)
        );
        if (!neighbor || neighbor.occupancy !== 'roof') cell.tags.add(`roofEdge:${dir}`);
      }
    }
  },
};
