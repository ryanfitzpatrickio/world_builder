import { TileDefinition } from '../wfc/TileDefinition.js';

export function createFloorTiles() {
  return [
    new TileDefinition({
      id: 'floor_stone_plain',
      category: 'floor',
      style: 'stone',
      tags: ['floor', 'stone'],
      color: 0x666d7f,
      sockets: {
        PX: 'floor',
        NX: 'floor',
        PZ: 'floor',
        NZ: 'floor',
        PY: 'any',
        NY: 'any',
      },
    }),
    new TileDefinition({
      id: 'floor_wood_plain',
      category: 'floor',
      style: 'wood',
      tags: ['floor', 'wood'],
      color: 0x775f46,
      sockets: {
        PX: 'floor',
        NX: 'floor',
        PZ: 'floor',
        NZ: 'floor',
        PY: 'any',
        NY: 'any',
      },
    }),
  ];
}
