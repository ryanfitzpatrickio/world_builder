export const LEVEL_CODEX_TOOLS = [
  {
    name: 'get_level_summary',
    description: 'Read the current level plan, generated occupancy counts, grid limits, selected cell, and supported shape vocabulary.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'replace_plan',
    description: 'Replace the whole level plan with a complete level object containing a shapes array.',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'object', additionalProperties: true },
      },
      required: ['level'],
      additionalProperties: false,
    },
  },
  {
    name: 'clear_plan',
    description: 'Clear every authored shape from the level.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'add_room',
    description: 'Add one rectangular room to the plan.',
    inputSchema: {
      type: 'object',
      properties: {
        floor: { type: 'integer', minimum: 0, maximum: 3 },
        x1: { type: 'number' },
        z1: { type: 'number' },
        x2: { type: 'number' },
        z2: { type: 'number' },
        style: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['floor', 'x1', 'z1', 'x2', 'z2'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_corridor',
    description: 'Add one corridor segment to connect rooms on one floor.',
    inputSchema: {
      type: 'object',
      properties: {
        floor: { type: 'integer', minimum: 0, maximum: 3 },
        fromX: { type: 'number' },
        fromZ: { type: 'number' },
        toX: { type: 'number' },
        toZ: { type: 'number' },
        width: { type: 'number', minimum: 1, maximum: 8 },
        style: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['floor', 'fromX', 'fromZ', 'toX', 'toZ'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_bridge',
    description: 'Add one bridge, boardwalk, or balcony path.',
    inputSchema: {
      type: 'object',
      properties: {
        floor: { type: 'integer', minimum: 0, maximum: 3 },
        points: {
          type: 'array',
          minItems: 2,
          items: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              z: { type: 'number' },
            },
            required: ['x', 'z'],
            additionalProperties: false,
          },
        },
        width: { type: 'number', minimum: 1, maximum: 8 },
        style: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['floor', 'points'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_stair',
    description: 'Add one stair run from the given floor to the floor above. Stairs require walkable floor for the lower run, matching upper stairwell cutout, upper-floor headroom cutout above the bottom landing, and same-width one-cell landing rows before the first tread and after the last tread; unsafe placements are rejected so rooms must be enlarged first.',
    inputSchema: {
      type: 'object',
      properties: {
        floor: { type: 'integer', minimum: 0, maximum: 2 },
        x: { type: 'number' },
        z: { type: 'number' },
        direction: { type: 'string', enum: ['PX', 'NX', 'PZ', 'NZ'] },
        length: { type: 'number', minimum: 1, maximum: 12 },
        width: { type: 'number', minimum: 1, maximum: 8 },
        style: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['floor', 'x', 'z', 'direction'],
      additionalProperties: false,
    },
  },
  {
    name: 'define_prop',
    description: 'Create or update a reusable one-tile prop template. Use simple box parts inside one tile, then place it with add_prop or decorate_room.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        label: { type: 'string' },
        placement: { type: 'string', enum: ['wall', 'center'] },
        description: { type: 'string' },
        boxes: {
          type: 'array',
          minItems: 1,
          maxItems: 24,
          items: {
            type: 'object',
            properties: {
              material: { type: 'string', enum: ['furniture', 'trim', 'wall', 'door', 'metal', 'rug', 'plant', 'planter', 'light'] },
              scale: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number' } },
              position: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number' } },
              rotationY: { type: 'number' },
            },
            required: ['scale', 'position'],
            additionalProperties: false,
          },
        },
        light: {
          type: 'object',
          properties: {
            position: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number' } },
            color: { type: 'string' },
            intensity: { type: 'number' },
            distance: { type: 'number' },
          },
          additionalProperties: false,
        },
      },
      required: ['id', 'label', 'boxes'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_prop',
    description: 'Add one persistent decorative prop to a walkable floor cell.',
    inputSchema: {
      type: 'object',
      properties: {
        floor: { type: 'integer', minimum: 0, maximum: 3 },
        x: { type: 'number' },
        z: { type: 'number' },
        prop: { type: 'string' },
        direction: { type: 'string', enum: ['PX', 'NX', 'PZ', 'NZ'], description: 'For wall props, the direction of the adjacent wall/back side of the prop. Omit to auto-detect nearest wall.' },
        style: { type: 'string' },
      },
      required: ['floor', 'x', 'z', 'prop'],
      additionalProperties: false,
    },
  },
  {
    name: 'decorate_room',
    description: 'Add multiple persistent decorative props, placed intentionally for a room or area.',
    inputSchema: {
      type: 'object',
      properties: {
        floor: { type: 'integer', minimum: 0, maximum: 3 },
        roomId: { type: 'string' },
        theme: { type: 'string' },
        placements: {
          type: 'array',
          minItems: 1,
          maxItems: 24,
          items: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              z: { type: 'number' },
              prop: { type: 'string' },
              direction: { type: 'string', enum: ['PX', 'NX', 'PZ', 'NZ'], description: 'For wall props, the direction of the adjacent wall/back side of the prop. Omit to auto-detect nearest wall.' },
            },
            required: ['x', 'z', 'prop'],
            additionalProperties: false,
          },
        },
        style: { type: 'string' },
      },
      required: ['floor', 'placements'],
      additionalProperties: false,
    },
  },
];
