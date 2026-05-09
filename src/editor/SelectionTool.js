export class SelectionTool {
  constructor() {
    this.active = false;
    this.cell = null;
  }

  pick(cell) {
    this.active = true;
    this.cell = cell;
    return cell;
  }

  clear() {
    this.active = false;
    this.cell = null;
  }
}

export function createPickerState() {
  return new SelectionTool();
}
