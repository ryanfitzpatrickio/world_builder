import * as THREE from 'three';

const HORIZONTAL_DIRS = ['PX', 'NX', 'PZ', 'NZ'];

const DIR_OFFSET = {
  PX: { x: 0.43, z: 0, rot: 0 },
  NX: { x: -0.43, z: 0, rot: 0 },
  PZ: { x: 0, z: 0.43, rot: Math.PI / 2 },
  NZ: { x: 0, z: -0.43, rot: Math.PI / 2 },
};

const DIR_DELTA = {
  PX: { x: 1, z: 0 },
  NX: { x: -1, z: 0 },
  PZ: { x: 0, z: 1 },
  NZ: { x: 0, z: -1 },
};

export class TileView {
  constructor(scene, assetRegistry) {
    this.scene = scene;
    this.assetRegistry = assetRegistry;
    this.group = new THREE.Group();
    this.group.name = 'Generated interior modules';
    this.meshes = new Map();
    this.lightHandles = new Map();
    this.lightOverrides = {};
    this.scene.add(this.group);

    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.lightHandleGeometry = new THREE.SphereGeometry(0.11, 14, 8);
    this.lightHandleMaterial = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    this.roofShadowGeometry = new THREE.BoxGeometry(1.35, 0.22, 1.35);
    this.roofShadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      colorWrite: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.defaultMaterials = this._createMaterialSet({
      floor: 0xd9d0bb,
      floorAlt: 0xcbbf9f,
      floorLine: 0x9d927c,
      wall: 0xf0eadc,
      wallTrim: 0x716b62,
      wallWood: 0x8a6845,
      glass: 0x253447,
      door: 0x5c3b24,
      bridge: 0xa29072,
      rail: 0x4b4d4a,
      support: 0x6c6962,
      rug: 0x9f3650,
      furniture: 0x3f4142,
      plant: 0x4e7d46,
      planter: 0x8c5638,
      light: 0xffd783,
    });
    this.westernMaterials = this._createMaterialSet({
      floor: 0x8b5a2b,
      floorTexture: 'westernPlanks',
      floorAlt: 0x6f4422,
      floorAltTexture: 'westernPlanksDark',
      floorLine: 0x3e2514,
      wall: 0xd0ad79,
      wallTexture: 'crackedPlaster',
      wallTrim: 0x5a371b,
      wallTrimTexture: 'darkWood',
      wallWood: 0x7a4a23,
      wallWoodTexture: 'verticalWood',
      glass: 0x1e2c35,
      door: 0x7b4b25,
      doorTexture: 'verticalWood',
      bridge: 0x8a5f35,
      bridgeTexture: 'westernPlanks',
      rail: 0x4b2d17,
      railTexture: 'darkWood',
      support: 0x593719,
      supportTexture: 'darkWood',
      rug: 0x8f2630,
      rugTexture: 'wovenCloth',
      furniture: 0x4f2f17,
      furnitureTexture: 'darkWood',
      plant: 0x6f7a37,
      planter: 0x9b5f2e,
      planterTexture: 'crateWood',
      light: 0xffb84f,
    });
    this.typeConfig = {};
    this.lightingConfig = { roofShadows: true };
    this.configMaterials = {
      floor: {
        woodPlanks: this.westernMaterials.floor,
        scuffedWood: this.westernMaterials.floorAlt,
        stonePavers: this._mat(0x777067, 0.86, 0, 'stonePavers'),
        packedDirt: this._mat(0x8c6a43, 0.94, 0, 'packedDirt'),
      },
      wall: {
        crackedPlaster: this.westernMaterials.wall,
        woodSiding: this._mat(0x7a4a23, 0.76, 0.01, 'horizontalWood'),
        redPaintedWood: this._mat(0x8a3f31, 0.82, 0.01, 'redPaintedWood'),
        brick: this._mat(0x9b5f42, 0.86, 0, 'oldBrick'),
        corrugatedMetal: this._mat(0x7f8078, 0.72, 0.14, 'corrugatedMetal'),
      },
      trim: {
        darkWood: this.westernMaterials.wallTrim,
        rawWood: this._mat(0x8a5f35, 0.74, 0.01, 'verticalWood'),
        metal: this._mat(0x30363a, 0.58, 0.18),
      },
      door: {
        saloonWood: this.westernMaterials.door,
        plainWood: this._mat(0x8a5f35, 0.74, 0.01, 'verticalWood'),
        darkMetal: this._mat(0x3f4547, 0.62, 0.18),
      },
      window: {
        woodFrame: this.westernMaterials.glass,
        smallAdobe: this._mat(0x111b22, 0.42, 0),
        wideShop: this._mat(0x253d4c, 0.28, 0.02),
      },
      roof: {
        corrugatedRust: this._mat(0x7a5b43, 0.82, 0.08),
        darkWood: this.westernMaterials.wallTrim,
        hay: this._mat(0xc49a3b, 0.96, 0),
      },
    };
    this.materials = this.defaultMaterials;
  }

