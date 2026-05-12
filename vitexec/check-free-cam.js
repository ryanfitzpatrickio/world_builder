import * as THREE from 'three';

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
  name: 'free cam collision smoke',
  shapes: [
    {
      id: 'room_700',
      type: 'room',
      floor: 0,
      style: 'western',
      points: [
        { x: -4, z: -4 },
        { x: 4, z: -4 },
        { x: 4, z: 4 },
        { x: -4, z: 4 },
      ],
    },
  ],
});
debug.setCurrentFloor(0);

const before = debug.getSnapshot();
debug.setFreeCam(true);
const enabled = debug.getSnapshot();
const freeCamCheckbox = document.querySelector('#camera-free-cam');
freeCamCheckbox?.focus();
freeCamCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));
await new Promise((resolve) => setTimeout(resolve, 0));
if (document.activeElement === freeCamCheckbox) throw new Error('Free cam checkbox kept focus after change');
const initialYaw = debug.app.freeLook.yaw;
debug.app._lookFreeCamera(30, 0);
const yawAfterRightDrag = debug.app.freeLook.yaw;
debug.app.freeLook.yaw = initialYaw;
debug.app._applyFreeLook();

if (enabled.scene.cameraMode !== 'free') throw new Error(`Expected free camera mode, got ${enabled.scene.cameraMode}`);
if (Math.abs(debug.app.camera.position.y - 0.95) > 0.01) {
  throw new Error(`Expected first-person eye height near 0.95 on floor 0, got ${debug.app.camera.position.y}`);
}
if (debug.app.controls.enabled) throw new Error('Orbit controls should be disabled in free cam mode');
if (yawAfterRightDrag <= initialYaw) {
  throw new Error(`Expected right mouse drag to turn right/increase yaw, got ${initialYaw} -> ${yawAfterRightDrag}`);
}

debug.app.pointerLocked = true;
const pointerLockYaw = debug.app.freeLook.yaw;
debug.app._handlePointerLockMouseMove({ movementX: 20, movementY: 0, shiftKey: false });
if (debug.app.freeLook.yaw <= pointerLockYaw) {
  throw new Error(`Expected pointer-lock mouse movement to turn right, got ${pointerLockYaw} -> ${debug.app.freeLook.yaw}`);
}
debug.app.pointerLocked = false;
debug.app.freeLook.yaw = initialYaw;
debug.app._applyFreeLook();

debug.app.camera.position.set(0, 0.95, 0);
debug.app.freeLook.yaw = 0;
debug.app.freeLook.pitch = -0.45;
debug.app._applyFreeLook();
const rect = debug.app.renderer.domElement.getBoundingClientRect();
debug.app._handlePointer(fakePointerEvent(rect.left + 19, rect.top + 23), 'move');
if (Math.abs(debug.app.mouse.x) > 0.0001 || Math.abs(debug.app.mouse.y) > 0.0001) {
  throw new Error(`Expected free-cam pick ray to use viewport center, got ${debug.app.mouse.x}, ${debug.app.mouse.y}`);
}

debug.app.camera.position.set(enabled.scene.camera.x, enabled.scene.camera.y, enabled.scene.camera.z);
debug.app.freeLook.yaw = initialYaw;
debug.app.freeLook.pitch = 0;
debug.app._applyFreeLook();
debug.app.keys.add('w');
debug.app._updateFreeCameraMovement(0.12);
debug.app.keys.delete('w');

const moved = debug.getSnapshot();
const distance = Math.hypot(
  moved.scene.camera.x - enabled.scene.camera.x,
  moved.scene.camera.y - enabled.scene.camera.y,
  moved.scene.camera.z - enabled.scene.camera.z
);

const beforeRight = debug.app.camera.position.clone();
debug.app.camera.position.set(enabled.scene.camera.x, enabled.scene.camera.y, enabled.scene.camera.z);
debug.app.freeLook.yaw = initialYaw;
debug.app.freeLook.pitch = 0;
debug.app._applyFreeLook();
const forwardVector = debug.app._freeGroundForwardVector().clone();
const rightVector = new THREE.Vector3().crossVectors(forwardVector, new THREE.Vector3(0, 1, 0)).normalize();
beforeRight.copy(debug.app.camera.position);
debug.app.keys.add('d');
debug.app._updateFreeCameraMovement(0.12);
debug.app.keys.delete('d');
const afterRight = debug.app.camera.position.clone();
const rightDot = afterRight.sub(beforeRight).dot(rightVector);

