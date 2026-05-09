import { RoomShape } from '../plan/RoomShape.js';
import { CorridorShape } from '../plan/CorridorShape.js';
import { BridgePath } from '../plan/BridgePath.js';

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

  for (const shape of planDocument.getShapes()) {
    if (shape.floor < 0 || shape.floor >= grid.height) continue;
    if (shape.type === 'room') rasterizeRoom(shape, grid);
    if (shape.type === 'corridor') rasterizeCorridor(shape, grid);
    if (shape.type === 'bridgePath') rasterizeBridge(shape, grid);
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
