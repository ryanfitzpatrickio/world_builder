export class Cell {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;

    this.occupancy = 'empty';
    this.zoneId = null;
    this.shapeId = null;
    this.floor = y;
    this.style = 'stone';

    this.tags = new Set();
    this.neighbors = {};

    this.fixedTile = null;
    this.possibleTiles = new Set();
    this.collapsedTile = null;

    this.generatedBy = null;
    this.lockedByUser = false;
    this.contradiction = false;
  }

  key() {
    return `${this.x},${this.y},${this.z}`;
  }

  clearGeneratedData() {
    const lockedByUser = this.lockedByUser;
    const fixedTile = this.fixedTile;
    this.generatedBy = null;
    this.possibleTiles = new Set();
    this.collapsedTile = null;
    this.contradiction = false;
    this.tags.clear();
    this.shapeId = null;
    this.occupancy = 'empty';
    this.style = 'stone';
    this.lockedByUser = lockedByUser;
    this.fixedTile = fixedTile;
  }

  setFromAuthoring(planCell) {
    this.occupancy = planCell.occupancy;
    this.shapeId = planCell.shapeId;
    this.floor = planCell.floor;
    this.style = planCell.style;
  }
}
