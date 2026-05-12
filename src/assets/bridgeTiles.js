import { TileDefinition } from '../wfc/TileDefinition.js';

export function createBridgeTiles() {
  return [
    new TileDefinition({
      id: 'bridge_stone_deck',
      category: 'bridge',
      style: 'stone',
      tags: ['bridge', 'stone', 'straight'],
      color: 0x7b6f61,
      sockets: {
        PX: 'bridge',
        NX: 'bridge',
        PZ: 'bridge_side',
        NZ: 'bridge_side',
        NY: 'any',
        PY: 'any',
      },
    }),
    new TileDefinition({
      id: 'bridge_stone_railing',
      category: 'wall',
      style: 'stone',
      tags: ['wall', 'railing', 'stone'],
      color: 0x615a53,
      sockets: {
        PX: 'wall_stone',
        NX: 'wall_stone',
        PZ: 'support_socket',
        NZ: 'support_socket',
        PY: 'any',
        NY: 'any',
      },
    }),
    new TileDefinition({
      id: 'support_stone',
      category: 'support',
      style: 'stone',
      tags: ['support', 'stone'],
      color: 0x505050,
      sockets: {
        PX: 'support_socket',
        NX: 'support_socket',
        PZ: 'support_socket',
        NZ: 'support_socket',
        PY: 'any',
        NY: 'any',
      },
    }),
  ];
}
