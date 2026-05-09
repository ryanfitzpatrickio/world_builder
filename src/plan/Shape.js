export class Shape {
  constructor({ id, type, floor = 0, style = 'stone', tags = [] } = {}) {
    this.id = id;
    this.type = type;
    this.floor = floor;
    this.style = style;
    this.tags = new Set(tags);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      floor: this.floor,
      style: this.style,
      tags: Array.from(this.tags),
    };
  }
}
