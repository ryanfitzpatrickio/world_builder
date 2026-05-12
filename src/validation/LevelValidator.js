import { getStairDirectionVector } from '../level/StairPlacement.js';

export class LevelValidator {
  constructor({ grid, plan, debugPanel, socketLabel, getCurrentStyle, rebuild, scheduleAutosave, markNeedsCameraFit }) {
    this.grid = grid;
    this.plan = plan;
    this.debugPanel = debugPanel;
    this.socketLabel = socketLabel;
    this.getCurrentStyle = getCurrentStyle;
    this.rebuild = rebuild;
    this.scheduleAutosave = scheduleAutosave;
    this.markNeedsCameraFit = markNeedsCameraFit;
  }

  async validateLevel() {
    this.socketLabel.setText('Validating level...');
    this.debugPanel.log('Validating rooms, openings, and stairs...');
    await this.rebuild();

    const report = {
      checkedRooms: 0,
      addedDoors: 0,
      addedWindows: 0,
      addedStairs: 0,
      skipped: [],
    };

    const rooms = this.plan.getShapes().filter((shape) => shape.type === 'room');
    for (const room of rooms) {
      report.checkedRooms += 1;
      const candidates = this.getExteriorWallCandidates(room);
      if (!this.roomHasExteriorOpening(room, 'door')) {
        const doorCell = this.chooseOpeningCandidate(candidates, { kind: 'door' });
        if (doorCell) {
          this.lockOpeningCell(doorCell, 'door', room.style);
          report.addedDoors += 1;
        } else {
          report.skipped.push(`${room.id}: no sensible exterior door wall`);
        }
      }

      if (!this.roomHasExteriorOpening(room, 'window')) {
        const windowCell = this.chooseOpeningCandidate(candidates, { kind: 'window' });
        if (windowCell) {
          this.lockOpeningCell(windowCell, 'window', room.style);
          report.addedWindows += 1;
        } else {
          report.skipped.push(`${room.id}: no sensible exterior window wall`);
        }
      }
    }

    report.addedStairs = this.addMissingStoryStairs();

    const changed = report.addedDoors + report.addedWindows + report.addedStairs > 0;
    if (changed) {
      this.markNeedsCameraFit();
      this.scheduleAutosave('validate level');
      await this.rebuild();
    }

    const summary = `Validation checked ${report.checkedRooms} rooms; added ${report.addedDoors} doors, ${report.addedWindows} windows, ${report.addedStairs} stairs.`;
    this.debugPanel.log(report.skipped.length ? `${summary} Skipped: ${report.skipped.join('; ')}` : summary);
    this.socketLabel.setText(summary);
    return report;
  }

  getExteriorWallCandidates(room) {
    const candidates = [];
    for (const cell of this.grid.getAllCells()) {
      if (cell.y !== room.floor || cell.occupancy !== 'wall') continue;
      const match = this.getRoomExteriorSide(room, cell);
      if (!match) continue;
      if (cell.tags.has('railing')) continue;
      if (this.isPropBlockedOpening(match.floorCell)) continue;
      candidates.push({ cell, side: match.side, floorCell: match.floorCell, score: this.openingCandidateScore(room, cell) });
    }
    return candidates.sort((a, b) => a.score - b.score);
  }

  getRoomExteriorSide(room, wallCell) {
    for (const [side, dx, dz] of CARDINAL_DIRECTIONS) {
      const inside = this.grid.getCell(wallCell.x + dx, wallCell.y, wallCell.z + dz);
      const outside = this.grid.getCell(wallCell.x - dx, wallCell.y, wallCell.z - dz);
      if (inside?.occupancy === 'floor' && inside.shapeId === room.id && isOutsideCell(outside)) {
        return { side, floorCell: inside };
      }
    }
    return null;
  }

  roomHasExteriorOpening(room, kind) {
    return this.getExteriorWallCandidates(room).some(({ cell }) => hasOpening(cell, kind));
  }

  chooseOpeningCandidate(candidates, { kind } = {}) {
    const usable = candidates.filter(({ cell, floorCell }) => {
      if (this.isPropBlockedOpening(floorCell)) return false;
      if (kind === 'door' && hasOpening(cell, 'window')) return false;
      if (kind === 'window' && hasOpening(cell, 'door')) return false;
      return true;
    });
    if (!usable.length) return null;
    const preferred = usable.find(({ cell }) => !cell.lockedByUser) || usable[0];
    return preferred.cell;
  }

  isPropBlockedOpening(floorCell) {
    if (!floorCell) return true;
    if (floorCell.tags.has('authoredProp') || floorCell.tags.has('propCandidate')) return true;
    return this.plan.getShapes().some((shape) => {
      if (shape.type !== 'prop' || shape.floor !== floorCell.y) return false;
      const propCell = this.grid.cellAtWorld(shape.x, shape.floor, shape.z);
      return propCell?.x === floorCell.x && propCell.y === floorCell.y && propCell.z === floorCell.z;
    });
  }

