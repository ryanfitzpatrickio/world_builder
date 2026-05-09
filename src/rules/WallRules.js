import { DIRS } from '../grid/Neighborhood.js';

const HORIZONTAL_DIRS = ['PX', 'NX', 'PZ', 'NZ'];

export const wallPerimeterRule = {
  id: 'wall-perimeter',
  enabled: true,
  apply(grid) {
    const candidates = [];
    for (const cell of grid.getAllCells()) {
      if (cell.occupancy !== 'floor') continue;
      for (const dir of HORIZONTAL_DIRS) {
        const delta = DIRS[dir];
        const neighbor = grid.getCell(cell.x + delta.x, cell.y + delta.y, cell.z + delta.z);
        if (!neighbor) continue;
        if (neighbor.occupancy === 'empty') {
          candidates.push({ x: neighbor.x, y: neighbor.y, z: neighbor.z, src: cell.shapeId, style: cell.style });
        }
      }
    }

    for (const info of candidates) {
      const wall = grid.getCell(info.x, info.y, info.z);
      if (!wall || wall.occupancy !== 'empty') continue;
      wall.occupancy = 'wall';
      wall.style = info.style;
      wall.shapeId = info.src;
      wall.generatedBy = 'wall-perimeter';
      wall.tags.add('wall');
      wall.tags.add('generated');
    }
  },
};