  setTypeConfig(typeConfig = {}) {
    this.typeConfig = typeConfig;
  }

  setLightingConfig(lightingConfig = {}) {
    this.lightingConfig = lightingConfig;
  }

  setLightOverride(lightId, patch) {
    this.lightOverrides[lightId] = {
      ...(this.lightOverrides[lightId] || {}),
      ...patch,
    };
    const handle = this.lightHandles.get(lightId);
    if (handle) this._applyLightOverride(lightId, handle);
  }

  getLightInfo(lightId) {
    const handle = this.lightHandles.get(lightId);
    if (!handle) return null;
    return {
      id: lightId,
      cellKey: handle.cellKey,
      position: {
        x: handle.light.position.x,
        y: handle.light.position.y,
        z: handle.light.position.z,
      },
      intensity: handle.light.intensity,
      distance: handle.light.distance,
      color: `#${handle.light.color.getHexString()}`,
    };
  }

  _createMaterialSet(colors) {
    return {
      floor: this._mat(colors.floor, 0.82, 0.02, colors.floorTexture),
      floorAlt: this._mat(colors.floorAlt, 0.9, 0.02, colors.floorAltTexture),
      floorLine: this._mat(colors.floorLine, 0.95, 0, colors.floorLineTexture),
      wall: this._mat(colors.wall, 0.78, 0, colors.wallTexture),
      wallTrim: this._mat(colors.wallTrim, 0.68, 0.02, colors.wallTrimTexture),
      wallWood: this._mat(colors.wallWood, 0.72, 0.02, colors.wallWoodTexture),
      glass: this._mat(colors.glass, 0.35, 0.02, colors.glassTexture),
      door: this._mat(colors.door, 0.7, 0.02, colors.doorTexture),
      bridge: this._mat(colors.bridge, 0.85, 0.02, colors.bridgeTexture),
      rail: this._mat(colors.rail, 0.58, 0.04, colors.railTexture),
      support: this._mat(colors.support, 0.82, 0, colors.supportTexture),
      rug: this._mat(colors.rug, 0.8, 0, colors.rugTexture),
      furniture: this._mat(colors.furniture, 0.68, 0.04, colors.furnitureTexture),
      plant: this._mat(colors.plant, 0.9, 0, colors.plantTexture),
      planter: this._mat(colors.planter, 0.75, 0, colors.planterTexture),
      light: this._emissiveMat(colors.light, 0.35, 0, colors.lightTexture),
    };
  }

  _mat(color, roughness, metalness, textureKind = null) {
    const texture = textureKind ? this._makeProceduralTexture(textureKind) : null;
    return new THREE.MeshStandardMaterial({
      color,
      map: texture,
      roughness,
      metalness,
      transparent: false,
      opacity: 1,
    });
  }

  _emissiveMat(color, roughness, metalness, textureKind = null) {
    const material = this._mat(color, roughness, metalness, textureKind);
    material.emissive = new THREE.Color(color);
    material.emissiveIntensity = 1.35;
    return material;
  }