  openingCandidateScore(room, cell) {
    const bounds = getRoomBounds(room);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const position = this.grid.getWorldPosition(cell);
    return Math.abs(position.x - centerX) + Math.abs(position.z - centerZ) + (cell.lockedByUser ? 10 : 0) + (cell.tags.has('corner') ? 5 : 0);
  }

  lockOpeningCell(cell, kind, style = this.getCurrentStyle()) {
    const tileId = openingTileId(kind, style);
    cell.occupancy = 'wall';
    cell.style = style || cell.style || this.getCurrentStyle();
    cell.generatedBy = 'paint-brush';
    cell.lockedByUser = true;
    cell.fixedTile = tileId;
    cell.collapsedTile = tileId;
    cell.contradiction = false;
    cell.tags.delete('variantWindow');
    cell.tags.delete('forcedDoor');
    cell.tags.delete('variantDoor');
    cell.tags.add('wall');
    cell.tags.add('verticalSurface');
    cell.tags.add('validator');
    if (kind === 'door') {
      cell.tags.add('forcedDoor');
      cell.tags.add('variantDoor');
      cell.tags.add('openDoorway');
      cell.tags.add('exportEmpty');
    } else {
      cell.tags.add('variantWindow');
    }
  }

  addMissingStoryStairs() {
    const roomFloors = [...new Set(this.plan.getShapes().filter((shape) => shape.type === 'room').map((shape) => shape.floor))].sort((a, b) => a - b);
    let added = 0;
    for (let i = 0; i < roomFloors.length - 1; i++) {
      const floor = roomFloors[i];
      const upperFloor = floor + 1;
      if (!roomFloors.includes(upperFloor)) continue;
      if (this.plan.getShapes().some((shape) => shape.type === 'stair' && shape.floor === floor)) continue;
      const candidate = this.findStairCandidate(floor, upperFloor);
      if (!candidate) continue;
      const stair = this.plan.addStair(candidate, floor, candidate.style || this.getCurrentStyle());
      stair.tags = new Set(['validator-stair']);
      added += 1;
    }
    return added;
  }

  findStairCandidate(floor, upperFloor) {
    const length = 4;
    const width = 2;
    const directions = ['PX', 'PZ', 'NX', 'NZ'];
    const lowerCells = this.grid
      .getAllCells()
      .filter((cell) => cell.y === floor && cell.occupancy === 'floor' && String(cell.shapeId || '').startsWith('room_') && !cell.tags.has('authoredProp'));
    lowerCells.sort((a, b) => stairCandidateScore(this.grid, a) - stairCandidateScore(this.grid, b));

    for (const start of lowerCells) {
      for (const direction of directions) {
        if (!this.canPlaceStairAt(start, upperFloor, direction, length, width)) continue;
        const position = this.grid.getWorldPosition(start);
        return { x: position.x, z: position.z, direction, length, width, style: start.style || this.getCurrentStyle() };
      }
    }
    return null;
  }

  canPlaceStairAt(start, upperFloor, directionName, length, width) {
    const dir = getStairDirectionVector(directionName);
    const sideOffsetStart = -Math.floor(width / 2);
    const checkRow = (offsetAlong, y) => {
      for (let side = 0; side < width; side++) {
        const sideOffset = sideOffsetStart + side;
        const cell = this.grid.getCell(start.x + dir.x * offsetAlong + dir.sideX * sideOffset, y, start.z + dir.z * offsetAlong + dir.sideZ * sideOffset);
        if (!cell || cell.occupancy !== 'floor' || cell.tags.has('authoredProp')) return false;
      }
      return true;
    };
    if (!checkRow(-1, start.y)) return false;
    for (let step = 0; step < length; step++) {
      if (!checkRow(step, start.y)) return false;
      if (!checkRow(step, upperFloor)) return false;
    }
    return checkRow(length, upperFloor);
  }
}

const CARDINAL_DIRECTIONS = [
  ['PX', 1, 0],
  ['NX', -1, 0],
  ['PZ', 0, 1],
  ['NZ', 0, -1],
];

function isOutsideCell(cell) {
  return !cell || cell.occupancy === 'empty' || cell.occupancy === 'bridge';
}

function hasOpening(cell, kind) {
  const tileId = cell.collapsedTile || cell.fixedTile || '';
  if (kind === 'door') return cell.tags.has('forcedDoor') || cell.tags.has('variantDoor') || tileId.includes('door');
  return cell.tags.has('variantWindow') || tileId.includes('window');
}

function getRoomBounds(room) {
  return room.points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minZ: Math.min(acc.minZ, point.z),
      maxZ: Math.max(acc.maxZ, point.z),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  );
}

function openingTileId(kind, style) {
  if (kind === 'door') {
    if (style === 'stone') return 'wall_stone_door';
    return 'wall_western_open_doorway';
  }
  if (style === 'stone') return 'wall_stone_window';
  if (style === 'wood') return 'wall_wood_window';
  return 'wall_western_window';
}

function stairCandidateScore(grid, cell) {
  const position = grid.getWorldPosition(cell);
  return Math.abs(position.x) + Math.abs(position.z);
}
