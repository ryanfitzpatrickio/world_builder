export class InspectorPanel {
  constructor() {
    this.element = document.getElementById('selected-info');
    this.tags = document.getElementById('selected-tags');
    this.forceSelect = document.getElementById('force-tile');
  }

  setTileOptions(tileIds) {
    while (this.forceSelect.options.length > 1) this.forceSelect.remove(1);
    for (const id of tileIds) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      this.forceSelect.appendChild(opt);
    }
  }

  update(cell) {
    if (!cell) {
      this.element.textContent = 'Nothing selected';
      this.tags.textContent = '';
      this.forceSelect.value = '';
      return;
    }

    this.element.textContent = `Cell ${cell.x}, ${cell.y}, ${cell.z} | ${cell.occupancy}`;
    this.tags.textContent = `Tags: ${Array.from(cell.tags).join(', ')}`;
    this.forceSelect.value = cell.lockedByUser ? cell.fixedTile : '';
  }

  updateShape(shape) {
    if (!shape) {
      this.update(null);
      return;
    }
    this.element.textContent = `${shape.type} ${shape.id} | floor ${shape.floor}`;
    this.tags.textContent = `Tags: ${Array.from(shape.tags || []).join(', ')}`;
    this.forceSelect.value = '';
  }
}
