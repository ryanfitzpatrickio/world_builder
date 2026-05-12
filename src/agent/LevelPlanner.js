const DIRECTIONS = new Set(['PX', 'NX', 'PZ', 'NZ']);

export function planLevelFromPrompt(prompt, defaults = {}) {
  const options = resolveLevelOptions({
    preset: defaults.preset || 'saloon',
    stories: defaults.stories || 2,
    style: defaults.style || 'western',
    name: defaults.name || '',
    brief: prompt || '',
  });
  const level = createLevelPlan(options);
  return {
    level,
    options,
    message: `Applied ${options.stories}-story ${options.preset.replace('-', ' ')} layout.`,
  };
}

export function resolveLevelOptions(input = {}) {
  const options = {
    preset: input.preset || 'saloon',
    stories: Number(input.stories || 2),
    style: input.style || 'western',
    name: input.name || '',
    brief: input.brief || '',
  };
  const brief = options.brief.toLowerCase();
  const storyMatch = brief.match(/(\d+)\s*[- ]?(story|storey|floor)/);
  const wordStories = [
    ['one', 1],
    ['single', 1],
    ['two', 2],
    ['three', 3],
    ['four', 4],
  ];

  if (storyMatch) {
    options.stories = Number(storyMatch[1]);
  } else {
    for (const [word, count] of wordStories) {
      if (brief.includes(`${word} story`) || brief.includes(`${word}-story`) || brief.includes(`${word} floor`)) {
        options.stories = count;
        break;
      }
    }
  }

  if (brief.includes('hotel') || brief.includes('boarding') || brief.includes('inn')) options.preset = 'boarding-house';
  if (brief.includes('saloon') || brief.includes('bar')) options.preset = 'saloon';
  if (brief.includes('jail') || brief.includes('sheriff')) options.preset = 'jail';
  if (brief.includes('stone')) options.style = 'stone';
  if (brief.includes('wood')) options.style = 'wood';
  if (brief.includes('metal')) options.style = 'metal';
  if (brief.includes('western') || brief.includes('old west')) options.style = 'western';

  options.stories = Math.max(1, Math.min(4, Math.round(options.stories || 1)));
  return options;
}

export function createLevelPlan(options = {}) {
  const resolved = resolveLevelOptions(options);
  const factories = {
    saloon: createSaloon,
    'boarding-house': createBoardingHouse,
    jail: createJail,
  };
  const factory = factories[resolved.preset] || createSaloon;
  const name = resolved.name || `${resolved.stories}-story ${resolved.preset}`;
  return {
    version: 1,
    name,
    source: {
      tool: 'level-planner',
      brief: resolved.brief,
      preset: resolved.preset,
    },
    shapes: factory(resolved),
  };
}

function room(id, floor, x1, z1, x2, z2, style, tags = []) {
  return {
    id,
    type: 'room',
    floor,
    style,
    tags,
    points: [
      { x: x1, z: z1 },
      { x: x2, z: z1 },
      { x: x2, z: z2 },
      { x: x1, z: z2 },
    ],
  };
}

function corridor(id, floor, from, to, width, style, tags = []) {
  return { id, type: 'corridor', floor, style, tags, from, to, width };
}

function bridge(id, floor, points, width, style, tags = []) {
  return { id, type: 'bridgePath', floor, style, tags, points, width };
}

function stair(id, floor, x, z, direction, length, width, style, tags = []) {
  if (!DIRECTIONS.has(direction)) throw new Error(`Unsupported stair direction ${direction}`);
  return { id, type: 'stair', floor, style, tags, x, z, direction, length, width };
}

