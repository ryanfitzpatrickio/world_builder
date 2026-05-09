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
    this.lastFrameTime = performance.now();

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

    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const objectHit = this._getSelectableObjectHit();
    const floorY = event.shiftKey ? 1 : 0;
    this.pickPlane.set(new THREE.Vector3(0, 1, 0), -floorY);
    const point = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.pickPlane, point);
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
    return event.metaKey || event.ctrlKey || event.shiftKey;
  }

  _handleCameraPointer(event, type) {
    if (type === 'down') {
      this.cameraPointerId = event.pointerId;
      this.cameraGesture = event.shiftKey ? 'pan' : 'orbit';
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
      return;
    }

    if (type === 'up' || type === 'cancel') {
      this.renderer.domElement.releasePointerCapture?.(event.pointerId);
      this.cameraPointerId = null;
      this.cameraGesture = null;
      this.controls.enabled = true;
    }
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

  _handleKey(event, pressed) {
    if (this._isTypingTarget(event.target)) return;
    if (event.key === 'Shift') {
      this.fastPan = pressed;
      return;
    }
    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd'].includes(key)) return;
    event.preventDefault();
    if (pressed) this.keys.add(key);
    else this.keys.delete(key);
  }

  _isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
  }

  _updateKeyboardPan(deltaSeconds) {
    if (this.keys.size === 0) return;

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

  resize() {
    if (!this.container) return;
    this.camera.aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  fitToBounds(bounds) {
    if (!bounds) return;

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
    const deltaSeconds = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    this._updateKeyboardPan(deltaSeconds);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
