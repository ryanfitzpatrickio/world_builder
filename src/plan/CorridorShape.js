import { Shape } from './Shape.js';

export class CorridorShape extends Shape {
  constructor({ id, floor = 0, from = { x: 0, z: 0 }, to = { x: 1, z: 0 }, width = 2, style = 'stone', tags = [] } = {}) {
    super({ id, type: 'corridor', floor, style, tags });
    this.from = from;
    this.to = to;
    this.width = width;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      from: this.from,
      to: this.to,
      width: this.width,
    };
  }
}
