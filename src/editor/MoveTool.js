export class MoveTool {
  constructor() {
    this.active = false;
  }

  begin() {
    this.active = true;
  }

  end() {
    this.active = false;
  }

  isActive() {
    return this.active;
  }
}

