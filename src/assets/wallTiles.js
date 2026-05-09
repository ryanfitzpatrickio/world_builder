import { TileDefinition } from '../wfc/TileDefinition.js';

export function createWallTiles() {
  return [
    new TileDefinition({
      id: 'wall_stone_plain',
      category: 'wall',
      style: 'stone',
      tags: ['wall', 'stone', 'straight'],
      color: 0x8d8d8d,
      sockets: {
        PX: 'wall',
        NX: 'wall',
        NY: 'any',
        PY: 'any',
        PZ: 'wall',
        NZ: 'wall',
      },
    }),
    new TileDefinition({
      id: 'wall_stone_window',
      category: 'wall',
      style: 'stone',
      tags: ['wall', 'window', 'stone', 'straight'],
      color: 0x9ca7b8,
      sockets: {
        PX: 'wall',
        NX: 'wall',
        NY: 'any',
        PY: 'any',
        PZ: 'wall',
        NZ: 'wall',
      },
    }),
    new TileDefinition({
      id: 'wall_stone_door',
      category: 'wall',
      style: 'stone',
      tags: ['wall', 'door', 'stone', 'straight'],
      color: 0xbb7e3d,
      sockets: {
        PX: 'wall',
        NX: 'wall',
        NY: 'any',
        PY: 'any',
        PZ: 'wall',
        NZ: 'wall',
      },
    }),
    new TileDefinition({
      id: 'wall_stone_corner',
      category: 'wall',
      style: 'stone',
      tags: ['wall', 'corner', 'stone'],
      color: 0x80858f,
      sockets: {
        PX: 'wall',
        NX: 'wall',
        NY: 'any',
        PY: 'any',
        PZ: 'wall',
        NZ: 'wall',
      },
    }),
  ];
}

export function createWoodWallTiles() {
  return [
    new TileDefinition({
      id: 'wall_wood_plain',
      category: 'wall',
      style: 'wood',
      tags: ['wall', 'wood', 'straight'],
      color: 0x9a6e42,
      sockets: {
        PX: 'wall',
        NX: 'wall',
        NY: 'any',
        PY: 'any',
        PZ: 'wall',
        NZ: 'wall',
      },
    }),
    new TileDefinition({
      id: 'wall_wood_window',
      category: 'wall',
      style: 'wood',
      tags: ['wall', 'window', 'wood', 'straight'],
      color: 0xaa8052,
      sockets: {
        PX: 'wall',
        NX: 'wall',
        NY: 'any',
        PY: 'any',
        PZ: 'wall',
        NZ: 'wall',
      },
    }),
  ];
}
