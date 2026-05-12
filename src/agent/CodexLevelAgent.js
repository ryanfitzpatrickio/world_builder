import { planLevelFromPrompt } from './LevelPlanner.js';
import { LEVEL_CODEX_TOOLS } from './levelCodexTools.js';
import { clampFloor, normalizeDirection } from '../props/PropLibrary.js';
import { getStairLandingRequirement, validateStairPlacement } from '../level/StairPlacement.js';

export class CodexLevelAgent {
  constructor({
    ui,
    plan,
    grid,
    propLibrary,
    propPlacement,
    getCurrentStyle,
    setCurrentStyle,
    getCurrentFloor,
    loadPlanJSON,
    getLevelDebugSnapshot,
    updatePlanView,
    updateTileView,
    rebuild,
    scheduleAutosave,
    markNeedsCameraFit,
    clearSelection,
  }) {
    this.ui = ui;
    this.plan = plan;
    this.grid = grid;
    this.propLibrary = propLibrary;
    this.propPlacement = propPlacement;
    this.getCurrentStyle = getCurrentStyle;
    this.setCurrentStyle = setCurrentStyle;
    this.getCurrentFloor = getCurrentFloor;
    this.loadPlanJSON = loadPlanJSON;
    this.getLevelDebugSnapshot = getLevelDebugSnapshot;
    this.updatePlanView = updatePlanView;
    this.updateTileView = updateTileView;
    this.rebuild = rebuild;
    this.scheduleAutosave = scheduleAutosave;
    this.markNeedsCameraFit = markNeedsCameraFit;
    this.clearSelection = clearSelection;
    this.threadId = null;
    this.abortSocket = null;
  }

  async applyPrompt() {
    const prompt = this.ui.agentPrompt.value.trim();
    if (!prompt) return;
    if (this.abortSocket) {
      this.appendMessage('agent', 'Codex is already editing this level.');
      return;
    }
    this.appendMessage('user', prompt);
    this.ui.agentApply.disabled = true;
    this.ui.agentApply.textContent = 'Running...';
    this.appendMessage('agent', 'Connecting to Codex CLI...');
    try {
      const status = await fetch('/api/codex/status', { headers: { accept: 'application/json' } }).then((response) => response.json());
      if (!status.available) throw new Error(status.error || 'Codex CLI unavailable. Run "codex login" in your terminal.');
      await this.runSession(prompt);
      this.ui.agentPrompt.value = '';
    } catch (err) {
      this.appendMessage('agent', `Codex CLI failed: ${err.message}. Using local planner fallback.`);
      await this.applyLocalPlan(prompt);
    } finally {
      this.abortSocket = null;
      this.ui.agentApply.disabled = false;
      this.ui.agentApply.textContent = 'Apply';
    }
  }