function createSaloon({ stories, style }) {
  const shapes = [
    room('room_001', 0, -5, -4, 3, 3, style, ['saloon', 'main-floor']),
    room('room_002', 0, 3, -4, 7, 0, style, ['office']),
    room('room_003', 0, 3, 0, 7, 3, style, ['kitchen']),
    corridor('corridor_004', 0, { x: 2, z: 0 }, { x: 5, z: 0 }, 2, style, ['service-hall']),
    bridge('bridge_005', 0, [{ x: -6, z: 4 }, { x: 8, z: 4 }], 2, style, ['front-boardwalk']),
  ];

  for (let floor = 1; floor < stories; floor++) {
    const base = floor * 10;
    shapes.push(room(`room_${String(base + 1).padStart(3, '0')}`, floor, -5, -4, 2, 3, style, ['upper-hall']));
    shapes.push(room(`room_${String(base + 2).padStart(3, '0')}`, floor, 2, -4, 7, -1, style, ['lodging']));
    shapes.push(room(`room_${String(base + 3).padStart(3, '0')}`, floor, 2, 1, 7, 3, style, ['lodging']));
    shapes.push(corridor(`corridor_${String(base + 4).padStart(3, '0')}`, floor, { x: -2, z: 0 }, { x: 5, z: 0 }, 2, style, ['upper-hall']));
    shapes.push(bridge(`bridge_${String(base + 5).padStart(3, '0')}`, floor, [{ x: -6, z: 4 }, { x: 8, z: 4 }], 2, style, ['upper-balcony']));
  }

  for (let floor = 0; floor < stories - 1; floor++) {
    shapes.push(stair(`stair_${String(80 + floor).padStart(3, '0')}`, floor, -4, -3, 'PX', 4, 2, style, ['interior-stair']));
  }

  return shapes;
}

function createBoardingHouse({ stories, style }) {
  const shapes = [
    room('room_001', 0, -5, -4, 5, 4, style, ['lobby']),
    room('room_002', 0, -9, -3, -5, 3, style, ['stable-office']),
    room('room_003', 0, 5, -3, 9, 3, style, ['dining']),
    corridor('corridor_004', 0, { x: -6, z: 0 }, { x: 6, z: 0 }, 2, style, ['central-hall']),
  ];

  for (let floor = 1; floor < stories; floor++) {
    const base = floor * 10;
    shapes.push(room(`room_${String(base + 1).padStart(3, '0')}`, floor, -8, -4, -2, -1, style, ['lodging']));
    shapes.push(room(`room_${String(base + 2).padStart(3, '0')}`, floor, -8, 1, -2, 4, style, ['lodging']));
    shapes.push(room(`room_${String(base + 3).padStart(3, '0')}`, floor, 2, -4, 8, -1, style, ['lodging']));
    shapes.push(room(`room_${String(base + 4).padStart(3, '0')}`, floor, 2, 1, 8, 4, style, ['lodging']));
    shapes.push(corridor(`corridor_${String(base + 5).padStart(3, '0')}`, floor, { x: -3, z: 0 }, { x: 3, z: 0 }, 2, style, ['upper-hall']));
  }

  for (let floor = 0; floor < stories - 1; floor++) {
    shapes.push(stair(`stair_${String(80 + floor).padStart(3, '0')}`, floor, -3, -3, 'PZ', 4, 2, style, ['interior-stair']));
  }

  return shapes;
}

function createJail({ stories, style }) {
  const shapes = [
    room('room_001', 0, -6, -4, 1, 4, style, ['sheriff-office']),
    room('room_002', 0, 1, -4, 7, 4, style, ['cell-block']),
    corridor('corridor_003', 0, { x: -1, z: 0 }, { x: 5, z: 0 }, 2, style, ['secure-hall']),
  ];

  for (let floor = 1; floor < stories; floor++) {
    const base = floor * 10;
    shapes.push(room(`room_${String(base + 1).padStart(3, '0')}`, floor, -6, -4, 7, 0, style, ['records']));
    shapes.push(room(`room_${String(base + 2).padStart(3, '0')}`, floor, -6, 0, 7, 4, style, ['bunks']));
  }

  for (let floor = 0; floor < stories - 1; floor++) {
    shapes.push(stair(`stair_${String(80 + floor).padStart(3, '0')}`, floor, -5, -3, 'PX', 4, 2, style, ['interior-stair']));
  }

  return shapes;
}
