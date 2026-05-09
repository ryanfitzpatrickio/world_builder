import { TileSet } from '../wfc/TileSet.js';
import { createWallTiles, createWoodWallTiles } from './wallTiles.js';
import { createFloorTiles } from './floorTiles.js';
import { createBridgeTiles } from './bridgeTiles.js';
import { createPropTiles } from './propTiles.js';
import { createWesternTiles } from './westernTiles.js';
import { TileDefinition } from '../wfc/TileDefinition.js';

export class ModularAssetRegistry {
  constructor() {
    this.tileSet = new TileSet();
    this._registerDefaults();
  }

  _registerDefaults() {
    const all = [
      ...createWallTiles(),
      ...createWoodWallTiles(),
      ...createFloorTiles(),
      ...createBridgeTiles(),
      ...createPropTiles(),
      ...createWesternTiles(),
      new TileDefinition({
        id: 'empty',
        category: 'empty',
        style: 'none',
        tags: ['empty'],
        color: 0x000000,
        sockets: {
          PX: 'empty',
          NX: 'empty',
          PZ: 'empty',
          NZ: 'empty',
          PY: 'empty',
          NY: 'empty',
        },
      }),
    ];

    for (const tile of all) this.tileSet.register(tile);
  }

  getTileSet() {
    return this.tileSet;
  }

  getTile(id) {
    return this.tileSet.get(id);
  }

  listTileIds() {
    return this.tileSet.getAll().map((t) => t.id).filter((id) => id !== 'empty');
  }
}