const wallProbe = findWallWithFloorNeighbor();
if (!wallProbe) throw new Error('Could not find wall/floor pair for free cam collision check');
const floorWorld = debug.grid.getWorldPosition(wallProbe.floor);
debug.app.camera.position.set(floorWorld.x, 0.95, floorWorld.z);
debug.app.freeLook.yaw = Math.atan2(wallProbe.wall.x - wallProbe.floor.x, -(wallProbe.wall.z - wallProbe.floor.z));
debug.app.freeLook.pitch = 0;
debug.app._applyFreeLook();
const collisionStart = debug.app.camera.position.clone();
debug.app.keys.add('w');
debug.app._updateFreeCameraMovement(0.36);
debug.app.keys.delete('w');
const collisionEnd = debug.app.camera.position.clone();
const collisionCell = debug.grid.cellAtWorld(collisionEnd.x, 0, collisionEnd.z);
const collisionCellSnapshot = collisionCell
  ? { x: collisionCell.x, y: collisionCell.y, z: collisionCell.z, occupancy: collisionCell.occupancy }
  : null;
const movedTowardWall =
  (collisionEnd.x - collisionStart.x) * (wallProbe.wall.x - wallProbe.floor.x) +
  (collisionEnd.z - collisionStart.z) * (wallProbe.wall.z - wallProbe.floor.z);