  _makeProceduralTexture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const cropInward = (inset = 4) => {
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy
        .getContext('2d')
        .drawImage(canvas, inset, inset, canvas.width - inset * 2, canvas.height - inset * 2, 0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(copy, 0, 0);
    };
    const noise = (amount = 28) => {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < image.data.length; i += 4) {
        const n = Math.floor((Math.random() - 0.5) * amount);
        image.data[i] = Math.max(0, Math.min(255, image.data[i] + n));
        image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n));
        image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n));
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    };

    if (kind === 'westernPlanks' || kind === 'westernPlanksDark') {
      ctx.fillStyle = kind === 'westernPlanks' ? '#8b5a2b' : '#6a3f20';
      ctx.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 24) {
        ctx.fillStyle = y % 48 === 0 ? 'rgba(255,220,150,0.12)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(0, y + 2, 128, 7);
        ctx.strokeStyle = 'rgba(32,18,10,0.72)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(128, y + 2);
        ctx.stroke();
      }
      for (let x = 18; x < 128; x += 34) {
        const row = Math.floor(x / 34) % 5;
        const y0 = row * 24;
        ctx.strokeStyle = 'rgba(25,14,8,0.5)';
        ctx.beginPath();
        ctx.moveTo(x, y0 + 3);
        ctx.lineTo(x + ((x / 18) % 2) * 5, Math.min(128, y0 + 22));
        ctx.stroke();
      }
      noise(20);
    } else if (kind === 'stonePavers') {
      ctx.fillStyle = '#777067';
      ctx.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 32) {
        for (let x = (y / 32) % 2 === 0 ? 0 : -18; x < 128; x += 38) {
          ctx.fillStyle = `rgb(${105 + ((x + y) % 30)}, ${100 + ((x + y) % 24)}, ${92 + ((x + y) % 22)})`;
          ctx.fillRect(x + 2, y + 2, 34, 28);
          ctx.strokeStyle = 'rgba(34,30,26,0.65)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, 34, 28);
        }
      }
      noise(18);
    } else if (kind === 'packedDirt') {
      ctx.fillStyle = '#8c6a43';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 90; i++) {
        const x = (i * 37) % 128;
        const y = (i * 61) % 128;
        const r = 1 + (i % 4);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(52,34,19,0.28)' : 'rgba(191,153,95,0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.5, r, (i % 9) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      noise(34);
    } else if (kind === 'verticalWood' || kind === 'darkWood' || kind === 'crateWood' || kind === 'horizontalWood' || kind === 'redPaintedWood') {
      ctx.fillStyle = kind === 'darkWood'
        ? '#4b2d17'
        : kind === 'crateWood'
          ? '#9b5f2e'
          : kind === 'redPaintedWood'
            ? '#8a3f31'
            : '#7b4b25';
      ctx.fillRect(0, 0, 128, 128);
      const horizontal = kind === 'horizontalWood' || kind === 'redPaintedWood';
      for (let n = 0; n < 128; n += kind === 'crateWood' ? 32 : 22) {
        ctx.strokeStyle = 'rgba(20,10,4,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(0, n);
          ctx.lineTo(128, n + 4);
        } else {
          ctx.moveTo(n, 0);
          ctx.lineTo(n + 4, 128);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,210,140,0.1)';
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(0, n + 8);
          ctx.lineTo(128, n + 11);
        } else {
          ctx.moveTo(n + 8, 0);
          ctx.lineTo(n + 11, 128);
        }
        ctx.stroke();
      }
      if (kind === 'crateWood') {
        ctx.strokeStyle = 'rgba(25,12,6,0.8)';
        ctx.lineWidth = 5;
        ctx.strokeRect(8, 8, 112, 112);
        ctx.beginPath();
        ctx.moveTo(8, 8);
        ctx.lineTo(120, 120);
        ctx.moveTo(120, 8);
        ctx.lineTo(8, 120);
        ctx.stroke();
      }
      noise(24);
    } else if (kind === 'oldBrick') {
      ctx.fillStyle = '#9b5f42';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#5d3728';
      for (let y = 0; y < 128; y += 22) {
        ctx.fillRect(0, y, 128, 3);
        const offset = (y / 22) % 2 === 0 ? 0 : 32;
        for (let x = -offset; x < 128; x += 64) ctx.fillRect(x, y, 3, 22);
      }
      noise(26);
    } else if (kind === 'corrugatedMetal') {
      ctx.fillStyle = '#7f8078';
      ctx.fillRect(0, 0, 128, 128);
      for (let x = 0; x < 128; x += 14) {
        ctx.fillStyle = x % 28 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, 0, 7, 128);
      }
      ctx.fillStyle = 'rgba(139,62,36,0.35)';
      ctx.fillRect(48, 0, 18, 128);
      ctx.fillRect(0, 82, 128, 16);
      noise(20);
    } else if (kind === 'crackedPlaster') {
      ctx.fillStyle = '#d0ad79';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = 'rgba(95,65,38,0.16)';
      ctx.fillRect(0, 72, 128, 56);
      for (let i = 0; i < 18; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        ctx.strokeStyle = 'rgba(52,35,22,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.random() * 24 - 12, y + Math.random() * 16 - 8);
        ctx.lineTo(x + Math.random() * 34 - 17, y + Math.random() * 26 - 13);
        ctx.stroke();
      }
      noise(30);
    } else if (kind === 'wovenCloth') {
      ctx.fillStyle = '#8f2630';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 128; i += 12) {
        ctx.fillStyle = i % 24 === 0 ? 'rgba(255,210,140,0.18)' : 'rgba(20,10,8,0.18)';
        ctx.fillRect(i, 0, 4, 128);
        ctx.fillRect(0, i, 128, 4);
      }
      noise(16);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);
    }

    if (['westernPlanks', 'westernPlanksDark', 'stonePavers', 'packedDirt'].includes(kind)) {
      cropInward(5);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  update(grid) {
    this.clear();
    this.lightHandles.clear();

    for (const cell of grid.getAllCells()) {
      const tileId = cell.collapsedTile || cell.fixedTile;
      if (!tileId || tileId === 'empty') continue;

      const tile = this.assetRegistry.getTile(tileId);
      const module = this._createModule(cell, tile, grid);
      if (!module) continue;

      const position = grid.getWorldPosition(cell);
      module.position.set(position.x, position.y, position.z);
      this.group.add(module);
      this.meshes.set(cell.key(), { mesh: module, tile: tileId });
    }
  }

  _createModule(cell, tile, grid) {
    const module = new THREE.Group();
    module.name = `${cell.occupancy}:${tile?.id || 'unknown'}:${cell.key()}`;
    const previousMaterials = this.materials;
    const previousCell = this._currentCell;
    const previousLightIndex = this._moduleLightIndex;
    this.materials = this._materialsFor(cell, tile);
    this._currentCell = cell;
    this._moduleLightIndex = 0;

    try {
      if (cell.occupancy === 'floor') {
        this._buildFloor(module, cell, tile);
        this._buildInvisibleRoofShadow(module);
        if (cell.tags.has('propCandidate')) this._buildProp(module, cell, tile);
        return module;
      }

      if (cell.occupancy === 'wall') {
        this._buildWall(module, cell, tile, grid);
        return module;
      }

      if (cell.occupancy === 'bridge') {
        this._buildBridge(module, cell, tile);
        return module;
      }

      if (cell.occupancy === 'support') {
        this._buildSupport(module);
        return module;
      }

      if (cell.occupancy === 'roof') {
        this._buildOpenCeilingCue(module, cell);
        return module;
      }

      this._box(module, this.materials.furniture, [0.8, 0.8, 0.8], [0, 0.4, 0]);
    } finally {
      this.materials = previousMaterials;
      this._currentCell = previousCell;
      this._moduleLightIndex = previousLightIndex;
    }
    return module;
  }

  _materialsFor(cell, tile) {
    return cell.style === 'western' || tile?.style === 'western' ? this.westernMaterials : this.defaultMaterials;
  }

  _buildFloor(module, cell, tile) {
    const checker = (cell.x + cell.z) % 2 === 0;
    const configuredFloor = this._configuredMaterial('floor', 'texture', checker ? this.materials.floor : this.materials.floorAlt);
    this._box(module, configuredFloor, [0.98, 0.08, 0.98], [0, 0.04, 0]);
    if (cell.style === 'western' || tile?.style === 'western') {
      return;
    }
    this._box(module, this.materials.floorLine, [0.018, 0.012, 0.92], [0.49, 0.092, 0]);
    this._box(module, this.materials.floorLine, [0.92, 0.012, 0.018], [0, 0.094, 0.49]);
  }

  _buildInvisibleRoofShadow(module) {
    if (this.lightingConfig.roofShadows === false) return;
    const roof = new THREE.Mesh(this.roofShadowGeometry, this.roofShadowMaterial);
    roof.position.set(0, 1.5, 0);
    roof.castShadow = true;
    roof.receiveShadow = false;
    roof.renderOrder = -20;
    module.add(roof);
  }

  _buildBridge(module, cell, tile) {
    this._box(module, this.materials.bridge, [0.98, 0.12, 0.98], [0, 0.06, 0]);
    if (cell.style === 'western' || tile?.style === 'western') {
      this._box(module, this.materials.floorLine, [0.05, 0.014, 0.9], [-0.26, 0.132, 0]);
      this._box(module, this.materials.floorLine, [0.05, 0.014, 0.9], [0, 0.132, 0]);
      this._box(module, this.materials.floorLine, [0.05, 0.014, 0.9], [0.26, 0.132, 0]);
    } else {
      this._box(module, this.materials.floorLine, [0.74, 0.014, 0.05], [0, 0.132, -0.22]);
      this._box(module, this.materials.floorLine, [0.74, 0.014, 0.05], [0, 0.132, 0.22]);
    }
    if ((cell.x + cell.z) % 5 === 0) {
      this._box(module, this.materials.rug, [0.42, 0.04, 0.24], [0, 0.17, 0]);
    }
  }

  _buildSupport(module) {
    this._box(module, this.materials.support, [0.34, 1, 0.34], [0, 0.5, 0]);
    this._box(module, this.materials.wallTrim, [0.56, 0.12, 0.56], [0, 0.08, 0]);
    this._box(module, this.materials.wallTrim, [0.5, 0.12, 0.5], [0, 0.94, 0]);
  }

  _buildOpenCeilingCue(module, cell) {
    const frequency = this.typeConfig.roof?.lightFrequency ?? 16;
    if (((cell.x * 17 + cell.z * 31) % 100) >= frequency) return;
    if (cell.style === 'western') {
      const roofMaterial = this._configuredMaterial('roof', 'texture', this.materials.wallTrim);
      this._box(module, roofMaterial, [0.06, 0.38, 0.06], [0, 0.16, 0]);
      this._box(module, this.materials.light, [0.22, 0.22, 0.22], [0, 0.4, 0]);
      this._box(module, roofMaterial, [0.34, 0.04, 0.34], [0, 0.54, 0]);
      this._box(module, roofMaterial, [0.28, 0.04, 0.28], [0, 0.28, 0]);
      this._addPointLight(module, [0, 0.42, 0], 0xff9d3b, 0.7, 4.5);
      return;
    }

    this._box(module, this.materials.light, [0.24, 0.04, 0.24], [0, 0.05, 0]);
    this._addPointLight(module, [0, 0.18, 0], 0xffc96e, 0.45, 5.2);
  }

  _buildWall(module, cell, tile, grid) {
    const dirs = this._interiorDirs(cell, grid);
    const renderDirs = dirs.length ? dirs : ['PX'];
    const isRail = cell.tags.has('railing') || tile?.tags?.has('railing') || tile?.id?.includes('railing');
    const isDoor = cell.tags.has('forcedDoor') || tile?.tags?.has('door') || tile?.id?.includes('door');
    const isWindow = cell.tags.has('variantWindow') || tile?.tags?.has('window') || tile?.id?.includes('window');

    for (const dir of renderDirs) {
      if (isRail) {
        this._buildRail(module, dir);
      } else if (isDoor) {
        this._buildDoorWall(module, dir);
      } else {
        this._buildPanelWall(module, dir, isWindow);
      }
    }

    if (renderDirs.length > 1 || cell.tags.has('corner')) {
      this._box(module, this.materials.wallTrim, [0.24, 1.55, 0.24], [0, 0.78, 0]);
    }
  }

  _buildPanelWall(module, dir, hasWindow) {
    const t = DIR_OFFSET[dir];
    const wallMaterial = this._configuredMaterial('wall', 'texture', this.materials.wall);
    const trimMaterial = this._configuredMaterial('trim', 'trim', this.materials.wallTrim);
    this._box(module, wallMaterial, [0.18, 1.3, 1.06], [t.x, 0.68, t.z], t.rot);
    this._box(module, trimMaterial, [0.24, 0.14, 1.14], [t.x, 1.36, t.z], t.rot);
    this._box(module, trimMaterial, [0.22, 1.44, 0.1], this._wallPoint(dir, 0, -0.5, 0.72), t.rot);
    this._box(module, trimMaterial, [0.22, 1.44, 0.1], this._wallPoint(dir, 0, 0.5, 0.72), t.rot);

    if (hasWindow) {
      this._box(module, this._configuredMaterial('window', 'texture', this.materials.glass), [0.18, 0.46, 0.46], this._wallPoint(dir, 0.012, 0, 0.82), t.rot);
      this._box(module, trimMaterial, [0.21, 0.06, 0.58], [t.x, 1.08, t.z], t.rot);
      this._box(module, trimMaterial, [0.21, 0.06, 0.58], [t.x, 0.56, t.z], t.rot);
    }
  }

  _buildDoorWall(module, dir) {
    const t = DIR_OFFSET[dir];
    const wallMaterial = this._configuredMaterial('wall', 'texture', this.materials.wall);
    const trimMaterial = this._configuredMaterial('trim', 'trim', this.materials.wallTrim);
    const doorMaterial = this._configuredMaterial('door', 'texture', this.materials.door);
    this._box(module, wallMaterial, [0.18, 1.25, 0.24], this._wallPoint(dir, 0, -0.43, 0.66), t.rot);
    this._box(module, wallMaterial, [0.18, 1.25, 0.24], this._wallPoint(dir, 0, 0.43, 0.66), t.rot);
    this._box(module, trimMaterial, [0.22, 0.16, 1.08], [t.x, 1.32, t.z], t.rot);
    this._box(module, doorMaterial, [0.11, 0.7, 0.18], this._wallPoint(dir, 0.018, -0.13, 0.48), t.rot);
    this._box(module, doorMaterial, [0.11, 0.7, 0.18], this._wallPoint(dir, 0.018, 0.13, 0.48), t.rot);
  }

  _buildRail(module, dir) {
    const t = DIR_OFFSET[dir];
    this._box(module, this.materials.rail, [0.12, 0.52, 1.06], [t.x, 0.38, t.z], t.rot);
    this._box(module, this.materials.wallTrim, [0.18, 0.1, 1.12], [t.x, 0.68, t.z], t.rot);
  }

  _buildProp(module, cell, tile) {
    const variant = Math.abs((cell.x * 928371 + cell.z * 1237) % 5);
    if (cell.style === 'western' || tile?.style === 'western') {
      const previousCell = this._currentPropCell;
      this._currentPropCell = cell;
      this._buildWesternProp(module, variant);
      this._currentPropCell = previousCell;
      return;
    }
    if (variant === 0) {
      this._box(module, this.materials.rug, [0.72, 0.04, 0.5], [0, 0.13, 0]);
      this._box(module, this.materials.furniture, [0.28, 0.18, 0.28], [0, 0.24, 0]);
      return;
    }
    if (variant === 1) {
      this._box(module, this.materials.furniture, [0.58, 0.16, 0.28], [0, 0.22, -0.08]);
      this._box(module, this.materials.furniture, [0.12, 0.3, 0.12], [-0.22, 0.2, 0.12]);
      this._box(module, this.materials.furniture, [0.12, 0.3, 0.12], [0.22, 0.2, 0.12]);
      return;
    }
    if (variant === 2) {
      this._box(module, this.materials.planter, [0.26, 0.22, 0.26], [0.24, 0.19, 0.24]);
      this._box(module, this.materials.plant, [0.38, 0.34, 0.38], [0.24, 0.47, 0.24]);
      return;
    }
    if (variant === 3) {
      this._box(module, this.materials.furniture, [0.48, 0.42, 0.16], [0, 0.28, 0.22]);
      this._box(module, this.materials.rug, [0.42, 0.04, 0.34], [0, 0.13, -0.12]);
      return;
    }
    this._box(module, this.materials.furniture, [0.16, 0.5, 0.16], [-0.18, 0.34, 0]);
    this._box(module, this.materials.light, [0.32, 0.06, 0.32], [-0.18, 0.62, 0]);
    this._addPointLight(module, [-0.18, 0.64, 0], 0xffc96e, 0.32, 3.1);
  }

  _buildWesternProp(module, variant) {
    this._orientProp(module);
    if (this._currentPropCell?.tags.has('propBarCounter')) {
      this._westernBarCounter(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propPokerTable')) {
      this._westernPokerTable(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propBarrelStack')) {
      this._westernBarrelStack(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propShelf')) {
      this._westernShelf(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propBedCot')) {
      this._westernBedCot(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propPiano')) {
      this._westernPiano(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propWantedPoster')) {
      this._westernWantedPoster(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propLanternStand')) {
      this._westernLanternStand(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propStoolPair')) {
      this._westernStoolPair(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propCrateStack')) {
      this._westernCrateStack(module);
      return;
    }
    if (this._currentPropCell?.tags.has('propRug')) {
      this._westernRug(module);
      return;
    }

    if (variant === 0) {
      this._box(module, this.materials.furniture, [0.82, 0.24, 0.24], [0, 0.24, -0.2]);
      this._box(module, this.materials.floorLine, [0.12, 0.34, 0.12], [-0.3, 0.22, -0.2]);
      this._box(module, this.materials.floorLine, [0.12, 0.34, 0.12], [0.3, 0.22, -0.2]);
      return;
    }
    if (variant === 1) {
      this._box(module, this.materials.furniture, [0.36, 0.18, 0.36], [0, 0.24, 0]);
      this._box(module, this.materials.furniture, [0.08, 0.26, 0.08], [-0.22, 0.2, -0.22]);
      this._box(module, this.materials.furniture, [0.08, 0.26, 0.08], [0.22, 0.2, -0.22]);
      this._box(module, this.materials.furniture, [0.08, 0.26, 0.08], [-0.22, 0.2, 0.22]);
      this._box(module, this.materials.furniture, [0.08, 0.26, 0.08], [0.22, 0.2, 0.22]);
      return;
    }
    if (variant === 2) {
      this._box(module, this.materials.planter, [0.28, 0.34, 0.28], [0.2, 0.25, 0.2]);
      this._box(module, this.materials.floorLine, [0.2, 0.06, 0.2], [0.2, 0.48, 0.2]);
      return;
    }
    if (variant === 3) {
      this._box(module, this.materials.furniture, [0.18, 0.46, 0.18], [-0.18, 0.34, 0.16]);
      this._box(module, this.materials.light, [0.34, 0.1, 0.34], [-0.18, 0.62, 0.16]);
      this._addPointLight(module, [-0.18, 0.64, 0.16], 0xff9d3b, 0.32, 3.1);
      return;
    }
    this._box(module, this.materials.rug, [0.7, 0.035, 0.42], [0, 0.13, 0]);
  }

  _orientProp(module) {
    const tags = this._currentPropCell?.tags || new Set();
    if (tags.has('propFacePX')) module.rotation.y = Math.PI;
    if (tags.has('propFaceNX')) module.rotation.y = 0;
    if (tags.has('propFacePZ')) module.rotation.y = -Math.PI / 2;
    if (tags.has('propFaceNZ')) module.rotation.y = Math.PI / 2;
  }

  _westernBarCounter(module) {
    this._box(module, this.materials.furniture, [0.88, 0.38, 0.28], [0, 0.28, -0.26]);
    this._box(module, this.materials.floorLine, [0.94, 0.08, 0.34], [0, 0.52, -0.26]);
    this._box(module, this.materials.floorLine, [0.1, 0.28, 0.1], [-0.32, 0.24, -0.02]);
    this._box(module, this.materials.floorLine, [0.1, 0.28, 0.1], [0.32, 0.24, -0.02]);
    this._box(module, this.materials.light, [0.08, 0.1, 0.08], [-0.18, 0.62, -0.22]);
    this._box(module, this.materials.light, [0.08, 0.1, 0.08], [0.06, 0.62, -0.22]);
    this._addPointLight(module, [-0.06, 0.68, -0.18], 0xff9d3b, 0.36, 3.4);
  }

  _westernPokerTable(module) {
    this._box(module, this.materials.furniture, [0.52, 0.16, 0.52], [0, 0.26, 0]);
    this._box(module, this.materials.floorLine, [0.12, 0.28, 0.12], [0, 0.18, 0]);
    this._box(module, this.materials.rug, [0.32, 0.025, 0.32], [0, 0.36, 0]);
    this._box(module, this.materials.light, [0.12, 0.08, 0.12], [0, 0.47, 0]);
    this._addPointLight(module, [0, 0.55, 0], 0xffa044, 0.28, 2.7);
    this._westernStool(module, -0.42, 0);
    this._westernStool(module, 0.42, 0);
    this._westernStool(module, 0, -0.42);
    this._westernStool(module, 0, 0.42);
  }

  _westernBarrelStack(module) {
    this._box(module, this.materials.planter, [0.28, 0.42, 0.28], [-0.16, 0.3, 0]);
    this._box(module, this.materials.floorLine, [0.34, 0.04, 0.34], [-0.16, 0.52, 0]);
    this._box(module, this.materials.floorLine, [0.34, 0.04, 0.34], [-0.16, 0.1, 0]);
    this._box(module, this.materials.planter, [0.26, 0.34, 0.26], [0.16, 0.25, 0.16]);
  }

  _westernShelf(module) {
    this._box(module, this.materials.furniture, [0.78, 0.08, 0.14], [0, 0.58, -0.34]);
    this._box(module, this.materials.furniture, [0.78, 0.08, 0.14], [0, 0.9, -0.34]);
    this._box(module, this.materials.floorLine, [0.08, 0.72, 0.12], [-0.34, 0.66, -0.34]);
    this._box(module, this.materials.floorLine, [0.08, 0.72, 0.12], [0.34, 0.66, -0.34]);
    this._box(module, this.materials.light, [0.07, 0.13, 0.07], [-0.18, 0.72, -0.25]);
    this._box(module, this.materials.light, [0.07, 0.13, 0.07], [0.12, 1.02, -0.25]);
  }

  _westernBedCot(module) {
    this._box(module, this.materials.furniture, [0.78, 0.16, 0.42], [0, 0.22, -0.12]);
    this._box(module, this.materials.rug, [0.66, 0.05, 0.34], [0, 0.33, -0.12]);
    this._box(module, this.materials.wall, [0.24, 0.1, 0.34], [-0.22, 0.4, -0.12]);
    this._box(module, this.materials.light, [0.12, 0.14, 0.12], [0.32, 0.34, 0.15]);
    this._addPointLight(module, [0.32, 0.42, 0.15], 0xff9d3b, 0.26, 2.5);
  }

  _westernPiano(module) {
    this._box(module, this.materials.furniture, [0.68, 0.42, 0.28], [0, 0.34, -0.22]);
    this._box(module, this.materials.floorLine, [0.72, 0.06, 0.34], [0, 0.58, -0.22]);
    this._box(module, this.materials.wall, [0.52, 0.04, 0.05], [0, 0.62, -0.02]);
    this._box(module, this.materials.furniture, [0.42, 0.14, 0.18], [0, 0.2, 0.22]);
  }

  _westernWantedPoster(module) {
    this._box(module, this.materials.wall, [0.36, 0.46, 0.035], [0, 0.86, -0.43]);
    this._box(module, this.materials.floorLine, [0.42, 0.04, 0.045], [0, 1.11, -0.42]);
    this._box(module, this.materials.floorLine, [0.26, 0.035, 0.045], [0, 0.82, -0.42]);
  }

  _westernLanternStand(module) {
    this._box(module, this.materials.furniture, [0.08, 0.68, 0.08], [0, 0.42, 0]);
    this._box(module, this.materials.floorLine, [0.34, 0.05, 0.34], [0, 0.12, 0]);
    this._box(module, this.materials.light, [0.22, 0.18, 0.22], [0, 0.82, 0]);
    this._addPointLight(module, [0, 0.82, 0], 0xff9d3b, 0.52, 3.8);
  }

  _westernStoolPair(module) {
    this._westernStool(module, -0.2, 0);
    this._westernStool(module, 0.2, 0.08);
  }

  _westernCrateStack(module) {
    this._box(module, this.materials.planter, [0.32, 0.26, 0.32], [-0.12, 0.22, -0.08]);
    this._box(module, this.materials.planter, [0.28, 0.24, 0.28], [0.18, 0.2, 0.16]);
    this._box(module, this.materials.planter, [0.24, 0.22, 0.24], [-0.02, 0.45, 0.02]);
    this._box(module, this.materials.floorLine, [0.36, 0.025, 0.025], [-0.12, 0.36, -0.08]);
    this._box(module, this.materials.floorLine, [0.025, 0.025, 0.36], [-0.12, 0.37, -0.08]);
  }

  _westernRug(module) {
    this._box(module, this.materials.rug, [0.76, 0.035, 0.48], [0, 0.13, 0]);
    this._box(module, this.materials.floorLine, [0.08, 0.04, 0.5], [-0.28, 0.15, 0]);
    this._box(module, this.materials.floorLine, [0.08, 0.04, 0.5], [0.28, 0.15, 0]);
  }

  _westernStool(module, x, z) {
    this._box(module, this.materials.furniture, [0.18, 0.08, 0.18], [x, 0.28, z]);
    this._box(module, this.materials.floorLine, [0.06, 0.24, 0.06], [x, 0.18, z]);
  }

  _addPointLight(group, position, color, intensity, distance) {
    if (this.typeConfig.prop?.lighting === false) return null;
    const cellKey = this._currentCell?.key?.() || 'scene';
    const lightId = `${cellKey}:light:${this._moduleLightIndex || 0}`;
    this._moduleLightIndex = (this._moduleLightIndex || 0) + 1;
    const light = new THREE.PointLight(color, intensity, distance, 2.15);
    light.position.set(position[0], position[1], position[2]);
    light.castShadow = false;
    group.add(light);
    const marker = new THREE.Mesh(this.lightHandleGeometry, this.lightHandleMaterial.clone());
    marker.position.copy(light.position);
    marker.userData.selectableType = 'light';
    marker.userData.lightId = lightId;
    marker.userData.cellKey = cellKey;
    marker.renderOrder = 80;
    group.add(marker);
    const handle = { id: lightId, cellKey, light, marker };
    this.lightHandles.set(lightId, handle);
    this._applyLightOverride(lightId, handle);
    return light;
  }

  _applyLightOverride(lightId, handle) {
    const override = this.lightOverrides[lightId];
    if (!override) return;
    if (override.position) {
      handle.light.position.set(override.position.x, override.position.y, override.position.z);
      handle.marker.position.copy(handle.light.position);
    }
    if (override.intensity !== undefined) handle.light.intensity = override.intensity;
    if (override.distance !== undefined) handle.light.distance = override.distance;
    if (override.color) {
      handle.light.color.set(override.color);
      handle.marker.material.color.set(override.color);
    }
  }

  _configuredMaterial(type, key, fallback) {
    const value = type === 'trim' ? this.typeConfig.wall?.trim : this.typeConfig[type]?.[key];
    return this.configMaterials[type]?.[value] || fallback;
  }

  _interiorDirs(cell, grid) {
    const dirs = [];
    for (const dir of HORIZONTAL_DIRS) {
      const d = DIR_DELTA[dir];
      const neighbor = grid.getCell(cell.x + d.x, cell.y, cell.z + d.z);
      if (neighbor && ['floor', 'bridge'].includes(neighbor.occupancy)) dirs.push(dir);
    }
    return dirs;
  }

  _normalOffset(dir, amount) {
    const d = DIR_DELTA[dir];
    return { x: d.x * amount, z: d.z * amount };
  }

  _wallPoint(dir, normal, side, y) {
    const base = DIR_OFFSET[dir];
    const forward = DIR_DELTA[dir];
    const right = { x: -forward.z, z: forward.x };
    return [
      base.x + forward.x * normal + right.x * side,
      y,
      base.z + forward.z * normal + right.z * side,
    ];
  }

  _box(group, material, scale, position, rotationY = 0) {
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  clear() {
    for (const { mesh } of this.meshes.values()) {
      this.group.remove(mesh);
    }
    this.meshes.clear();
    this.lightHandles.clear();
  }
}
