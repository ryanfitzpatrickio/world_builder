import { TileDefinition } from './TileDefinition.js';

export class TileSet {
  constructor() {
    this.tiles = new Map();
  }

  register(tile) {
    const def = tile instanceof TileDefinition ? tile : new TileDefinition(tile);
    this.tiles.set(def.id, def);
    return def;
  }

  get(id) {
    return this.tiles.get(id);
  }

  getAll() {
    return Array.from(this.tiles.values());
  }

  findByTags(tags = []) {
    return this.getAll().filter((tile) => tags.every((tag) => tile.tags.has(tag)));
  }

  findByCategoryStyle(category, style) {
    return this.getAll().filter((tile) => tile.category === category && tile.style === style);
  }
}
