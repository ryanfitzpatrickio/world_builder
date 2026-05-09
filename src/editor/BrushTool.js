import { lockCell } from '../wfc/ConstraintMask.js';

export class BrushTool {
  constructor() {
    this.tileId = null;
    this.brush = null;
  }

  setTile(tileId) {
    this.tileId = tileId;
    this.brush = {
      id: tileId,
      label: tileId,
      occupancy: null,
      fixedTile: tileId,
      tags: [],
    };
  }

  setBrush(brush) {
    this.brush = brush;
    this.tileId = brush?.fixedTile || null;
  }

  apply(cell) {
    if (!cell || !this.brush) return null;
    applyBrushToCell(cell, this.brush);
    return cell;
  }

  erase(cell) {
    if (!cell) return null;
    cell.lockedByUser = false;
    cell.fixedTile = null;
    cell.collapsedTile = null;
    return cell;
  }
}

function applyBrushToCell(cell, brush) {
  if (brush.occupancy) cell.occupancy = brush.occupancy;
  if (brush.style) cell.style = brush.style;
  cell.tags.clear();
  for (const tag of brush.tags || []) cell.tags.add(tag);
  cell.generatedBy = 'paint-brush';
  cell.shapeId = cell.shapeId || 'painted';
  cell.contradiction = false;

  if (brush.fixedTile) {
    lockCell(cell, brush.fixedTile);
  } else {
    cell.lockedByUser = false;
    cell.fixedTile = null;
    cell.collapsedTile = null;
    cell.possibleTiles = new Set();
  }
}
