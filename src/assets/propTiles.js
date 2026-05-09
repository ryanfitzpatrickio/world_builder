import { TileDefinition } from '../wfc/TileDefinition.js';

export function createPropTiles() {
  return [
    new TileDefinition({
      id: 'roof_stone_plain',
      category: 'roof',
      style: 'stone',
      tags: ['roof', 'stone'],
      color: 0x5b5b5b,
      sockets: {
        PX: 'roof',
        NX: 'roof',
        PZ: 'roof',
        NZ: 'roof',
        NY: 'any',
        PY: 'any',
      },
    }),
    new TileDefinition({
      id: 'prop_stone',
      category: 'prop',
      style: 'stone',
      tags: ['prop', 'stone'],
      color: 0x8a9a77,
      sockets: {
        PX: 'any',
        NX: 'any',
        PZ: 'any',
        NZ: 'any',
        PY: 'any',
        NY: 'any',
      },
    }),
  ];
}
