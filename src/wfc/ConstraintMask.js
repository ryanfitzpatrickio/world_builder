import { TileDefinition } from './TileDefinition.js';

export function prepareWFCConstraints(grid, tileSet) {
  const empty = tileSet.get('empty');
  for (const cell of grid.getAllCells()) {
    if (cell.lockedByUser && cell.fixedTile) {
      cell.possibleTiles = new Set([cell.fixedTile]);
      cell.tags.add('locked');
      continue;
    }

    if (cell.occupancy === 'empty' || cell.occupancy === 'stairwell') {
      cell.possibleTiles = new Set([empty.id]);
      cell.tags.add('empty');
      continue;
    }

    const style = cell.style || 'stone';
    let bucket = [];

    if (cell.occupancy === 'floor' || cell.occupancy === 'stair') {
      bucket = findCategoryWithFallback(tileSet, 'floor', style);
    } else if (cell.occupancy === 'wall') {
      bucket = findWallBucket(tileSet, cell, style);
    } else if (cell.occupancy === 'bridge') {
      bucket = findCategoryWithFallback(tileSet, 'bridge', style);
    } else if (cell.occupancy === 'support') {
      bucket = findCategoryWithFallback(tileSet, 'support', style);
    } else if (cell.occupancy === 'roof') {
      bucket = findCategoryWithFallback(tileSet, 'roof', style);
    } else if (cell.occupancy === 'railing') {
      bucket = findTaggedWithFallback(tileSet, ['wall', 'railing'], style);
    } else {
      bucket = [empty];
    }

    const ids = bucket.map((t) => t.id);
    cell.possibleTiles = new Set(ids.length ? ids : [empty.id]);
    cell.collapsedTile = null;
  }
}

function findWallBucket(tileSet, cell, style) {
  if (cell.tags.has('railing')) return findTaggedWithFallback(tileSet, ['wall', 'railing'], style, { allowPlainWall: true });
  if (cell.tags.has('corner')) return findTaggedWithFallback(tileSet, ['wall', 'corner'], style, { allowPlainWall: true });
  if (cell.tags.has('openDoorway') || cell.tags.has('exportEmpty')) {
    return findTaggedWithFallback(tileSet, ['wall', 'doorway', 'open'], style, { allowDoorFallback: true });
  }
  if (cell.tags.has('forcedDoor')) return findTaggedWithFallback(tileSet, ['wall', 'door'], style, { allowPlainWall: true });
  if (cell.tags.has('variantWindow')) return findTaggedWithFallback(tileSet, ['wall', 'window'], style, { allowPlainWall: true });
  return findPlainWallWithFallback(tileSet, style);
}

function findTaggedWithFallback(tileSet, tags, style, { allowDoorFallback = false, allowPlainWall = false } = {}) {
  const styled = tileSet.findByTags([...tags, style]);
  if (styled.length) return styled;

  if (allowDoorFallback) {
    const door = tileSet.findByTags(['wall', 'door', style]);
    if (door.length) return door;
  }

  if (allowPlainWall) {
    const plain = findPlainWallWithFallback(tileSet, style);
    if (plain.length) return plain;
  }

  for (const fallbackStyle of fallbackStyles(style)) {
    const bucket = tileSet.findByTags([...tags, fallbackStyle]);
    if (bucket.length) return bucket;
    if (allowDoorFallback) {
      const door = tileSet.findByTags(['wall', 'door', fallbackStyle]);
      if (door.length) return door;
    }
  }

  return tileSet.findByTags(tags);
}

function findPlainWallWithFallback(tileSet, style) {
  for (const candidateStyle of fallbackStyles(style)) {
    const bucket = tileSet
      .findByTags(['wall', 'straight', candidateStyle])
      .filter((tile) => !tile.tags.has('door') && !tile.tags.has('window'));
    if (bucket.length) return bucket;
  }

  return tileSet
    .findByTags(['wall', 'straight'])
    .filter((tile) => !tile.tags.has('door') && !tile.tags.has('window'));
}

function findCategoryWithFallback(tileSet, category, style) {
  for (const candidateStyle of fallbackStyles(style)) {
    const bucket = tileSet.findByCategoryStyle(category, candidateStyle);
    if (bucket.length) return bucket;
  }
  return tileSet.getAll().filter((tile) => tile.category === category);
}

function fallbackStyles(style) {
  const styles = [style, 'western', 'wood', 'stone'];
  return [...new Set(styles.filter(Boolean))];
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
