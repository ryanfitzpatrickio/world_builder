export class RuleRegistry {
  constructor() {
    this.rules = [];
  }

  register(rule) {
    this.rules.push(rule);
  }

  apply(grid, context) {
    for (const rule of this.rules) {
      if (!rule || rule.enabled === false) continue;
      if (typeof rule.apply === 'function') {
        rule.apply(grid, context);
      }
    }
  }
}
