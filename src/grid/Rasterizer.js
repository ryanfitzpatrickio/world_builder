import { RoomShape } from '../plan/RoomShape.js';
import { CorridorShape } from '../plan/CorridorShape.js';
import { BridgePath } from '../plan/BridgePath.js';
import { BUILTIN_PROP_TAGS, normalizePropId, propTypeTag } from '../props/PropDefinitions.js';

const STAIR_DIRECTIONS = {
  PX: { x: 1, z: 0, sideX: 0, sideZ: 1 },
  NX: { x: -1, z: 0, sideX: 0, sideZ: 1 },
  PZ: { x: 0, z: 1, sideX: 1, sideZ: 0 },
  NZ: { x: 0, z: -1, sideX: 1, sideZ: 0 },
};

export function rasterizePlanToGrid(planDocument, grid, changedRegion = null) {
  const region = changedRegion || grid.getBounds();
  for (const cell of grid.getAllCells()) {
    if (!grid.cellInBoundsRegion(cell, region)) continue;
    if (cell.lockedByUser && cell.generatedBy === 'paint-brush') continue;
    cell.occupancy = 'empty';
    cell.shapeId = null;
    cell.generatedBy = null;
    cell.tags.clear();
  }

  const shapes = planDocument.getShapes();
  for (const shape of shapes) {
    if (shape.floor < 0 || shape.floor >= grid.height) continue;
    if (shape.type === 'room') rasterizeRoom(shape, grid);
    if (shape.type === 'corridor') rasterizeCorridor(shape, grid);
    if (shape.type === 'bridgePath') rasterizeBridge(shape, grid);
  }

  // Stairs are applied after floor-bearing shapes so they can reserve an
  // opening through any upper-story floor that overlaps the stair run.
  for (const shape of shapes) {
    if (shape.floor < 0 || shape.floor >= grid.height) continue;
    if (shape.type === 'stair') rasterizeStair(shape, grid);
  }

  for (const shape of shapes) {
    if (shape.floor < 0 || shape.floor >= grid.height) continue;
    if (shape.type === 'prop') rasterizeProp(shape, grid);
  }
}

export function rasterizeRoom(room, grid) {
  const y = room.floor;
  for (const cell of grid.getAllCells()) {
    if (cell.y !== y) continue;
    const wp = grid.getWorldPosition(cell);
    if (pointInPolygon(wp.x, wp.z, room.points)) {
      cell.occupancy = 'floor';
      cell.shapeId = room.id;
      cell.style = room.style;
    }
  }
}

export function rasterizeCorridor(corridor, grid) {
  const y = corridor.floor;
  for (const cell of grid.getAllCells()) {
    if (cell.y !== y) continue;
    const wp = grid.getWorldPosition(cell);
    const d = distancePointToSegment(wp, corridor.from, corridor.to);
    if (d <= corridor.width / 2) {
      cell.occupancy = 'floor';
      cell.shapeId = corridor.id;
      cell.style = corridor.style;
      cell.tags.add('corridor');
    }
  }
}

export function rasterizeBridge(bridge, grid) {
  const y = bridge.floor;
  for (const cell of grid.getAllCells()) {
    if (cell.y !== y) continue;
    const wp = grid.getWorldPosition(cell);
    const d = distancePointToPolyline(wp, bridge.points);
    if (d <= bridge.width / 2) {
      cell.occupancy = 'bridge';
      cell.shapeId = bridge.id;
      cell.style = bridge.style;
      cell.tags.add('bridge');
    }
  }
}

export function rasterizeStair(stair, grid) {
  const direction = STAIR_DIRECTIONS[stair.direction] || STAIR_DIRECTIONS.PX;
  const start = grid.worldToCell(stair.x, stair.z, stair.floor);
  const length = Math.max(1, Math.round(stair.length || 4));
  const width = Math.max(1, Math.round(stair.width || 1));
  const sideOffsetStart = -Math.floor(width / 2);

  markStairLandingRow({
    grid,
    stair,
    floor: stair.floor,
    start,
    direction,
    length,
    width,
    sideOffsetStart,
    offsetAlong: -1,
    tags: ['stairLanding', 'stairBottomLanding', 'keepClear'],
  });
  markUpperStairwellCutoutRow({
    grid,
    stair,
    floor: stair.floor + 1,
    start,
    direction,
    length,
    width,
    sideOffsetStart,
    offsetAlong: -1,
    tags: ['stairwell', 'openToBelow', 'stairBottomHeadroom', 'keepClear'],
  });

  for (let step = 0; step < length; step++) {
    for (let side = 0; side < width; side++) {
      const sideOffset = sideOffsetStart + side;
      const cell = grid.getCell(
        start.x + direction.x * step + direction.sideX * sideOffset,
        stair.floor,
        start.z + direction.z * step + direction.sideZ * sideOffset
      );
      if (!cell) continue;
      cell.occupancy = 'stair';
      cell.shapeId = stair.id;
      cell.style = stair.style;
      cell.tags.add('stair');
      cell.tags.add(`stairDir:${stair.direction}`);
      cell.tags.add(`stairStep:${step}`);
      cell.tags.add(`stairLength:${length}`);

      markUpperStairwellCutoutCell(grid.getCell(cell.x, stair.floor + 1, cell.z), stair, length, [`stairStep:${step}`]);
    }
  }

  const upperFloor = stair.floor + 1;
  if (upperFloor >= grid.height) return;
  markStairLandingRow({
    grid,
    stair,
    floor: upperFloor,
    start,
    direction,
    length,
    width,
    sideOffsetStart,
    offsetAlong: length,
    tags: ['stairLanding', 'stairTopLanding', 'keepClear'],
  });
}

