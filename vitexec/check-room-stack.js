async function waitFor(predicate, label, timeoutMs = 8000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const debug = await waitFor(() => window.levelMakerDebug, 'levelMakerDebug');

await debug.loadPlanJSON({
  version: 1,
  name: 'room stack smoke',
  shapes: [
    {
      id: 'room_400',
      type: 'room',
      floor: 0,
      style: 'western',
      points: [
        { x: -6, z: -5 },
        { x: 6, z: -5 },
        { x: 6, z: 5 },
        { x: -6, z: 5 },
      ],
    },
  ],
});

debug.selectShapeById('room_400');
let snapshot = await debug.stackSelectedRoom(4);
let rooms = snapshot.planShapes.filter((shape) => shape.type === 'room');
let stairs = snapshot.planShapes.filter((shape) => shape.type === 'stair');
const upperFloor = debug.grid.cellAtWorld(0, 3, 0);
const stairwell = debug.grid.getAllCells().find((cell) => cell.y > 0 && cell.occupancy === 'stairwell');

console.log(
  'room-stack-debug-up',
  JSON.stringify({
    rooms: rooms.map((shape) => ({ id: shape.id, floor: shape.floor, tags: shape.tags })),
    stairs: stairs.map((shape) => ({ id: shape.id, floor: shape.floor, x: shape.x, z: shape.z, direction: shape.direction, tags: shape.tags })),
    upperFloor: upperFloor ? { x: upperFloor.x, y: upperFloor.y, z: upperFloor.z, occupancy: upperFloor.occupancy } : null,
    stairwell: stairwell ? { x: stairwell.x, y: stairwell.y, z: stairwell.z, tags: Array.from(stairwell.tags) } : null,
  })
);

if (rooms.length !== 4) throw new Error(`Expected 4 stacked rooms, got ${rooms.length}`);
if (new Set(rooms.map((shape) => shape.floor)).size !== 4) throw new Error(`Expected one room per floor, got ${rooms.map((shape) => shape.floor).join(',')}`);
if (stairs.length !== 3) throw new Error(`Expected 3 stair runs between 4 floors, got ${stairs.length}`);
if (new Set(stairs.map((shape) => `${shape.x},${shape.z},${shape.direction}`)).size < 2) {
  throw new Error(`Expected stacked stairs to alternate positions, got ${JSON.stringify(stairs)}`);
}
for (const upperStair of stairs.filter((shape) => shape.floor > 0)) {
  const lowerStair = stairs.find((shape) => shape.floor === upperStair.floor - 1);
  if (!lowerStair) continue;
  const blocked = new Set(stairUpperReservationKeys(lowerStair));
  const overlap = stairLowerFootprintKeys(upperStair).filter((key) => blocked.has(key));
  if (overlap.length) {
    throw new Error(`Stair ${upperStair.id} overlaps stairwell/landing from ${lowerStair.id}: ${overlap.join(';')}`);
  }
}
if (!upperFloor || !['floor', 'stair', 'stairwell'].includes(upperFloor.occupancy)) {
  throw new Error(`Expected top stacked floor to rasterize, got ${upperFloor?.occupancy}`);
}
if (!stairwell) throw new Error('Expected stairwell cutout on an upper floor');

snapshot = await debug.stackSelectedRoom(2);
rooms = snapshot.planShapes.filter((shape) => shape.type === 'room');
stairs = snapshot.planShapes.filter((shape) => shape.type === 'stair');
const removedFloorCell = debug.grid.cellAtWorld(0, 3, 0);

console.log(
  'room-stack-debug-down',
  JSON.stringify({
    rooms: rooms.map((shape) => ({ id: shape.id, floor: shape.floor, tags: shape.tags })),
    stairs: stairs.map((shape) => ({ id: shape.id, floor: shape.floor, tags: shape.tags })),
    removedFloorCell: removedFloorCell ? { x: removedFloorCell.x, y: removedFloorCell.y, z: removedFloorCell.z, occupancy: removedFloorCell.occupancy } : null,
  })
);

if (rooms.length !== 2) throw new Error(`Expected drag-down stack to keep 2 rooms, got ${rooms.length}`);
if (stairs.length !== 1) throw new Error(`Expected drag-down stack to keep 1 stair run, got ${stairs.length}`);
if (removedFloorCell?.occupancy !== 'empty') throw new Error(`Expected removed top floor to clear, got ${removedFloorCell?.occupancy}`);

function stairUpperReservationKeys(stair) {
  return stairFootprintKeys(stair, -1, Math.round(stair.length || 4));
}

function stairLowerFootprintKeys(stair) {
  return stairFootprintKeys(stair, -1, Math.round(stair.length || 4) - 1);
}

function stairFootprintKeys(stair, fromAlong, toAlong) {
  const direction = stairDirection(stair.direction);
  const length = Math.max(1, Math.round(stair.length || 4));
  const width = Math.max(1, Math.round(stair.width || 1));
  const sideOffsetStart = -Math.floor(width / 2);
  const start = debug.grid.worldToCell(stair.x, stair.z, stair.floor);
  const keys = [];
  for (let offsetAlong = fromAlong; offsetAlong <= Math.min(toAlong, length); offsetAlong += 1) {
    for (let side = 0; side < width; side += 1) {
      const sideOffset = sideOffsetStart + side;
      keys.push(`${start.x + direction.x * offsetAlong + direction.sideX * sideOffset},${start.z + direction.z * offsetAlong + direction.sideZ * sideOffset}`);
    }
  }
  return keys;
}

function stairDirection(direction) {
  if (direction === 'NX') return { x: -1, z: 0, sideX: 0, sideZ: 1 };
  if (direction === 'PZ') return { x: 0, z: 1, sideX: 1, sideZ: 0 };
  if (direction === 'NZ') return { x: 0, z: -1, sideX: 1, sideZ: 0 };
  return { x: 1, z: 0, sideX: 0, sideZ: 1 };
}
