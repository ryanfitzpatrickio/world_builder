import { normalizeDirection } from '../props/PropLibrary.js';

export class PropPlacementController {
  constructor({
    grid,
    plan,
    propLibrary,
    brushTool,
    getCurrentStyle,
    isAutoRebuildEnabled,
    rebuild,
    updatePlanView,
    updateTileView,
    scheduleAutosave,
    setStatusText,
  }) {
    this.grid = grid;
    this.plan = plan;
    this.propLibrary = propLibrary;
    this.brushTool = brushTool;
    this.getCurrentStyle = getCurrentStyle;
    this.isAutoRebuildEnabled = isAutoRebuildEnabled;
    this.rebuild = rebuild;
    this.updatePlanView = updatePlanView;
    this.updateTileView = updateTileView;
    this.scheduleAutosave = scheduleAutosave;
    this.setStatusText = setStatusText;
  }

  placeBrush(hit) {
    const propId = this.propLibrary.normalizeType(this.getBrushPropId(this.brushTool.brush));
    const placement = this.resolvePlacement(hit, propId);
    if (!placement) return false;

    this.removePropsAtCell(placement.floor, placement.world.x, placement.world.z);
    this.plan.addProp(
      {
        x: placement.world.x,
        z: placement.world.z,
        prop: propId,
        direction: placement.direction,
      },
      placement.floor,
      this.brushTool.brush.style || this.getCurrentStyle()
    );
    this.updatePlanView();
    this.scheduleAutosave(`place ${propId}`);
    if (this.isAutoRebuildEnabled()) this.rebuild();
    else {
      this.markPropCell(placement.cell, placement.direction);
      this.updateTileView();
    }
    this.setStatusText(`Placed ${this.brushTool.brush.label || propId}`);
    return true;
  }

  resolvePlacement(hit, propId) {
    const definition = this.propLibrary.definitions.get(propId);
    const needsWall = definition?.placement !== 'center' && !this.propLibrary.isCenterPropId(propId);
    const floor = hit.y;

    if (needsWall && hit.occupancy === 'wall') {
      const adjacent = this.adjacentWalkableCellForWall(hit);
      if (!adjacent) return null;
      return {
        cell: adjacent.cell,
        floor: adjacent.cell.y,
        world: this.grid.getWorldPosition(adjacent.cell),
        direction: adjacent.direction,
      };
    }

    if (isWalkablePlacementCell(hit)) {
      const wallDirection = needsWall ? this.nearestWallDirectionForCell(hit) : null;
      if (needsWall && !wallDirection) return null;
      return {
        cell: hit,
        floor,
        world: this.grid.getWorldPosition(hit),
        direction: normalizeDirection(wallDirection || 'PZ'),
      };
    }

    return null;
  }

  adjacentWalkableCellForWall(wallCell) {
    for (const [directionFromFloorToWall, dx, dz] of CARDINAL_DIRECTIONS) {
      const cell = this.grid.getCell(wallCell.x - dx, wallCell.y, wallCell.z - dz);
      if (isWalkablePlacementCell(cell)) return { cell, direction: directionFromFloorToWall };
    }
    return null;
  }

  getBrushPropId(brush) {
    return this.propLibrary.propIdFromTags(new Set(brush?.tags || []));
  }

  inferDirection(propId, floor, x, z) {
    const definition = this.propLibrary.definitions.get(propId);
    if (definition?.placement !== 'center') {
      const wallDir = this.nearestWallDirection(floor, x, z);
      if (wallDir) return wallDir;
    }
    return 'PZ';
  }

  nearestWallDirection(floor, x, z) {
    const origin = this.grid.worldToCell(x, z, floor);
    return this.nearestWallDirectionForCell(origin);
  }

  nearestWallDirectionForCell(origin) {
    for (const [dir, dx, dz] of CARDINAL_DIRECTIONS) {
      const neighbor = this.grid.getCell(origin.x + dx, origin.y, origin.z + dz);
      if (neighbor?.occupancy === 'wall') return dir;
    }
    return null;
  }

  orientPaintedPropToNearestWall(cell) {
    if (!cell?.tags.has('propCandidate')) return;
    const propId = this.propLibrary.propIdFromTags(cell.tags);
    if (this.propLibrary.isCenterPropId(propId) || cell.tags.has('propPokerTable') || cell.tags.has('propRug') || cell.tags.has('propStoolPair')) return;
    const direction = this.nearestWallDirectionForCell(cell);
    if (!direction) return;
    for (const tag of Array.from(cell.tags)) {
      if (tag.startsWith('propFace')) cell.tags.delete(tag);
    }
    cell.tags.add(`propFace${direction}`);
  }

  removePropsAtCell(floor, x, z) {
    const target = this.grid.worldToCell(x, z, floor);
    for (const shape of this.plan.getShapes()) {
      if (shape.type !== 'prop' || shape.floor !== floor) continue;
      const cell = this.grid.worldToCell(shape.x, shape.z, shape.floor);
      if (cell.x === target.x && cell.y === target.y && cell.z === target.z) {
        this.plan.removeShapeById(shape.id);
      }
    }
  }

  markPropCell(cell, direction) {
    clearPropTags(cell);
    cell.style = this.brushTool.brush.style || cell.style || this.getCurrentStyle();
    cell.tags.add('authoredProp');
    for (const tag of this.brushTool.brush.tags || []) {
      if (!tag.startsWith('propFace')) cell.tags.add(tag);
    }
    cell.tags.add(`propFace${direction}`);
  }
}

const CARDINAL_DIRECTIONS = [
  ['PX', 1, 0],
  ['NX', -1, 0],
  ['PZ', 0, 1],
  ['NZ', 0, -1],
];

function isWalkablePlacementCell(cell) {
  return !!cell && ['floor', 'bridge', 'stair'].includes(cell.occupancy);
}

function clearPropTags(cell) {
  cell.tags.delete('authoredProp');
  cell.tags.delete('propCandidate');
  for (const tag of Array.from(cell.tags)) {
    if (tag.startsWith('propType:') || tag.startsWith('propFace') || /^prop[A-Z]/.test(tag)) cell.tags.delete(tag);
  }
}
