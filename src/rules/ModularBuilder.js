import { RuleRegistry } from './RuleRegistry.js';
import { floorRule } from './FloorRules.js';
import { wallPerimeterRule } from './WallRules.js';
import { doorRule } from './DoorRules.js';
import { windowRule } from './WindowRules.js';
import { bridgeWallRule } from './BridgeRules.js';
import { stairRule } from './StairRules.js';
import { roofRule } from './RoofRules.js';
import { propRule } from './PropRules.js';

export class ModularBuilder {
  constructor(ruleConfig = {}) {
    this.registry = new RuleRegistry();
    this.registerDefaults(ruleConfig);
  }

  registerDefaults(ruleConfig = {}) {
    this.registry.register({ ...floorRule, enabled: ruleConfig.floors !== false });
    this.registry.register({ ...wallPerimeterRule, enabled: ruleConfig.walls !== false });
    this.registry.register({ ...doorRule, enabled: ruleConfig.doors !== false });
    this.registry.register({ ...windowRule, enabled: ruleConfig.windows !== false });
    this.registry.register({ ...bridgeWallRule, enabled: ruleConfig.bridges !== false });
    this.registry.register({ ...stairRule, enabled: ruleConfig.stairs !== false });
    this.registry.register({ ...roofRule, enabled: ruleConfig.roofs !== false });
    this.registry.register({ ...propRule, enabled: ruleConfig.props !== false });
  }

  apply(grid, context = {}) {
    const config = {
      floors: context.floors ?? true,
      walls: context.walls ?? true,
      doors: context.doors ?? true,
      windows: context.windows ?? true,
      bridges: context.bridges ?? true,
      stairs: context.stairs ?? true,
      roofs: context.roofs ?? true,
      props: context.props ?? true,
    };

    for (const rule of this.registry.rules) {
      if (rule.id === 'floor-normalize') rule.enabled = config.floors;
      if (rule.id === 'wall-perimeter') rule.enabled = config.walls;
      if (rule.id === 'door-rule') rule.enabled = config.doors;
      if (rule.id === 'window-rule') rule.enabled = config.windows;
      if (rule.id === 'bridge-supports') rule.enabled = config.bridges;
      if (rule.id === 'stair-rule') rule.enabled = config.stairs;
      if (rule.id === 'roof-rule') rule.enabled = config.roofs;
      if (rule.id === 'prop-rule') rule.enabled = config.props;
    }

    this.registry.apply(grid, context);
  }
}
