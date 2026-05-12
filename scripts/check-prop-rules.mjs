import { PlanDocument } from '../src/plan/PlanDocument.js';
import { Grid3D } from '../src/grid/Grid3D.js';
import { rasterizePlanToGrid } from '../src/grid/Rasterizer.js';

const DIR_VECTORS = {
  PX: { x: 1, z: 0 },
  NX: { x: -1, z: 0 },
  PZ: { x: 0, z: 1 },
  NZ: { x: 0, z: -1 },
};

const PROP_ROTATIONS = {
  PX: -Math.PI / 2,
  NX: Math.PI / 2,
  PZ: Math.PI,
  NZ: 0,
};

for (const [dir, rotation] of Object.entries(PROP_ROTATIONS)) {
  const back = rotateBackVector(rotation);
  const expected = DIR_VECTORS[dir];
  assert(back.x === expected.x && back.z === expected.z, `${dir} back vector should face ${JSON.stringify(expected)}, got ${JSON.stringify(back)}`);
}

const plan = new PlanDocument();
plan.addRoom([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }], 0, 'western');
plan.addProp({ x: 1, z: 1, prop: 'crateStack', direction: 'PZ' }, 0, 'western');
plan.addProp({ x: 1, z: 1, prop: 'gunRack', direction: 'NZ' }, 0, 'western');

const grid = new Grid3D({ width: 12, height: 2, depth: 12, cellSize: 1, originX: -4, originZ: -4 });
rasterizePlanToGrid(plan, grid);

const propCells = grid.getAllCells().filter((cell) => cell.tags.has('propCandidate'));
assert(propCells.length === 1, `expected one prop cell, got ${propCells.length}`);

const tags = propCells[0].tags;
assert(tags.has('propType:gunRack'), 'replacement prop should keep propType:gunRack');
assert(tags.has('propGunRack'), 'replacement prop should keep propGunRack');
assert(tags.has('propFaceNZ'), 'replacement prop should face the requested wall direction');
assert(!tags.has('propCrateStack'), 'replacement prop should clear the old crate tag');
assert(!tags.has('propFacePZ'), 'replacement prop should clear the old face direction');

console.log('Prop rules OK');

function rotateBackVector(rotation) {
  const x = Math.round(-Math.sin(rotation));
  const z = Math.round(-Math.cos(rotation));
  return { x, z };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
