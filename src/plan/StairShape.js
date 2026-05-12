import { Shape } from './Shape.js';

export class StairShape extends Shape {
  constructor({
    id,
    floor = 0,
    x = 0,
    z = 0,
    direction = 'PX',
    length = 4,
    width = 2,
    style = 'stone',
    tags = [],
  } = {}) {
    super({ id, type: 'stair', floor, style, tags });
    this.x = x;
    this.z = z;
    this.direction = direction;
    this.length = length;
    this.width = width;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      x: this.x,
      z: this.z,
      direction: this.direction,
      length: this.length,
      width: this.width,
    };
  }
}
