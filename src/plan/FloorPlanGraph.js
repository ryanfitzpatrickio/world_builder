export class FloorPlanGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  clear() {
    this.nodes.clear();
    this.edges.length = 0;
  }

  addShape(shape) {
    this.nodes.set(shape.id, shape);
  }

  connect(shapeAId, shapeBId) {
    this.edges.push({ a: shapeAId, b: shapeBId });
  }

  removeShape(shapeId) {
    this.nodes.delete(shapeId);
    this.edges = this.edges.filter((edge) => edge.a !== shapeId && edge.b !== shapeId);
  }
}
