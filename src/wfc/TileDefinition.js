export class TileDefinition {
  constructor({
    id,
    category = 'generic',
    style = 'stone',
    tags = [],
    sockets = {},
    color = 0x888888,
    weight = 1,
  }) {
    this.id = id;
    this.category = category;
    this.style = style;
    this.tags = new Set(tags);
    this.sockets = {
      PX: 'any',
      NX: 'any',
      PY: 'any',
      NY: 'any',
      PZ: 'any',
      NZ: 'any',
      ...sockets,
    };
    this.color = color;
    this.weight = weight;
  }
}
