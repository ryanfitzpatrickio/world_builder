import { TileDefinition } from './TileDefinition.js';

export function prepareWFCConstraints(grid, tileSet) {
  const empty = tileSet.get('empty');
  for (const cell of grid.getAllCells()) {
    if (cell.lockedByUser && cell.fixedTile) {
      cell.possibleTiles = new Set([cell.fixedTile]);
      cell.tags.add('locked');
      continue;
    }

    if (cell.occupancy === 'empty') {
      cell.possibleTiles = new Set([empty.id]);
      cell.tags.add('empty');
      continue;
    }

    const style = cell.style || 'stone';
    let bucket = [];

    if (cell.occupancy === 'floor') {
      bucket = tileSet.findByCategoryStyle('floor', style);
    } else if (cell.occupancy === 'wall') {
      if (cell.tags.has('railing')) bucket = tileSet.findByTags(['wall', 'railing', style]);
      else if (cell.tags.has('corner')) bucket = tileSet.findByTags(['wall', 'corner', style]);
      else if (cell.tags.has('forcedDoor')) bucket = tileSet.findByTags(['wall', 'door', style]);
      else if (cell.tags.has('variantWindow')) bucket = tileSet.findByTags(['wall', 'window', style]);
      else bucket = tileSet.findByTags(['wall', 'straight', style]).filter((tile) => !tile.tags.has('door') && !tile.tags.has('window'));
    } else if (cell.occupancy === 'bridge') {
      bucket = tileSet.findByCategoryStyle('bridge', style);
    } else if (cell.occupancy === 'support') {
      bucket = tileSet.findByCategoryStyle('support', style);
    } else if (cell.occupancy === 'roof') {
      bucket = tileSet.findByCategoryStyle('roof', style);
    } else if (cell.occupancy === 'railing') {
      bucket = tileSet.findByTags(['wall', 'railing', style]);
    } else {
      bucket = [empty];
    }

    const ids = bucket.map((t) => t.id);
    cell.possibleTiles = new Set(ids.length ? ids : [empty.id]);
    cell.collapsedTile = null;
  }
}

export function lockCell(cell, tileId) {
  cell.lockedByUser = true;
  cell.fixedTile = tileId;
  cell.possibleTiles = new Set([tileId]);
  cell.collapsedTile = tileId;
}

export function clearAllLocks(grid) {
  for (const c of grid.getAllCells()) {
    c.lockedByUser = false;
    c.fixedTile = null;
  }
}