await debug.loadPlanJSON({
  version: 1,
  name: 'free cam stairs smoke',
  shapes: [
    {
      id: 'room_800',
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
    {
      id: 'room_801',
      type: 'room',
      floor: 1,
      style: 'western',
      points: [
        { x: -6, z: -5 },
        { x: 6, z: -5 },
        { x: 6, z: 5 },
        { x: -6, z: 5 },
      ],
    },
    {
      id: 'stair_800',
      type: 'stair',
      floor: 0,
      style: 'western',
      x: -4.5,
      z: -3.5,
      direction: 'PX',
      length: 4,
      width: 2,
      tags: ['free-cam-stair-smoke'],
    },
  ],
});
debug.setCurrentFloor(0);
const stairStartCell = debug.grid.worldToCell(-4.5, -3.5, 0);
const stairBottomHeadroomCells = [];
for (const sideOffset of [-1, 0]) {
  const cell = debug.grid.getCell(stairStartCell.x - 1, 1, stairStartCell.z + sideOffset);
  stairBottomHeadroomCells.push(cell ? { x: cell.x, y: cell.y, z: cell.z, occupancy: cell.occupancy, tags: Array.from(cell.tags) } : null);
}
debug.setFreeCam(true);
debug.app.camera.position.set(-4.5, 0.95, -3.5);
debug.app.freeLook.yaw = Math.PI / 2;
debug.app.freeLook.pitch = 0;
debug.app._applyFreeLook();
const stairStartY = debug.app.camera.position.y;
debug.app.keys.add('w');
stepFreeCam(0.45);
debug.app.keys.delete('w');
const stairEndY = debug.app.camera.position.y;
const stairEndCell = debug.grid.cellAtWorld(debug.app.camera.position.x, 0, debug.app.camera.position.z);
debug.app.keys.add('w');
stepFreeCam(0.65);
debug.app.keys.delete('w');
const stairTopY = debug.app.camera.position.y;
const stairTopCell = debug.grid.cellAtWorld(debug.app.camera.position.x, 1, debug.app.camera.position.z);

debug.setFreeCam(false);
const disabled = debug.getSnapshot();

console.log(
  'free-cam-debug',
  JSON.stringify({
    beforeMode: before.scene.cameraMode,
    enabledMode: enabled.scene.cameraMode,
    disabledMode: disabled.scene.cameraMode,
    enabledCamera: enabled.scene.camera,
    movedCamera: moved.scene.camera,
    distance,
    yawAfterRightDrag,
    rightDot,
    collision: {
      wall: { x: wallProbe.wall.x, y: wallProbe.wall.y, z: wallProbe.wall.z },
      floor: { x: wallProbe.floor.x, y: wallProbe.floor.y, z: wallProbe.floor.z },
      endCell: collisionCellSnapshot,
      movedTowardWall,
    },
    stairs: {
      startY: stairStartY,
      endY: stairEndY,
      endCell: stairEndCell ? { x: stairEndCell.x, y: stairEndCell.y, z: stairEndCell.z, occupancy: stairEndCell.occupancy, tags: Array.from(stairEndCell.tags) } : null,
      topY: stairTopY,
      topFloor: debug.app.freeFloor,
      topCell: stairTopCell ? { x: stairTopCell.x, y: stairTopCell.y, z: stairTopCell.z, occupancy: stairTopCell.occupancy, tags: Array.from(stairTopCell.tags) } : null,
      bottomHeadroom: stairBottomHeadroomCells,
    },
  })
);

if (distance <= 0.05) throw new Error(`Expected WASD movement in free cam, moved only ${distance}`);
if (rightDot <= 0.05) throw new Error(`Expected D key to move right, dot product was ${rightDot}`);
if (!collisionCellSnapshot || !['floor', 'bridge', 'stair'].includes(collisionCellSnapshot.occupancy)) {
  throw new Error(`Free cam collision allowed camera into a solid cell: ${JSON.stringify(collisionCellSnapshot)}`);
}
if (movedTowardWall > 0.55) throw new Error(`Free cam collision moved too far into wall direction: ${movedTowardWall}`);
if (stairBottomHeadroomCells.some((cell) => cell?.occupancy !== 'stairwell' || !cell.tags.includes('stairBottomHeadroom'))) {
  throw new Error(`Expected upper floor above bottom stair landing to be open stairwell headroom: ${JSON.stringify(stairBottomHeadroomCells)}`);
}
if (stairEndY <= stairStartY + 0.2) throw new Error(`Expected free cam to climb stair ramp, y ${stairStartY} -> ${stairEndY}`);
if (stairEndCell?.occupancy !== 'stair') throw new Error(`Expected free cam to remain on stair while climbing, got ${stairEndCell?.occupancy}`);
if (debug.app.freeFloor !== 1) throw new Error(`Expected free cam to reach upper floor, got floor ${debug.app.freeFloor}`);
if (stairTopCell?.occupancy !== 'floor') throw new Error(`Expected free cam to walk onto upper floor landing, got ${stairTopCell?.occupancy}`);
if (stairTopY <= stairEndY) throw new Error(`Expected free cam to step up to upper floor, y ${stairEndY} -> ${stairTopY}`);
if (disabled.scene.cameraMode !== 'orbit') throw new Error(`Expected orbit camera mode after disabling, got ${disabled.scene.cameraMode}`);
if (!debug.app.controls.enabled) throw new Error('Orbit controls should be re-enabled after leaving free cam mode');

function stepFreeCam(totalSeconds) {
  const frameSeconds = 1 / 60;
  let remaining = totalSeconds;
  while (remaining > 0) {
    const step = Math.min(frameSeconds, remaining);
    debug.app._updateFreeCameraMovement(step);
    remaining -= step;
  }
}

function findWallWithFloorNeighbor() {
  for (const wall of debug.grid.getAllCells()) {
    if (wall.y !== 0 || wall.occupancy !== 'wall') continue;
    const neighbors = [
      debug.grid.getCell(wall.x + 1, wall.y, wall.z),
      debug.grid.getCell(wall.x - 1, wall.y, wall.z),
      debug.grid.getCell(wall.x, wall.y, wall.z + 1),
      debug.grid.getCell(wall.x, wall.y, wall.z - 1),
    ];
    const floor = neighbors.find((cell) => cell?.occupancy === 'floor');
    if (floor) return { wall, floor };
  }
  return null;
}

function fakePointerEvent(clientX, clientY) {
  return {
    altKey: false,
    button: 0,
    buttons: 0,
    clientX,
    clientY,
    ctrlKey: false,
    metaKey: false,
    pointerId: 909,
    shiftKey: false,
    preventDefault() {},
    stopImmediatePropagation() {},
  };
}
