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
  name: 'room merge smoke',
  shapes: [
    {
      id: 'room_200',
      type: 'room',
      floor: 0,
      style: 'western',
      points: [
        { x: -6, z: -2 },
        { x: -2, z: -2 },
        { x: -2, z: 2 },
        { x: -6, z: 2 },
      ],
    },
    {
      id: 'room_201',
      type: 'room',
      floor: 0,
      style: 'western',
      points: [
        { x: 0, z: -2 },
        { x: 4, z: -2 },
        { x: 4, z: 2 },
        { x: 0, z: 2 },
      ],
    },
  ],
});

debug.selectShapeById('room_201');
await debug.moveSelectedRoom(-2, 0);

const mergedSnapshot = debug.getSnapshot();
const mergedRooms = mergedSnapshot.planShapes.filter((shape) => shape.type === 'room');
const seamLeft = debug.grid.cellAtWorld(-2.5, 0, 0);
const seamRight = debug.grid.cellAtWorld(-1.5, 0, 0);

if (mergedRooms.length !== 1) throw new Error(`Expected adjacent rooms to merge into one room, got ${mergedRooms.length}`);
if (!seamLeft || !seamRight || seamLeft.occupancy !== 'floor' || seamRight.occupancy !== 'floor') {
  throw new Error(`Expected merged seam to be open floor, got ${seamLeft?.occupancy} / ${seamRight?.occupancy}`);
}

await debug.loadPlanJSON({
  version: 1,
  name: 'room corridor smoke',
  shapes: [
    {
      id: 'room_300',
      type: 'room',
      floor: 0,
      style: 'western',
      points: [
        { x: -6, z: -2 },
        { x: -2, z: -2 },
        { x: -2, z: 2 },
        { x: -6, z: 2 },
      ],
    },
    {
      id: 'room_301',
      type: 'room',
      floor: 0,
      style: 'western',
      points: [
        { x: 3, z: -2 },
        { x: 7, z: -2 },
        { x: 7, z: 2 },
        { x: 3, z: 2 },
      ],
    },
  ],
});

debug.selectShapeById('room_301');
await debug.moveSelectedRoom(-2, 0);

const corridorSnapshot = debug.getSnapshot();
const corridorRooms = corridorSnapshot.planShapes.filter((shape) => shape.type === 'room');
const corridors = corridorSnapshot.planShapes.filter((shape) => shape.type === 'corridor');
const hallwayCell = debug.grid.cellAtWorld(-0.5, 0, 0);

console.log(
  'room-connect-debug',
  JSON.stringify({
    mergedRooms,
    seamLeft: seamLeft?.occupancy,
    seamRight: seamRight?.occupancy,
    corridorRooms,
    corridors,
    hallwayCell: hallwayCell ? { x: hallwayCell.x, y: hallwayCell.y, z: hallwayCell.z, occupancy: hallwayCell.occupancy, tags: Array.from(hallwayCell.tags) } : null,
  })
);

if (corridorRooms.length !== 2) throw new Error(`Expected nearby rooms to stay separate, got ${corridorRooms.length} rooms`);
if (corridors.length !== 1) throw new Error(`Expected nearby rooms to create one corridor, got ${corridors.length}`);
if (!hallwayCell || hallwayCell.occupancy !== 'floor' || !hallwayCell.tags.has('corridor')) {
  throw new Error(`Expected generated hallway floor between nearby rooms, got ${JSON.stringify(hallwayCell)}`);
}