function markUpperStairwellCutoutRow({ grid, stair, floor, start, direction, length, width, sideOffsetStart, offsetAlong, tags }) {
  if (floor >= grid.height) return;
  for (let side = 0; side < width; side++) {
    const sideOffset = sideOffsetStart + side;
    const cell = grid.getCell(
      start.x + direction.x * offsetAlong + direction.sideX * sideOffset,
      floor,
      start.z + direction.z * offsetAlong + direction.sideZ * sideOffset
    );
    markUpperStairwellCutoutCell(cell, stair, length, tags);
  }
}

function markUpperStairwellCutoutCell(cell, stair, length, extraTags = []) {
  if (!cell || cell.lockedByUser) return;
  cell.occupancy = 'stairwell';
  cell.shapeId = stair.id;
  cell.style = stair.style;
  cell.generatedBy = 'stair-opening';
  cell.tags.clear();
  cell.tags.add('stairwell');
  cell.tags.add('openToBelow');
  cell.tags.add(`stairDir:${stair.direction}`);
  cell.tags.add(`stairLength:${length}`);
  for (const tag of extraTags) cell.tags.add(tag);
}

function markStairLandingRow({ grid, stair, floor, start, direction, length, width, sideOffsetStart, offsetAlong, tags }) {
  for (let side = 0; side < width; side++) {
    const sideOffset = sideOffsetStart + side;
    const landing = grid.getCell(
      start.x + direction.x * offsetAlong + direction.sideX * sideOffset,
      floor,
      start.z + direction.z * offsetAlong + direction.sideZ * sideOffset
    );
    if (!landing) continue;
    if (landing.occupancy === 'empty') {
      landing.occupancy = 'floor';
      landing.shapeId = stair.id;
      landing.style = stair.style;
      landing.generatedBy = 'stair-landing';
    }
    if (landing.occupancy === 'floor' || landing.occupancy === 'bridge' || landing.occupancy === 'stair') {
      for (const tag of tags) landing.tags.add(tag);
      landing.tags.add(`stairDir:${stair.direction}`);
      landing.tags.add(`stairLength:${length}`);
    }
  }
}

export function rasterizeProp(prop, grid) {
  const cell = grid.cellAtWorld(prop.x, prop.floor, prop.z);
  if (!cell || !['floor', 'bridge', 'stair'].includes(cell.occupancy)) return;
  const propId = normalizePropId(prop.prop);
  const propTag = BUILTIN_PROP_TAGS[propId];
  const direction = STAIR_DIRECTIONS[prop.direction] ? prop.direction : 'PZ';
  clearPropTags(cell);
  cell.style = prop.style || cell.style;
  cell.tags.add('authoredProp');
  cell.tags.add('propCandidate');
  cell.tags.add(propTypeTag(propId));
  if (propTag) cell.tags.add(propTag);
  cell.tags.add(`propFace${direction}`);
}

function clearPropTags(cell) {
  cell.tags.delete('authoredProp');
  cell.tags.delete('propCandidate');
  for (const tag of BUILTIN_PROP_TAGS ? Object.values(BUILTIN_PROP_TAGS) : []) cell.tags.delete(tag);
  for (const tag of Array.from(cell.tags)) {
    if (tag.startsWith('propType:') || tag.startsWith('propFace')) cell.tags.delete(tag);
  }
}

function pointInPolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const zi = points[i].z;
    const xj = points[j].x;
    const zj = points[j].z;
    const intersect =
      (zi > z) !== (zj > z) &&
      x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distancePointToSegment(point, a, b) {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const wx = point.x - a.x;
  const wz = point.z - a.z;

  const vv = vx * vx + vz * vz;
  if (vv === 0) {
    const dx = point.x - a.x;
    const dz = point.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  let t = (wx * vx + wz * vz) / vv;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * vx;
  const pz = a.z + t * vz;
  const dx = point.x - px;
  const dz = point.z - pz;
  return Math.sqrt(dx * dx + dz * dz);
}

function distancePointToPolyline(point, points) {
  if (!points.length) return Infinity;
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    min = Math.min(min, distancePointToSegment(point, points[i], points[i + 1]));
  }
  return min;
}
