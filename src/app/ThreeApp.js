import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class ThreeApp {
  constructor({ container, onPointerDown, onPointerMove, onPointerUp }) {
    this.container = container;
    this.editorPointerId = null;
    this.cameraPointerId = null;
    this.cameraGesture = null;
    this.lastCameraPointer = new THREE.Vector2();
    this.keys = new Set();
    this.fastPan = false;
    this.cameraMode = 'orbit';
    this.freeLook = { yaw: 0, pitch: 0 };
    this.freeMoveSpeed = 5.5;
    this.freeEyeHeight = 0.95;
    this.freeCollisionRadius = 0.28;
    this.freeFloor = 0;
    this.pointerLocked = false;
    this.collisionWorld = null;
    this.lastFrameTime = performance.now();
    this.performanceStats = {
      fps: 0,
      frameMs: 0,
      frameCount: 0,
      lastFpsTime: this.lastFrameTime,
    };

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111927);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.01,
      2000
    );
    this.camera.position.set(12, 14, 18);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.update();

    this._buildWorldLighting();
    this.setLightingConfig({
      sunIntensity: 1.25,
      sunElevation: 38,
      sunAzimuth: 305,
      skyFill: 0.72,
      interiorAmbient: 0.18,
      exposure: 1.08,
    });

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.pointer = new THREE.Vector3(0, 0, 0);
    this.pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.gridPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.gridPlane.rotation.x = -Math.PI / 2;
    this.gridPlane.position.y = 0;
    this.scene.add(this.gridPlane);

    this.onPointerDown = onPointerDown;
    this.onPointerMove = onPointerMove;
    this.onPointerUp = onPointerUp;

    this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
    this.renderer.domElement.addEventListener('pointerdown', (event) => this._handlePointer(event, 'down'), { capture: true });
    this.renderer.domElement.addEventListener('pointermove', (event) => this._handlePointer(event, 'move'), { capture: true });
    this.renderer.domElement.addEventListener('pointerup', (event) => this._handlePointer(event, 'up'), { capture: true });
    this.renderer.domElement.addEventListener('pointercancel', (event) => this._handlePointer(event, 'cancel'), { capture: true });
    window.addEventListener('keydown', (event) => this._handleKey(event, true));
    window.addEventListener('keyup', (event) => this._handleKey(event, false));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    });
    document.addEventListener('mousemove', (event) => this._handlePointerLockMouseMove(event));

    window.addEventListener('resize', () => this.resize());
    this._animate();
  }

  _buildWorldLighting() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x4f89c7) },
          horizonColor: { value: new THREE.Color(0xf3b36d) },
          groundColor: { value: new THREE.Color(0x17202b) },
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 groundColor;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition).y;
            vec3 sky = mix(horizonColor, topColor, smoothstep(0.05, 0.82, h));
            vec3 color = mix(groundColor, sky, smoothstep(-0.18, 0.16, h));
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      })
    );
    sky.name = 'Western dusk sky dome';
    sky.renderOrder = -1000;
    this.scene.add(sky);

    const sun = new THREE.DirectionalLight(0xffd49a, 1.25);
    sun.name = 'Low desert sun';
    sun.position.set(-28, 34, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);

    const skyFill = new THREE.HemisphereLight(0x8fc8ff, 0x4a2d18, 0.72);
    skyFill.name = 'Sky and desert ground fill';
    this.scene.add(skyFill);

    const interiorBase = new THREE.AmbientLight(0x2c3440, 0.18);
    interiorBase.name = 'Low interior base light';
    this.scene.add(interiorBase);

    this.worldLights = {
      sky,
      sun,
      skyFill,
      interiorBase,
    };
  }

  setLightingConfig(config = {}) {
    if (!this.worldLights) return;
    const sunIntensity = config.sunIntensity ?? 1.25;
    const sunElevation = THREE.MathUtils.degToRad(config.sunElevation ?? 38);
    const sunAzimuth = THREE.MathUtils.degToRad(config.sunAzimuth ?? 305);
    const distance = 48;
    const horizontal = Math.cos(sunElevation) * distance;

    this.worldLights.sun.intensity = sunIntensity;
    this.worldLights.sun.position.set(
      Math.sin(sunAzimuth) * horizontal,
      Math.sin(sunElevation) * distance,
      Math.cos(sunAzimuth) * horizontal
    );
    this.worldLights.sun.target.position.set(0, 0, 0);
    this.scene.add(this.worldLights.sun.target);

    this.worldLights.skyFill.intensity = config.skyFill ?? 0.72;
    this.worldLights.interiorBase.intensity = config.interiorAmbient ?? 0.18;
    this.renderer.toneMappingExposure = config.exposure ?? 1.08;
    const shadowsEnabled = config.moduleShadows === true || config.roofShadows === true;
    this.renderer.shadowMap.enabled = shadowsEnabled;
    this.worldLights.sun.castShadow = shadowsEnabled;
  }

  _handlePointer(event, type) {
    const cameraOwnsPointer = this._cameraOwnsPointer(event, type);
    if (cameraOwnsPointer) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this._handleCameraPointer(event, type);
      return;
    }

    const editorOwnsPointer = this._editorOwnsPointer(event, type);
    if (editorOwnsPointer) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (type === 'down') {
        this.editorPointerId = event.pointerId;
        this.renderer.domElement.setPointerCapture?.(event.pointerId);
      }
      if (type === 'up' || type === 'cancel') {
        this.renderer.domElement.releasePointerCapture?.(event.pointerId);
        this.editorPointerId = null;
      }
    }

    this._setPointerNdcFromEvent(event);

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const objectHit = this._getSelectableObjectHit();
    const floorY = event.shiftKey ? 1 : 0;
    const worldHit = this.cameraMode === 'free' ? this._getFreeModeWorldHit() : null;
    this.pickPlane.set(new THREE.Vector3(0, 1, 0), -floorY);
    const point = new THREE.Vector3();
    const hit = worldHit ? point.copy(worldHit.point) : this.raycaster.ray.intersectPlane(this.pickPlane, point);
    if (!hit) return;

    this.pointer.copy(point);
    const payload = {
      ndc: this.mouse.clone(),
      point: this.pointer.clone(),
      floorY,
      objectHit,
      event,
      modifiers: {
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
      },
    };

    if (type === 'down' && editorOwnsPointer && this.onPointerDown) this.onPointerDown(payload);
    if (type === 'move' && (editorOwnsPointer || event.buttons === 0) && this.onPointerMove) this.onPointerMove(payload);
    if (type === 'up' && editorOwnsPointer && this.onPointerUp) this.onPointerUp(payload);
  }

  _getSelectableObjectHit() {
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const hit of hits) {
      if (hit.object?.userData?.selectableType) return hit;
    }
    return null;
  }

  _setPointerNdcFromEvent(event) {
    if (this.cameraMode === 'free') {
      this.mouse.set(0, 0);
      return;
    }
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  }

  _getFreeModeWorldHit() {
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const hit of hits) {
      if (hit.distance < 0.03) continue;
      if (!hit.object?.visible) continue;
      if (hit.object === this.gridPlane) continue;
      if (hit.object.name === 'Western dusk sky dome') continue;
      if (hit.object.parent?.name === 'Western dusk sky dome') continue;
      return hit;
    }
    return null;
  }

  _editorOwnsPointer(event, type) {
    if (type === 'cancel') return this.editorPointerId === event.pointerId;
    if (this.editorPointerId === event.pointerId) return true;
    if (type !== 'down') return false;
    if (event.button !== 0) return false;
    return !event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey;
  }

  _cameraOwnsPointer(event, type) {
    if (type === 'cancel') return this.cameraPointerId === event.pointerId;
    if (this.cameraPointerId === event.pointerId) return true;
    if (type !== 'down') return false;
    if (event.button !== 0) return false;
    if (this.cameraMode === 'free' && !this.pointerLocked) return true;
    return event.metaKey || event.ctrlKey || event.shiftKey;
  }

  _handleCameraPointer(event, type) {
    if (type === 'down') {
      if (this.cameraMode === 'free') this._requestPointerLock();
      this.cameraPointerId = event.pointerId;
      this.cameraGesture = this.cameraMode === 'free' ? (event.shiftKey ? 'freePan' : 'freeLook') : event.shiftKey ? 'pan' : 'orbit';
      this.lastCameraPointer.set(event.clientX, event.clientY);
      this.renderer.domElement.setPointerCapture?.(event.pointerId);
      this.controls.enabled = false;
      return;
    }

    if (type === 'move' && this.cameraPointerId === event.pointerId) {
      const dx = event.clientX - this.lastCameraPointer.x;
      const dy = event.clientY - this.lastCameraPointer.y;
      this.lastCameraPointer.set(event.clientX, event.clientY);
      if (this.cameraGesture === 'pan') this._panCamera(dx, dy);
      if (this.cameraGesture === 'orbit') this._orbitCamera(dx, dy);
      if (this.cameraGesture === 'freeLook') this._lookFreeCamera(dx, dy);
      if (this.cameraGesture === 'freePan') this._panFreeCamera(dx, dy);
      return;
    }

    if (type === 'up' || type === 'cancel') {
      this.renderer.domElement.releasePointerCapture?.(event.pointerId);
      this.cameraPointerId = null;
      this.cameraGesture = null;
      this.controls.enabled = this.cameraMode !== 'free';
    }
  }

  setCameraMode(mode, { floor = 0, bounds = null, requestPointerLock = false } = {}) {
    const nextMode = mode === 'free' ? 'free' : 'orbit';
    if (nextMode === this.cameraMode) {
      if (nextMode === 'free') {
        this.setFreeCameraFloor(floor);
        if (requestPointerLock) this._requestPointerLock();
      }
      return;
    }

    if (nextMode === 'free') {
      this.freeFloor = Math.max(0, Math.round(Number(floor || 0)));
      const center = bounds
        ? new THREE.Vector3((bounds.minX + bounds.maxX) / 2, this._freeEyeY(), (bounds.minZ + bounds.maxZ) / 2)
        : new THREE.Vector3(this.controls.target.x, this._freeEyeY(), this.controls.target.z);
      const direction = this.controls.target.clone().sub(this.camera.position);
      direction.y = 0;
      if (direction.lengthSq() < 0.0001) direction.set(0, 0, -1);
      direction.normalize();

      this.cameraMode = 'free';
      this.controls.enabled = false;
      this.camera.position.copy(center);
      this.camera.position.copy(this._resolveFreeCamCollision(this.camera.position));
      this.freeLook.yaw = Math.atan2(direction.x, -direction.z);
      this.freeLook.pitch = 0;
      this._applyFreeLook();
      if (requestPointerLock) this._requestPointerLock();
      return;
    }

    this.cameraMode = 'orbit';
    this._exitPointerLock();
    const direction = this._freeLookDirection();
    this.controls.target.copy(this.camera.position).add(direction.multiplyScalar(8));
    this.controls.enabled = true;
    this.controls.update();
  }

  getCameraMode() {
    return this.cameraMode;
  }

  setCollisionWorld(collisionWorld) {
    this.collisionWorld = collisionWorld || null;
  }

  setFreeCameraFloor(floor) {
    this.freeFloor = Math.max(0, Math.round(Number(floor || 0)));
    if (this.cameraMode !== 'free') return;
    this.camera.position.y = this._freeEyeY();
    this.camera.position.copy(this._resolveFreeCamCollision(this.camera.position));
    this._applyFreeLook();
  }

  _requestPointerLock() {
    if (document.pointerLockElement === this.renderer.domElement) return;
    try {
      const result = this.renderer.domElement.requestPointerLock?.();
      result?.catch?.(() => {});
    } catch (_err) {
      // Pointer lock can be denied outside a direct user gesture.
    }
  }

  _exitPointerLock() {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    try {
      document.exitPointerLock?.();
    } catch (_err) {
      // Ignore browser pointer-lock teardown failures.
    }
  }

  _handlePointerLockMouseMove(event) {
    if (this.cameraMode !== 'free' || !this.pointerLocked) return;
    if (event.shiftKey) this._panFreeCamera(event.movementX, event.movementY);
    else this._lookFreeCamera(event.movementX, event.movementY);
  }

  _orbitCamera(dx, dy) {
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= dx * 0.006;
    spherical.phi -= dy * 0.006;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.12, Math.PI - 0.12);
    offset.setFromSpherical(spherical);
    this.camera.position.copy(target).add(offset);
    this.camera.lookAt(target);
    this.controls.update();
  }

  _panCamera(dx, dy) {
    const element = this.renderer.domElement;
    const targetDistance = this.camera.position.distanceTo(this.controls.target);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const worldHeight = 2 * Math.tan(fov / 2) * targetDistance;
    const worldPerPixel = worldHeight / Math.max(1, element.clientHeight);
    const panX = -dx * worldPerPixel;
    const panY = dy * worldPerPixel;

    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());

    const pan = right.multiplyScalar(panX).add(up.multiplyScalar(panY));
    this.camera.position.add(pan);
    this.controls.target.add(pan);
    this.controls.update();
  }

  _lookFreeCamera(dx, dy) {
    this.freeLook.yaw += dx * 0.004;
    this.freeLook.pitch -= dy * 0.0035;
    this.freeLook.pitch = THREE.MathUtils.clamp(this.freeLook.pitch, -1.35, 1.25);
    this._applyFreeLook();
  }

  _panFreeCamera(dx, dy) {
    const element = this.renderer.domElement;
    const unitsPerPixel = 12 / Math.max(1, element.clientHeight);
    const right = this._freeRightVector();
    const forward = this._freeGroundForwardVector();
    const pan = right.multiplyScalar(-dx * unitsPerPixel).add(forward.multiplyScalar(dy * unitsPerPixel));
    this.camera.position.copy(this._moveFreeCameraWithCollision(pan));
    this._applyFreeLook();
  }

  _handleKey(event, pressed) {
    if (this._isTypingTarget(event.target)) return;
    if (event.key === 'Shift') {
      this.fastPan = pressed;
      return;
    }
    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'q', 'e'].includes(key)) return;
    event.preventDefault();
    if (pressed) this.keys.add(key);
    else this.keys.delete(key);
  }

  _isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === 'TEXTAREA' || target.isContentEditable) return true;
    if (tag !== 'INPUT') return false;
    return ['text', 'search', 'url', 'email', 'password', 'number'].includes(String(target.type || 'text').toLowerCase());
  }

  _updateKeyboardPan(deltaSeconds) {
    if (this.keys.size === 0) return;
    if (this.cameraMode === 'free') {
      this._updateFreeCameraMovement(deltaSeconds);
      return;
    }

    const forward = this.controls.target.clone().sub(this.camera.position);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const direction = new THREE.Vector3();

    if (this.keys.has('w')) direction.add(forward);
    if (this.keys.has('s')) direction.sub(forward);
    if (this.keys.has('d')) direction.add(right);
    if (this.keys.has('a')) direction.sub(right);
    if (direction.lengthSq() === 0) return;

    const distance = this.camera.position.distanceTo(this.controls.target);
    const speed = Math.max(3, distance * 0.55) * (this.fastPan ? 4 : 1);
    const move = direction.normalize().multiplyScalar(speed * deltaSeconds);
    this.camera.position.add(move);
    this.controls.target.add(move);
  }

  _updateFreeCameraMovement(deltaSeconds) {
    const forward = this._freeGroundForwardVector();
    const right = this._freeRightVector();
    const direction = new THREE.Vector3();

    if (this.keys.has('w')) direction.add(forward);
    if (this.keys.has('s')) direction.sub(forward);
    if (this.keys.has('d')) direction.add(right);
    if (this.keys.has('a')) direction.sub(right);
    if (direction.lengthSq() === 0) return;

    const speed = this.freeMoveSpeed * (this.fastPan ? 3 : 1);
    this.camera.position.copy(this._moveFreeCameraWithCollision(direction.normalize().multiplyScalar(speed * deltaSeconds)));
    this._applyFreeLook();
  }

  _moveFreeCameraWithCollision(move) {
    const current = this.camera.position.clone();
    const full = current.clone().add(move);
    const resolvedFull = this._resolveFreeCamPosition(full);
    if (resolvedFull) return resolvedFull;

    const xOnly = current.clone().add(new THREE.Vector3(move.x, 0, 0));
    const resolvedX = this._resolveFreeCamPosition(xOnly);
    if (resolvedX) current.copy(resolvedX);

    const zOnly = current.clone().add(new THREE.Vector3(0, 0, move.z));
    const resolvedZ = this._resolveFreeCamPosition(zOnly);
    if (resolvedZ) current.copy(resolvedZ);

    return current;
  }

  _resolveFreeCamCollision(position) {
    const resolved = this._resolveFreeCamPosition(position);
    if (resolved) return resolved;
    return this._findNearestFreeCamPosition(position) || position;
  }

  _findNearestFreeCamPosition(position) {
    const step = 0.5;
    for (let radius = step; radius <= 5; radius += step) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const candidate = position.clone();
        candidate.x += Math.cos(angle) * radius;
        candidate.z += Math.sin(angle) * radius;
        const resolved = this._resolveFreeCamPosition(candidate);
        if (resolved) return resolved;
      }
    }
    return null;
  }

  _resolveFreeCamPosition(position) {
    const ground = this._freeGroundInfoAt(position);
    if (!ground) return null;
    const resolved = position.clone();
    resolved.y = ground.y + this.freeEyeHeight;
    if (!this._isFreeCamPositionAllowed(resolved, ground)) return null;
    this.freeFloor = ground.floor;
    return resolved;
  }

  _isFreeCamPositionAllowed(position, ground = this._freeGroundInfoAt(position)) {
    if (!this.collisionWorld?.grid) return true;
    if (!ground) return false;
    const offsets = [
      [0, 0],
      [this.freeCollisionRadius, 0],
      [-this.freeCollisionRadius, 0],
      [0, this.freeCollisionRadius],
      [0, -this.freeCollisionRadius],
    ];
    return offsets.every(([dx, dz]) => {
      const cell = this.collisionWorld.grid.cellAtWorld(position.x + dx, ground.floor, position.z + dz);
      if (!cell) return false;
      return this._isAllowedFreeCamCollisionCell(cell, ground);
    });
  }

  _freeGroundInfoAt(position) {
    if (!this.collisionWorld?.grid) return { floor: this.freeFloor, y: this.freeFloor };
    const grid = this.collisionWorld.grid;
    const currentGround = this.camera.position.y - this.freeEyeHeight;
    const minFloor = Math.max(0, this.freeFloor - 1);
    const maxFloor = Math.min(grid.height - 1, this.freeFloor + 1);
    let best = null;

    for (let floor = minFloor; floor <= maxFloor; floor += 1) {
      const cell = grid.cellAtWorld(position.x, floor, position.z);
      if (!this._isWalkableFreeCamCell(cell) || this._isSolidFreeCamCell(cell)) continue;
      const y = this._freeGroundYForCell(cell, position, grid);
      const score = Math.abs(y - currentGround);
      if (!best || score < best.score) best = { floor, y, cell, score };
    }

    return best;
  }

  _freeGroundYForCell(cell, position = null, grid = null) {
    if (!cell) return this.freeFloor;
    if (cell.occupancy !== 'stair') return cell.y;
    const step = this._numberTagValue(cell.tags, 'stairStep:', 0);
    const length = Math.max(1, this._numberTagValue(cell.tags, 'stairLength:', 4));
    return cell.y + Math.min(1, (step + this._stairLocalProgress(cell, position, grid)) / length);
  }

  _stairLocalProgress(cell, position, grid) {
    if (!position || !grid) return 0.5;
    const direction = this._stringTagValue(cell.tags, 'stairDir:', 'PX');
    const minX = grid.originX + cell.x * grid.cellSize;
    const minZ = grid.originZ + cell.z * grid.cellSize;
    const maxX = minX + grid.cellSize;
    const maxZ = minZ + grid.cellSize;
    if (direction === 'NX') return clamp01((maxX - position.x) / grid.cellSize);
    if (direction === 'PZ') return clamp01((position.z - minZ) / grid.cellSize);
    if (direction === 'NZ') return clamp01((maxZ - position.z) / grid.cellSize);
    return clamp01((position.x - minX) / grid.cellSize);
  }

  _numberTagValue(tags, prefix, fallback) {
    if (!tags) return fallback;
    for (const tag of tags) {
      if (String(tag).startsWith(prefix)) {
        const value = Number(String(tag).slice(prefix.length));
        return Number.isFinite(value) ? value : fallback;
      }
    }
    return fallback;
  }

  _stringTagValue(tags, prefix, fallback) {
    if (!tags) return fallback;
    for (const tag of tags) {
      if (String(tag).startsWith(prefix)) return String(tag).slice(prefix.length) || fallback;
    }
    return fallback;
  }

  _isWalkableFreeCamCell(cell) {
    if (!cell) return false;
    return cell.occupancy === 'floor' || cell.occupancy === 'bridge' || cell.occupancy === 'stair' || cell.tags?.has('walkable');
  }

  _isSolidFreeCamCell(cell) {
    if (!cell) return true;
    if (cell.tags?.has('forcedDoor') || cell.tags?.has('variantDoor')) return false;
    if (cell.tags?.has('authoredProp') || cell.tags?.has('propCandidate')) return true;
    return cell.occupancy === 'wall' || cell.occupancy === 'support' || cell.occupancy === 'roof' || cell.occupancy === 'stairwell';
  }

  _isAllowedFreeCamCollisionCell(cell, ground) {
    if (this._isWalkableFreeCamCell(cell) && !this._isSolidFreeCamCell(cell)) return true;
    if (cell?.occupancy !== 'stairwell' || cell.y !== ground?.floor) return false;
    return ground.cell?.tags?.has('stairTopLanding') || ground.cell?.occupancy === 'stair';
  }

  _freeCollisionFloor() {
    return this.freeFloor;
  }

  _freeEyeY() {
    return this.freeFloor + this.freeEyeHeight;
  }

  _freeLookDirection() {
    const cosPitch = Math.cos(this.freeLook.pitch);
    return new THREE.Vector3(
      Math.sin(this.freeLook.yaw) * cosPitch,
      Math.sin(this.freeLook.pitch),
      -Math.cos(this.freeLook.yaw) * cosPitch
    ).normalize();
  }

  _freeGroundForwardVector() {
    const forward = new THREE.Vector3(Math.sin(this.freeLook.yaw), 0, -Math.cos(this.freeLook.yaw));
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
    return forward.normalize();
  }

  _freeRightVector() {
    return new THREE.Vector3().crossVectors(this._freeGroundForwardVector(), new THREE.Vector3(0, 1, 0)).normalize();
  }

  _applyFreeLook() {
    const target = this.camera.position.clone().add(this._freeLookDirection());
    this.camera.lookAt(target);
    this.controls.target.copy(target);
  }

  resize() {
    if (!this.container) return;
    this.camera.aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  fitToBounds(bounds) {
    if (!bounds) return;
    if (this.cameraMode === 'free') return;

    const center = new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      (bounds.minZ + bounds.maxZ) / 2
    );
    const size = new THREE.Vector3(
      Math.max(1, bounds.maxX - bounds.minX),
      Math.max(1, bounds.maxY - bounds.minY),
      Math.max(1, bounds.maxZ - bounds.minZ)
    );

    const largest = Math.max(size.x, size.z, size.y * 2);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    let distance = (largest / (2 * Math.tan(fov / 2))) * 2.1;
    const direction = new THREE.Vector3(0.72, 0.62, 0.92).normalize();

    this.controls.target.copy(center);
    this.camera.near = 0.01;
    this.camera.far = Math.max(2000, distance * 100);

    const corners = [
      new THREE.Vector3(bounds.minX, bounds.minY, bounds.minZ),
      new THREE.Vector3(bounds.minX, bounds.minY, bounds.maxZ),
      new THREE.Vector3(bounds.minX, bounds.maxY, bounds.minZ),
      new THREE.Vector3(bounds.minX, bounds.maxY, bounds.maxZ),
      new THREE.Vector3(bounds.maxX, bounds.minY, bounds.minZ),
      new THREE.Vector3(bounds.maxX, bounds.minY, bounds.maxZ),
      new THREE.Vector3(bounds.maxX, bounds.maxY, bounds.minZ),
      new THREE.Vector3(bounds.maxX, bounds.maxY, bounds.maxZ),
    ];
    const screenMargin = 0.72;

    for (let i = 0; i < 24; i++) {
      this.camera.position.copy(center).add(direction.clone().multiplyScalar(distance));
      this.camera.lookAt(center);
      this.camera.far = Math.max(2000, distance * 100);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld(true);

      const fits = corners.every((corner) => {
        const projected = corner.clone().project(this.camera);
        return Math.abs(projected.x) <= screenMargin && Math.abs(projected.y) <= screenMargin && projected.z >= -1 && projected.z <= 1;
      });
      if (fits) break;
      distance *= 1.12;
    }

    this.controls.update();
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const now = performance.now();
    const frameMs = now - this.lastFrameTime;
    const deltaSeconds = Math.min(0.05, frameMs / 1000);
    this.lastFrameTime = now;
    this._updatePerformanceStats(now, frameMs);
    this._updateKeyboardPan(deltaSeconds);
    if (this.cameraMode === 'orbit') this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _updatePerformanceStats(now, frameMs) {
    this.performanceStats.frameMs = frameMs;
    this.performanceStats.frameCount += 1;
    const elapsed = now - this.performanceStats.lastFpsTime;
    if (elapsed < 500) return;
    this.performanceStats.fps = (this.performanceStats.frameCount * 1000) / elapsed;
    this.performanceStats.frameCount = 0;
    this.performanceStats.lastFpsTime = now;
  }

  getPerformanceStats() {
    const info = this.renderer.info;
    const scene = this._collectSceneStats();
    return {
      fps: this.performanceStats.fps,
      frameMs: this.performanceStats.frameMs,
      pixelRatio: this.renderer.getPixelRatio(),
      render: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        lines: info.render.lines,
        points: info.render.points,
        frame: info.render.frame,
      },
      memory: {
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length || 0,
      },
      scene,
      shadows: {
        enabled: this.renderer.shadowMap.enabled,
        type: this._shadowMapTypeName(this.renderer.shadowMap.type),
        castingLights: scene.shadowCastingLights,
        casters: scene.shadowCasters,
        receivers: scene.shadowReceivers,
        mapSizes: scene.shadowMapSizes,
      },
      camera: {
        near: this.camera.near,
        far: this.camera.far,
      },
    };
  }

  _collectSceneStats() {
    const stats = {
      objects: 0,
      visibleObjects: 0,
      meshes: 0,
      instancedMeshes: 0,
      lines: 0,
      lights: 0,
      pointLights: 0,
      directionalLights: 0,
      hemisphereLights: 0,
      ambientLights: 0,
      shadowCastingLights: 0,
      shadowCasters: 0,
      shadowReceivers: 0,
      shadowMapSizes: [],
    };

    this.scene.traverse((object) => {
      stats.objects += 1;
      if (object.visible) stats.visibleObjects += 1;
      if (object.isMesh) stats.meshes += 1;
      if (object.isInstancedMesh) stats.instancedMeshes += 1;
      if (object.isLine || object.isLineSegments) stats.lines += 1;
      if (object.isLight) {
        stats.lights += 1;
        if (object.isPointLight) stats.pointLights += 1;
        if (object.isDirectionalLight) stats.directionalLights += 1;
        if (object.isHemisphereLight) stats.hemisphereLights += 1;
        if (object.isAmbientLight) stats.ambientLights += 1;
        if (object.castShadow) {
          stats.shadowCastingLights += 1;
          if (object.shadow?.mapSize) {
            stats.shadowMapSizes.push(`${object.shadow.mapSize.width}x${object.shadow.mapSize.height}`);
          }
        }
      }
      if (object.castShadow) stats.shadowCasters += 1;
      if (object.receiveShadow) stats.shadowReceivers += 1;
    });

    return stats;
  }

  _shadowMapTypeName(type) {
    if (type === THREE.BasicShadowMap) return 'Basic';
    if (type === THREE.PCFShadowMap) return 'PCF';
    if (type === THREE.PCFSoftShadowMap) return 'PCF Soft';
    if (type === THREE.VSMShadowMap) return 'VSM';
    return String(type);
  }

  dispose() {
    this.renderer.dispose();
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
