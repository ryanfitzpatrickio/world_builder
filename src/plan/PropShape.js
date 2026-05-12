import { Shape } from './Shape.js';

export class PropShape extends Shape {
  constructor({
    id,
    floor = 0,
    x = 0,
    z = 0,
    prop = 'crateStack',
    direction = 'PZ',
    style = 'western',
    tags = [],
  } = {}) {
    super({ id, type: 'prop', floor, style, tags });
    this.x = x;
    this.z = z;
    this.prop = prop;
    this.direction = direction;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      x: this.x,
      z: this.z,
      prop: this.prop,
      direction: this.direction,
    };
  }
}