  runSession(userMessage) {
    return new Promise((resolveSession, rejectSession) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/ws/codex`);
      this.abortSocket = ws;
      let assistantText = '';
      let mutated = false;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'start',
          model: 'gpt-5.4',
          threadId: this.threadId,
          systemPrompt: createLevelCodexSystemPrompt(),
          tools: LEVEL_CODEX_TOOLS,
          userMessage,
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'thread') {
          this.threadId = msg.threadId;
          return;
        }
        if (msg.type === 'status') {
          this.appendStatus(`Codex: ${msg.status}`);
          return;
        }
        if (msg.type === 'delta') {
          assistantText += msg.text || '';
          return;
        }
        if (msg.type === 'tool_call') {
          Promise.resolve(this.executeTool(msg.name, msg.args || {})).then((result) => {
            if (result.mutated) mutated = true;
            ws.send(JSON.stringify({
              type: 'tool_result',
              id: msg.id,
              result: JSON.stringify(result),
              success: result.success !== false,
            }));
          }).catch((error) => {
            ws.send(JSON.stringify({
              type: 'tool_result',
              id: msg.id,
              result: JSON.stringify({ success: false, error: error?.message || 'Tool failed' }),
              success: false,
            }));
          });
          return;
        }
        if (msg.type === 'turn_complete') {
          const text = (msg.text || assistantText || '').trim();
          if (text) this.appendMessage('agent', text.slice(0, 500));
          ws.close();
          if (mutated) resolveSession();
          else rejectSession(new Error('Codex finished without applying a level edit.'));
          return;
        }
        if (msg.type === 'error') {
          ws.close();
          rejectSession(new Error(msg.message || 'Codex error'));
        }
      };

      ws.onerror = () => {
        rejectSession(new Error('Codex WebSocket failed. Restart the dev server and check codex login.'));
      };
      ws.onclose = () => {
        if (this.abortSocket === ws) this.abortSocket = null;
      };
    });
  }

  async executeTool(name, args) {
    try {
      if (name === 'get_level_summary') return { success: true, level: this.getLevelDebugSnapshot(), vocabulary: this.getToolVocabulary() };
      if (name === 'replace_plan') return await this.replacePlan(args);
      if (name === 'clear_plan') return await this.clearPlan();
      if (name === 'add_room') return await this.addRoom(args);
      if (name === 'add_corridor') return await this.addCorridor(args);
      if (name === 'add_bridge') return await this.addBridge(args);
      if (name === 'add_stair') return await this.addStair(args);
      if (name === 'define_prop') return await this.defineProp(args);
      if (name === 'add_prop') return await this.addProp(args);
      if (name === 'decorate_room') return await this.decorateRoom(args);
      return { success: false, error: `Unknown tool: ${name}` };
    } catch (error) {
      console.error(error);
      return { success: false, error: error?.message || 'Tool failed' };
    }
  }

  getToolVocabulary() {
    return {
      styles: ['western', 'stone', 'wood', 'metal'],
      floors: [0, 1, 2, 3],
      bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
      stairDirections: ['PX', 'NX', 'PZ', 'NZ'],
      propTypes: this.propLibrary.propTypes,
      propDefinitions: this.propLibrary.getDefinitions(),
      roomGuidance: {
        defaultSize: 'compact, usually 4x4 to 7x6 cells',
        largeOnlyWhenAsked: true,
      },
      stairGuidance: {
        directions: {
          PX: 'runs east; bottom landing is one row west of x,z; top landing is one row east of the last stair tile',
          NX: 'runs west; bottom landing is one row east of x,z; top landing is one row west of the last stair tile',
          PZ: 'runs south; bottom landing is one row north of x,z; top landing is one row south of the last stair tile',
          NZ: 'runs north; bottom landing is one row south of x,z; top landing is one row north of the last stair tile',
        },
        landingDepth: 1,
        bottomHeadroomCutout: 'same row as the bottom landing, but on the upper floor; this must be walkable floor before add_stair so it can be cut open',
        landingWidth: 'same as stair width',
        keepClear: ['bottom landing row', 'upper-floor cutout above bottom landing', 'top landing row', 'stair run'],
        planningRule: 'make the lower and upper rooms large enough to contain the lower stair run, the upper stairwell cutout over the run, the upper-floor headroom cutout over the bottom landing, and both clear landing rows before calling add_stair; if add_stair reports missing clearance, add/enlarge rooms and retry',
      },
      decorationGuidance: {
        wallProps: this.propLibrary.getTypesByPlacement('wall'),
        centerProps: this.propLibrary.getTypesByPlacement('center'),
        keepClear: ['doors', 'corridors', 'stair landings'],
        customPropFormat: 'define_prop accepts up to 24 box parts; each part has material, scale [x,y,z], position [x,y,z], and optional rotationY; keep every part inside one tile',
      },
    };
  }

  async replacePlan(args) {
    await this.loadPlanJSON(args.level, { autosave: true });
    return { success: true, mutated: true, shapes: this.plan.getShapes().length };
  }

  async clearPlan() {
    this.plan.clear();
    this.clearSelection();
    this.updatePlanView();
    this.markNeedsCameraFit();
    await this.rebuild();
    this.scheduleAutosave('clear plan');
    return { success: true, mutated: true, shapes: 0 };
  }

  async addRoom(args) {
    const x1 = Number(args.x1);
    const z1 = Number(args.z1);
    const x2 = Number(args.x2);
    const z2 = Number(args.z2);
    const room = this.plan.addRoom(
      [
        { x: x1, z: z1 },
        { x: x2, z: z1 },
        { x: x2, z: z2 },
        { x: x1, z: z2 },
      ],
      clampFloor(args.floor),
      args.style || this.getCurrentStyle()
    );
    room.tags = new Set(args.tags || []);
    await this.finishPlanEdit();
    return { success: true, mutated: true, shape: room.toJSON() };
  }

  async addCorridor(args) {
    const corridor = this.plan.addCorridor(
      { x: Number(args.fromX), z: Number(args.fromZ) },
      { x: Number(args.toX), z: Number(args.toZ) },
      Math.max(1, Number(args.width || 2)),
      clampFloor(args.floor),
      args.style || this.getCurrentStyle()
    );
    corridor.tags = new Set(args.tags || []);
    await this.finishPlanEdit();
    return { success: true, mutated: true, shape: corridor.toJSON() };
  }

  async addBridge(args) {
    const points = requirePoints(args.points);
    const bridge = this.plan.addBridge(points, Math.max(1, Number(args.width || 2)), clampFloor(args.floor), args.style || this.getCurrentStyle());
    bridge.tags = new Set(args.tags || []);
    await this.finishPlanEdit();
    return { success: true, mutated: true, shape: bridge.toJSON() };
  }

  async defineProp(args) {
    const definition = this.propLibrary.normalizeDefinition(args);
    this.propLibrary.registerDefinition(definition);
    this.updateTileView();
    this.scheduleAutosave('define prop');
    return {
      success: true,
      mutated: true,
      prop: definition,
      propTypes: this.propLibrary.propTypes,
    };
  }

  async addStair(args) {
    const floor = Math.min(2, clampFloor(args.floor));
    const direction = ['PX', 'NX', 'PZ', 'NZ'].includes(args.direction) ? args.direction : 'PX';
    const length = Math.max(1, Number(args.length || 4));
    const width = Math.max(1, Number(args.width || 2));
    const landingRequirement = getStairLandingRequirement({ x: Number(args.x), z: Number(args.z), floor, direction, length, width });
    const clearance = validateStairPlacement({ grid: this.grid, x: Number(args.x), z: Number(args.z), floor, direction, length, width });
    if (!clearance.valid) {
      return {
        success: false,
        error: 'Unsafe stair placement. Enlarge or add rooms first so the stair run, upper stairwell cutout, bottom landing, upper-floor headroom above the bottom landing, and top landing are all inside walkable floor.',
        missingClearance: clearance.missing,
        landingRequirement,
      };
    }
    const stair = this.plan.addStair(
      {
        x: Number(args.x),
        z: Number(args.z),
        direction,
        length,
        width,
      },
      floor,
      args.style || this.getCurrentStyle()
    );
    stair.tags = new Set(args.tags || []);
    await this.finishPlanEdit();
    return {
      success: true,
      mutated: true,
      shape: stair.toJSON(),
      landingRequirement,
    };
  }

  async addProp(args) {
    const propId = this.propLibrary.normalizeType(args.prop);
    const floor = clampFloor(args.floor);
    const x = Number(args.x);
    const z = Number(args.z);
    const direction = normalizeDirection(args.direction || this.propPlacement.inferDirection(propId, floor, x, z));
    this.propPlacement.removePropsAtCell(floor, x, z);
    const prop = this.plan.addProp(
      {
        x,
        z,
        prop: propId,
        direction,
      },
      floor,
      args.style || this.getCurrentStyle()
    );
    await this.finishPlanEdit();
    return { success: true, mutated: true, replaced: true, shape: prop.toJSON() };
  }

  async decorateRoom(args) {
    const created = [];
    const floor = clampFloor(args.floor);
    for (const placement of args.placements || []) {
      const propId = this.propLibrary.normalizeType(placement.prop);
      const x = Number(placement.x);
      const z = Number(placement.z);
      const direction = normalizeDirection(placement.direction || this.propPlacement.inferDirection(propId, floor, x, z));
      this.propPlacement.removePropsAtCell(floor, x, z);
      const prop = this.plan.addProp(
        {
          x,
          z,
          prop: propId,
          direction,
        },
        floor,
        args.style || this.getCurrentStyle()
      );
      const tags = ['decorated'];
      if (args.roomId) tags.push(`room:${args.roomId}`);
      if (args.theme) tags.push(`theme:${String(args.theme).slice(0, 32)}`);
      prop.tags = new Set(tags);
      created.push(prop.toJSON());
    }
    await this.finishPlanEdit();
    return { success: true, mutated: true, shapes: created };
  }

  finishPlanEdit() {
    this.clearSelection();
    this.updatePlanView();
    this.markNeedsCameraFit();
    this.scheduleAutosave('tool edit');
    return this.rebuild();
  }

  async applyLocalPlan(prompt) {
    const result = planLevelFromPrompt(prompt, {
      style: this.getCurrentStyle(),
      stories: Math.max(1, this.getCurrentFloor() + 1),
    });
    this.setCurrentStyle(result.options.style);
    await this.loadPlanJSON(result.level, { autosave: true });
    this.appendMessage('agent', result.message);
    this.ui.agentPrompt.value = '';
  }

  appendMessage(kind, text) {
    const message = document.createElement('div');
    message.className = `agent-message ${kind}`;
    message.textContent = text;
    this.ui.agentTranscript.appendChild(message);
    this.ui.agentTranscript.scrollTop = this.ui.agentTranscript.scrollHeight;
  }

  appendStatus(text) {
    const last = this.ui.agentTranscript.lastElementChild;
    if (last?.classList.contains('status')) {
      last.textContent = text;
      return;
    }
    const message = document.createElement('div');
    message.className = 'agent-message agent status';
    message.textContent = text;
    this.ui.agentTranscript.appendChild(message);
    this.ui.agentTranscript.scrollTop = this.ui.agentTranscript.scrollHeight;
  }
}

function createLevelCodexSystemPrompt() {
  return `You are editing a browser-based modular western level live through safe level tools.
Use get_level_summary first unless the user asks for a tiny direct edit.
Use tools to mutate the level. Do not ask the user to paste JSON.
For multi-story buildings, create authored rooms on each floor and add stair shapes between floor pairs.
Coordinate system: X is east/west, Z is north/south, floor is vertical grid level. Floors are 0 through 3.
Keep coordinates between -18 and 18 so the level stays inside the grid.
Default to compact room sizes first: most rooms should be about 4x4 to 7x6 cells unless the user asks for a large building, grand hall, hotel, or warehouse.
When placing stairs, plan the full footprint before calling add_stair: the lower stair run, the matching upper stairwell cutout, one same-width clear landing row before the first tread on the lower floor, an open upper-floor headroom cutout above that bottom landing row, and one same-width clear landing row after the last tread on the upper floor. The rooms on both floors must be large enough to include that full footprint. The add_stair tool rejects unsafe placements, so enlarge/add the rooms first if it reports missing clearance. Do not put a stair start or end directly against a wall, exterior edge, prop, doorway, or narrow corridor.
Decorate rooms deliberately with add_prop or decorate_room. Put wall props such as bars, shelves, beds, pianos, crates, lanterns, and posters near walls and face them into the room. Put tables, rugs, and stools in open centers. Leave doorways, stair landings, and corridors clear.
You may create new one-tile props with define_prop when the existing prop list is missing something. Keep custom props simple and readable: compose them from boxes within x/z -0.5..0.5 and y 0..1.5. Use placement "wall" for props that should sit against a wall, like the built-in gunRack.
For add_prop and decorate_room, direction means the wall/back side of the prop, not the direction a person faces. If a bar, shelf, or gun rack is against the north wall, use direction NZ. If unsure, omit direction and the tool will auto-detect the nearest wall. Placing a prop on an occupied prop cell replaces the existing authored prop.
Supported shape types:
- room: polygon room, usually rectangles.
- corridor: linear interior connection.
- bridgePath: exterior boardwalk, balcony, or elevated path.
- stair: run from floor N to N+1 with direction PX, NX, PZ, or NZ.
- prop: persistent authored decoration, placed on existing walkable floor.
Prefer western style unless the user asks otherwise.
After making edits, respond with a concise summary.`;
}

function requirePoints(points) {
  if (!Array.isArray(points) || points.length < 2) throw new Error('points must contain at least two {x,z} objects');
  return points.map((point) => ({ x: Number(point.x), z: Number(point.z) }));
}
