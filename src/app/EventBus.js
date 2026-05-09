export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    const list = this.listeners.get(event) || [];
    list.push(handler);
    this.listeners.set(event, list);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const list = this.listeners.get(event) || [];
    this.listeners.set(
      event,
      list.filter((h) => h !== handler)
    );
  }

  emit(event, payload = {}) {
    const list = this.listeners.get(event) || [];
    for (const handler of list) {
      handler(payload);
    }
  }
}
