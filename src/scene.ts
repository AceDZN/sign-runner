// Three.js world. Renders the authoritative RunSim state; owns no game rules.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Level, allPaths, segmentStarts } from './levels';
import { RunSim, SegmentLayout } from './sim';
import { opLabel, signed } from './rules';
import { Runner, loader } from './runner';
import { Theme, gateTexture, tunnelLabelTexture, badgeTexture, roadTexture, wallTexture, surfaceTexture, seabedTexture } from './textures';

export const UNIT = 2.0;          // metres of altitude per 1 (more than body height, so −1 is underwater)
export const LANE_W = 3.0;        // metres between lane centres
export const SLOT_BELOW = 0.2;    // slot opening below the exact height
export const SLOT_ABOVE = 2.8;    // slot opening above it (runner is ~1.75 m)
const WALL_HALF = 3 * LANE_W / 2 + 8;
const SEABED_Y = -36 * UNIT;

export const laneX = (lane: number) => (lane - 1) * LANE_W;
export const altY = (v: number) => v * UNIT;

interface GateRow {
  group: THREE.Group;
  arches: THREE.Object3D[];
  panels: THREE.Mesh[];
  seg: number;
  row: number;
  frozenY: number | null;
  flash: number;
  chosen: number;
}

interface Tunnel {
  group: THREE.Group;
  frame: THREE.Mesh[];
  blocks: THREE.Mesh[];
  seg: number;
  pulse: number;
}

interface Burst {
  points: THREE.Points;
  vel: Float32Array;
  life: number;
  max: number;
}

const tmpV = new THREE.Vector3();

let dotTex: THREE.Texture | null = null;
function dotTexture(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x120526) },
      uMid: { value: new THREE.Color(0x6b2bff) },
      uHorizon: { value: new THREE.Color(0xff2fb3) },
      uBelow: { value: new THREE.Color(0x031a3a) },
      uUnder: { value: 0 },
      uAurora: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uBelow; uniform float uUnder; uniform float uAurora; uniform float uTime;
      varying vec3 vDir;
      void main(){
        float y = vDir.y;
        vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.18, y));
        c = mix(c, uTop, smoothstep(0.15, 0.6, y));
        if (uAurora > 0.0) {
          float band = sin(vDir.x * 9.0 + uTime * 0.3 + sin(vDir.z * 5.0 + uTime * 0.2) * 1.5) * 0.5 + 0.5;
          float h = smoothstep(0.08, 0.3, y) * (1.0 - smoothstep(0.35, 0.7, y));
          c += vec3(0.25, 1.0, 0.6) * pow(band, 3.0) * h * uAurora * 0.9;
        }
        c = mix(c, uBelow, smoothstep(0.02, -0.06, y));
        c = mix(c, uBelow, uUnder);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

function sunMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5; float r = length(p);
        if (r > 0.5) discard;
        vec3 c = mix(vec3(1.0,0.2,0.65), vec3(1.0,0.75,0.25), smoothstep(-0.45, 0.4, p.y));
        float stripes = step(0.0, sin((p.y + uTime*0.01) * 70.0) + 0.6 + p.y * 3.5);
        if (p.y < 0.1 && stripes < 0.5) discard;
        gl_FragColor = vec4(c * 1.6, 1.0);
      }`,
  });
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  bloomOn = true;

  readonly runner = new Runner();
  private theme: Theme = 'sea';
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sun: THREE.Mesh;
  private sunMat: THREE.ShaderMaterial;
  private mountains: THREE.LineSegments;
  private stars: THREE.Points;
  private surface: THREE.Mesh;
  private surfaceMat: THREE.MeshStandardMaterial;
  private seabed: THREE.Mesh;
  private seabedMat: THREE.MeshStandardMaterial;
  private road = new THREE.Group();
  private roadMat!: THREE.MeshStandardMaterial;
  private roadRails: THREE.Mesh[] = [];
  private bubbles: THREE.Points;
  private snow: THREE.Points;
  private hemi: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private runnerLight: THREE.PointLight;
  private fog = new THREE.Fog(0x2a0b4a, 40, 260);

  private levelGroup = new THREE.Group();
  private rows: GateRow[] = [];
  private tunnels: Tunnel[] = [];
  readonly ghostGroup = new THREE.Group();
  private ghostKey = '';
  private bursts: Burst[] = [];
  private shards: THREE.InstancedMesh;
  private shardState: { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Vector3; life: number }[] = [];
  private decor = new THREE.Group();
  private jellies: THREE.Object3D[] = [];
  private buoys: THREE.Object3D[] = [];
  private station: THREE.Object3D | null = null;
  private gateModel: THREE.Object3D | null = null;
  private jellyModel: THREE.Object3D | null = null;
  private buoyModel: THREE.Object3D | null = null;
  private mantaModel: THREE.Object3D | null = null;
  private mantas: THREE.Object3D[] = [];

  // presentation state
  private visLane = 1;
  private visY = 0;
  private yFrom = 0;
  private yTo = 0;
  private yT = 1;
  private yDur = 0.24;
  private camY = 3;
  private camRoll = 0;
  private shake = 0;
  private wasUnder = false;
  private crashT = -1;
  private time = 0;
  private reduced = false;
  modelsReady = { runner: false, gate: false, jelly: false, buoy: false, station: false };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x120526);

    this.skyMat = skyMaterial();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), this.skyMat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.sunMat = sunMaterial();
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), this.sunMat);
    this.scene.add(this.sun);

    this.mountains = this.buildMountains();
    this.scene.add(this.mountains);
    this.stars = this.buildStars();
    this.scene.add(this.stars);

    this.surfaceMat = new THREE.MeshStandardMaterial({
      map: surfaceTexture('sea'),
      emissiveMap: surfaceTexture('sea'),
      emissive: new THREE.Color(0x3cf2ff),
      emissiveIntensity: 0.9,
      color: 0x0a3050,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.2,
      metalness: 0.3,
    });
    (this.surfaceMat.map as THREE.Texture).repeat.set(30, 30);
    (this.surfaceMat.emissiveMap as THREE.Texture).repeat.set(30, 30);
    this.surface = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.surfaceMat);
    this.surface.rotation.x = -Math.PI / 2;
    this.surface.renderOrder = 2;
    this.scene.add(this.surface);

    this.seabedMat = new THREE.MeshStandardMaterial({ map: seabedTexture('sea'), emissiveMap: seabedTexture('sea'), emissive: 0xffffff, emissiveIntensity: 0.7, color: 0x0b2240 });
    (this.seabedMat.map as THREE.Texture).repeat.set(40, 40);
    (this.seabedMat.emissiveMap as THREE.Texture).repeat.set(40, 40);
    this.seabed = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.seabedMat);
    this.seabed.rotation.x = -Math.PI / 2;
    this.seabed.position.y = SEABED_Y;
    this.scene.add(this.seabed);

    this.hemi = new THREE.HemisphereLight(0xb08cff, 0x0b2a4a, 1.3);
    this.scene.add(this.hemi);
    this.sunLight = new THREE.DirectionalLight(0xffc6e8, 1.6);
    this.sunLight.position.set(-6, 14, 8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const sc = this.sunLight.shadow.camera;
    sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 40;
    this.scene.add(this.sunLight, this.sunLight.target);
    this.runnerLight = new THREE.PointLight(0x3cf2ff, 6, 14, 1.6);
    this.scene.add(this.runnerLight);

    this.buildRoad();
    this.scene.add(this.road);
    this.scene.add(this.runner.root);
    this.scene.add(this.levelGroup);
    this.scene.add(this.ghostGroup);
    this.scene.add(this.decor);

    this.bubbles = this.buildParticles(500, 0x9ff6ff, 0.22);
    this.snow = this.buildParticles(700, 0xffffff, 0.16);
    this.scene.add(this.bubbles, this.snow);

    const shardGeo = new THREE.TetrahedronGeometry(0.35);
    const shardMat = new THREE.MeshStandardMaterial({ color: 0xc9a6ff, emissive: 0xff2fb3, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 });
    this.shards = new THREE.InstancedMesh(shardGeo, shardMat, 60);
    this.shards.count = 0;
    this.shards.frustumCulled = false;
    this.scene.add(this.shards);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.45, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setReducedMotion(on: boolean): void { this.reduced = on; }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    // portrait phones get a wider view so all three lanes stay on screen
    this.camera.fov = w / h < 0.8 ? 76 : w / h < 1.2 ? 66 : 56;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- models
  async loadModels(base: string): Promise<void> {
    const l = loader();
    const tryLoad = async (file: string) => {
      try { return (await l.loadAsync(base + file)).scene; } catch { return null; }
    };
    const [runnerOk, gate, jelly, buoy, station, manta] = await Promise.all([
      this.runner.load(base + 'runner.glb'),
      tryLoad('gate-arch.glb'),
      tryLoad('jellyfish.glb'),
      tryLoad('buoy.glb'),
      tryLoad('polar-hut.glb'),
      tryLoad('manta.glb'),
    ]);
    this.modelsReady.runner = runnerOk;
    const norm = (o: THREE.Object3D | null, size: number, axis: 'x' | 'y' = 'y') => {
      if (!o) return null;
      const box = new THREE.Box3().setFromObject(o);
      const s = box.getSize(new THREE.Vector3());
      o.scale.setScalar(size / Math.max(0.001, axis === 'y' ? s.y : s.x));
      box.setFromObject(o);
      const c = box.getCenter(new THREE.Vector3());
      o.position.x -= c.x; o.position.z -= c.z; o.position.y -= box.min.y;
      const wrap = new THREE.Group();
      wrap.add(o);
      return wrap;
    };
    this.gateModel = norm(gate, 3.0, 'x');
    this.jellyModel = norm(jelly, 2.2);
    this.buoyModel = norm(buoy, 5.5);
    this.station = norm(station, 9, 'x');
    if (manta) manta.rotation.x = -Math.PI / 2; // exported upright; fly flat
    this.mantaModel = norm(manta, 6, 'x');
    this.modelsReady.gate = !!gate;
    this.modelsReady.jelly = !!jelly;
    this.modelsReady.buoy = !!buoy;
    this.modelsReady.station = !!station;
    this.buildDecor();
  }

  // ---------------------------------------------------------------- builders
  private buildMountains(): THREE.LineSegments {
    const geo = new THREE.PlaneGeometry(900, 90, 60, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const ridge = (Math.sin(x * 0.03) * 0.5 + Math.sin(x * 0.071 + 1.3) * 0.35 + Math.sin(x * 0.17) * 0.15 + 1) * 0.5;
      const t = (y + 45) / 90; // 0 bottom → 1 top
      const gap = Math.abs(x) < 60 ? 0.25 : 1; // lower in the middle so the sun shows
      pos.setY(i, t * ridge * 70 * gap);
      pos.setZ(i, -t * 40);
    }
    const wire = new THREE.WireframeGeometry(geo);
    const m = new THREE.LineBasicMaterial({ color: 0x9a5cff, transparent: true, opacity: 0.75, fog: false });
    return new THREE.LineSegments(wire, m);
  }

  private buildStars(): THREE.Points {
    const n = 900;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * 0.45 * Math.PI;
      p[i * 3] = Math.cos(th) * Math.cos(ph) * 600;
      p[i * 3 + 1] = Math.sin(ph) * 600 + 20;
      p[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * 600;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  }

  private buildParticles(n: number, color: number, size: number): THREE.Points {
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - 0.5) * 60;
      p[i * 3 + 1] = Math.random() * 30;
      p[i * 3 + 2] = -Math.random() * 120 + 20;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: dotTexture(), transparent: true, opacity: 0.8, depthWrite: false, alphaTest: 0.02 }));
    pts.frustumCulled = false;
    return pts;
  }

  private buildRoad(): void {
    const w = 3 * LANE_W + 1.2;
    this.roadMat = new THREE.MeshStandardMaterial({ map: roadTexture('sea'), emissiveMap: roadTexture('sea'), emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.35, metalness: 0.4, transparent: true, opacity: 0.62, depthWrite: false, color: 0x8a7ab8 });
    (this.roadMat.map as THREE.Texture).repeat.set(1, 30);
    (this.roadMat.emissiveMap as THREE.Texture).repeat.set(1, 30);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(w, 240), this.roadMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.z = -100;
    deck.receiveShadow = true;
    this.road.add(deck);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xff2fb3, emissive: 0xff2fb3, emissiveIntensity: 2.2 });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 240), railMat);
      rail.position.set(side * (w / 2 + 0.1), 0.1, -100);
      this.road.add(rail);
      this.roadRails.push(rail);
    }
  }

  private archMesh(theme: Theme): THREE.Object3D {
    if (this.gateModel) {
      const g = this.gateModel.clone(true);
      const tint = theme === 'ice' ? 0x8fd8ff : 0xff2fb3;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.emissive = new THREE.Color(tint);
        mat.emissiveIntensity = 1.3;
        if (mat.map) mat.emissiveMap = mat.map;
        m.material = mat;
      });
      return g;
    }
    const col = theme === 'ice' ? 0x8fd8ff : 0xff2fb3;
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2 });
    const g = new THREE.Group();
    const h = 2.9, w = 2.3, t = 0.14;
    const post = new THREE.BoxGeometry(t, h, t);
    const l = new THREE.Mesh(post, mat); l.position.set(-w / 2, h / 2, 0);
    const r = new THREE.Mesh(post, mat); r.position.set(w / 2, h / 2, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + t, t, t), mat); top.position.set(0, h, 0);
    const cyan = new THREE.MeshStandardMaterial({ color: 0x3cf2ff, emissive: 0x3cf2ff, emissiveIntensity: 2 });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.1), cyan); cap.position.set(0, h - 0.18, 0.02);
    g.add(l, r, top, cap);
    return g;
  }

  // ---------------------------------------------------------------- level
  buildLevel(level: Level, layout: SegmentLayout[]): void {
    this.theme = level.skin;
    this.levelGroup.clear();
    this.rows = [];
    this.tunnels = [];
    this.clearGhost();
    this.applyTheme();
    const theme = level.skin;
    const wallTex = wallTexture(theme);
    wallTex.repeat.set(6, 30);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: theme === 'ice' ? 0xcfe9ff : 0x6a55a8, emissive: theme === 'ice' ? 0x2a5a80 : 0x2a1450, emissiveIntensity: 0.6, transparent: true, opacity: 0.8, roughness: 0.3, metalness: 0.4 });
    const frameCol = theme === 'ice' ? 0xffffff : 0xff2fb3;
    const starts = segmentStarts(level);
    level.segments.forEach((seg, si) => {
      const L = layout[si];
      seg.rows.forEach((row, ri) => {
        const group = new THREE.Group();
        group.position.z = -L.rowZ[ri];
        const arches: THREE.Object3D[] = [];
        const panels: THREE.Mesh[] = [];
        row.forEach((op, lane) => {
          const arch = this.archMesh(theme);
          arch.position.x = laneX(lane);
          group.add(arch);
          arches.push(arch);
          const mat = new THREE.MeshBasicMaterial({ map: gateTexture(opLabel(op), theme), transparent: true, depthWrite: false, toneMapped: false, fog: false });
          const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.75), mat);
          panel.position.set(laneX(lane), 2.45, 0.05);
          panel.renderOrder = 5;
          group.add(panel);
          panels.push(panel);
        });
        this.levelGroup.add(group);
        this.rows.push({ group, arches, panels, seg: si, row: ri, frozenY: null, flash: 0, chosen: -1 });
      });
      // the tunnel wall: one slot at the exact height
      const h = altY(seg.tunnel);
      const group = new THREE.Group();
      group.position.z = -L.tunnelZ;
      const slotBot = h - SLOT_BELOW;
      const slotTop = h + SLOT_ABOVE;
      // the wall covers every height a wrong path can reach, plus a margin
      const finals = allPaths(starts[si], seg.rows).map((p) => p.final ?? seg.tunnel);
      const WALL_TOP = Math.max(altY(Math.max(...finals)) + 5, slotTop + 3.5);
      const WALL_BOTTOM = Math.min(altY(Math.min(...finals)) - 3, slotBot - 3.5);
      const topH = WALL_TOP - slotTop;
      const botH = slotBot - WALL_BOTTOM;
      const top = new THREE.Mesh(new THREE.BoxGeometry(WALL_HALF * 2, topH, 0.8), wallMat);
      top.position.y = slotTop + topH / 2;
      const bot = new THREE.Mesh(new THREE.BoxGeometry(WALL_HALF * 2, botH, 0.8), wallMat);
      bot.position.y = WALL_BOTTOM + botH / 2;
      group.add(top, bot);
      const fm = new THREE.MeshStandardMaterial({ color: frameCol, emissive: frameCol, emissiveIntensity: 2.5 });
      const sw = 3 * LANE_W + 0.8;
      const frame: THREE.Mesh[] = [];
      for (const [w, hh, x, y] of [
        [sw, 0.14, 0, slotTop], [sw, 0.14, 0, slotBot],
        [0.14, SLOT_ABOVE + SLOT_BELOW, -sw / 2, (slotTop + slotBot) / 2], [0.14, SLOT_ABOVE + SLOT_BELOW, sw / 2, (slotTop + slotBot) / 2],
      ] as const) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.4), fm);
        m.position.set(x, y, 0);
        group.add(m);
        frame.push(m);
      }
      const text = theme === 'ice' ? `${signed(seg.tunnel)}°C` : signed(seg.tunnel);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: tunnelLabelTexture(text, theme), transparent: true, depthWrite: false, toneMapped: false, fog: false }));
      lab.position.set(sw / 2 + 2.0, h + 1.0, 0.45);
      lab.renderOrder = 6;
      const lab2 = lab.clone();
      lab2.position.x = -(sw / 2 + 2.0);
      group.add(lab, lab2);
      this.levelGroup.add(group);
      this.tunnels.push({ group, frame, blocks: [top, bot], seg: si, pulse: 0 });
    });
    this.shardState = [];
    this.shards.count = 0;
    this.crashT = -1;
  }

  private applyTheme(): void {
    const ice = this.theme === 'ice';
    const u = this.skyMat.uniforms;
    (u.uTop.value as THREE.Color).set(ice ? 0x020a24 : 0x120526);
    (u.uMid.value as THREE.Color).set(ice ? 0x0b2f5c : 0x6b2bff);
    (u.uHorizon.value as THREE.Color).set(ice ? 0x3b8fc2 : 0xff2fb3);
    (u.uBelow.value as THREE.Color).set(ice ? 0x5aa9d6 : 0x031a3a);
    u.uAurora.value = ice ? 1 : 0;
    this.sun.visible = !ice;
    (this.mountains.material as THREE.LineBasicMaterial).color.set(ice ? 0xdff4ff : 0x9a5cff);
    for (const [mat, kind] of [[this.surfaceMat, 'surface'], [this.seabedMat, 'seabed']] as const) {
      const t = kind === 'surface' ? surfaceTexture(this.theme) : seabedTexture(this.theme);
      const rep = kind === 'surface' ? 30 : 40;
      t.repeat.set(rep, rep);
      const t2 = t.clone(); t2.needsUpdate = true;
      mat.map = t; mat.emissiveMap = t2; mat.needsUpdate = true;
    }
    this.surfaceMat.emissive.set(ice ? 0x8fd8ff : 0x3cf2ff);
    this.surfaceMat.emissiveIntensity = ice ? 0.35 : 0.9;
    this.surfaceMat.color.set(ice ? 0xe6f6ff : 0x0a3050);
    this.surfaceMat.opacity = ice ? 0.93 : 0.86;
    const rt = roadTexture(this.theme); rt.repeat.set(1, 30);
    const rt2 = rt.clone(); rt2.needsUpdate = true;
    this.roadMat.map = rt; this.roadMat.emissiveMap = rt2; this.roadMat.needsUpdate = true;
    for (const r of this.roadRails) {
      const m = r.material as THREE.MeshStandardMaterial;
      m.color.set(ice ? 0x8fd8ff : 0xff2fb3); m.emissive.set(ice ? 0x8fd8ff : 0xff2fb3);
    }
    this.snow.visible = ice;
    for (const j of this.jellies) j.visible = !ice;
    for (const b of this.buoys) b.visible = !ice;
    if (this.station) this.station.visible = ice;
  }

  private buildDecor(): void {
    this.decor.clear();
    this.jellies = [];
    this.buoys = [];
    // jellyfish swarm below the waterline
    for (let i = 0; i < 14; i++) {
      let j: THREE.Object3D;
      if (this.jellyModel) {
        j = SkeletonUtils.clone(this.jellyModel);
        const tint = [0xff6fd0, 0x7dff9a, 0x3cf2ff][i % 3];
        j.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          mat.transparent = true; mat.opacity = 0.72; mat.depthWrite = false;
          mat.emissive = new THREE.Color(tint); mat.emissiveIntensity = 0.9;
          if (mat.map) mat.emissiveMap = mat.map;
          m.material = mat;
        });
      } else {
        j = new THREE.Group();
        const col = [0xff6fd0, 0x7dff9a, 0x3cf2ff][i % 3];
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, transparent: true, opacity: 0.6 }));
        bell.position.y = 1.6;
        j.add(bell);
        for (let k = 0; k < 6; k++) {
          const ten = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, 1.6, 4), bell.material);
          ten.position.set(Math.cos(k) * 0.5, 0.8, Math.sin(k) * 0.5);
          j.add(ten);
        }
      }
      const side = i % 2 ? 1 : -1;
      j.userData = { side, rel: ((i * 5) % 15) - 9, x: side * (9 + (i * 5) % 14), z: -i * 16, phase: i * 1.7, scale: 0.8 + (i % 4) * 0.25 };
      j.scale.setScalar(j.userData.scale);
      this.decor.add(j);
      this.jellies.push(j);
    }
    // lighthouse buoys at zero
    for (let i = 0; i < 4; i++) {
      let b: THREE.Object3D;
      if (this.buoyModel) b = this.buoyModel.clone(true);
      else {
        b = new THREE.Group();
        const red = new THREE.MeshStandardMaterial({ color: 0xd8203a, roughness: 0.5 });
        const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.8, 16), red); base.position.y = 0.2;
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 12), white); tower.position.y = 2;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.8, 12), red); band.position.y = 2.2;
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd36b, emissiveIntensity: 3 }));
        lamp.position.y = 3.9;
        b.add(base, tower, band, lamp);
      }
      b.userData = { side: i % 2 ? -1 : 1, z: -i * 70 - 30 };
      this.decor.add(b);
      this.buoys.push(b);
    }
    this.mantas = [];
    if (this.mantaModel) {
      for (let i = 0; i < 5; i++) {
        const m = this.mantaModel.clone(true);
        m.traverse((o) => {
          const mm = o as THREE.Mesh;
          if (!mm.isMesh) return;
          const mat = (mm.material as THREE.MeshStandardMaterial).clone();
          mat.emissive = new THREE.Color(0xff6fd0); mat.emissiveIntensity = 1.1;
          if (mat.map) mat.emissiveMap = mat.map;
          mm.material = mat;
        });
        m.userData = { side: i % 2 ? 1 : -1, rel: 12 + (i * 7) % 14, x: 26 + (i * 9) % 24, z: -60 - i * 55, phase: i * 2.1 };
        this.decor.add(m);
        this.mantas.push(m);
      }
    }
    if (this.station) {
      this.station.position.set(17, 0, -60);
      this.station.rotation.y = -0.6;
      this.decor.add(this.station);
    }
    this.applyTheme();
  }

  // ---------------------------------------------------------------- events
  onGate(seg: number, row: number, lane: number, from: number, to: number): void {
    const r = this.rows.find((x) => x.seg === seg && x.row === row);
    if (r) { r.flash = 1; r.chosen = lane; r.frozenY = this.visY; }
    this.yFrom = this.visY;
    this.yTo = altY(to);
    this.yT = 0;
    this.yDur = Math.min(0.5, 0.2 + Math.abs(to - from) * 0.018);
    this.runner.setPose(to > from ? 'rise' : to < from ? 'dive' : 'run');
    this.spawnBurst(new THREE.Vector3(laneX(lane), this.visY + 1.6, this.runner.root.position.z - 0.5), to >= from ? 0xffb347 : 0x3cf2ff, 40);
  }

  onPass(seg: number): void {
    const t = this.tunnels.find((x) => x.seg === seg);
    if (t) t.pulse = 1;
    this.spawnBurst(this.runner.root.position.clone().add(new THREE.Vector3(0, 1.2, -1)), 0xffffff, 70);
    this.runner.setPose('run');
  }

  onCrash(seg: number): void {
    this.crashT = 0;
    this.shake = this.reduced ? 0.15 : 1;
    this.runner.setPose('crash');
    const t = this.tunnels.find((x) => x.seg === seg);
    const z = t ? t.group.position.z + 0.6 : this.runner.root.position.z;
    this.shardState = [];
    for (let i = 0; i < 60; i++) {
      this.shardState.push({
        p: new THREE.Vector3(this.runner.root.position.x + (Math.random() - 0.5) * 3, this.visY + Math.random() * 2.4, z),
        v: new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 7 + 1, Math.random() * 9 + 2),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        life: 2.2,
      });
    }
    this.shards.count = 60;
  }

  onRespawn(value: number): void {
    this.crashT = -1;
    this.visY = this.yFrom = this.yTo = altY(value);
    this.yT = 1;
    this.visLane = 1;
    this.runner.setPose('run');
    for (const r of this.rows) { r.frozenY = null; r.flash = 0; r.chosen = -1; }
    this.spawnBurst(new THREE.Vector3(0, this.visY + 1, this.runner.root.position.z), 0x7dff9a, 50);
  }

  onDone(): void { this.runner.setPose('cheer'); }

  private spawnBurst(at: THREE.Vector3, color: number, n: number): void {
    if (this.reduced) n = Math.floor(n / 3);
    const p = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = at.x; p[i * 3 + 1] = at.y; p[i * 3 + 2] = at.z;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = 3 + Math.random() * 6;
      vel[i * 3] = Math.cos(a) * Math.cos(b) * s; vel[i * 3 + 1] = Math.sin(b) * s + 2; vel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.3, map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.bursts.push({ points: pts, vel, life: 0.8, max: 0.8 });
  }

  // ---------------------------------------------------------------- ghost
  private clearGhost(): void {
    for (const c of this.ghostGroup.children) {
      c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { (m.material as THREE.MeshBasicMaterial).map?.dispose(); (m.material as THREE.Material).dispose(); } });
    }
    this.ghostGroup.clear();
    this.ghostKey = '';
  }

  private showGhost(sim: RunSim, preview: number[] | null): void {
    if (!preview) { if (this.ghostKey) this.clearGhost(); return; }
    const key = `${sim.seg}:${sim.row}:${sim.attempt}`;
    if (key === this.ghostKey) return;
    this.clearGhost();
    this.ghostKey = key;
    const L = sim.layout[sim.seg];
    const lastRow = sim.row === sim.segment.rows.length - 1;
    const z = -(lastRow ? L.tunnelZ - 1.5 : L.rowZ[sim.row + 1] + 1);
    preview.forEach((v, lane) => {
      const good = lastRow && v === sim.segment.tunnel;
      const col = good ? 0x7dff9a : 0x9fd8ff;
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, depthWrite: false, depthTest: false, fog: false }));
      body.renderOrder = 20;
      body.position.set(laneX(lane), altY(v) + 0.9, z);
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: badgeTexture(sim.level.skin === 'ice' ? `${signed(v)}°` : signed(v), good), transparent: true, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
      badge.renderOrder = 21;
      badge.position.set(laneX(lane), altY(v) + 0.9, z + 0.05);
      this.ghostGroup.add(body, badge);
    });
  }

  // ---------------------------------------------------------------- frame
  /** Advance presentation by `dt` (seconds, already paused-aware) and draw. */
  update(dt: number, sim: RunSim, ghost: number[] | null, render = true): void {
    this.time += dt;
    const slow = this.crashT >= 0 && this.crashT < 0.7 && !this.reduced ? 0.3 : 1;
    const pdt = dt * slow;
    if (this.crashT >= 0) this.crashT += dt;

    // runner position from the sim
    this.visLane += (sim.lane - this.visLane) * Math.min(1, dt * 16);
    if (this.yT < 1) {
      this.yT = Math.min(1, this.yT + dt / this.yDur);
      const e = 1 - Math.pow(1 - this.yT, 3);
      this.visY = this.yFrom + (this.yTo - this.yFrom) * e;
    } else {
      this.visY = this.yTo = altY(sim.value);
    }
    const crashBack = this.crashT >= 0 ? Math.min(1, this.crashT * 3) * 1.6 : 0;
    const rz = -sim.z + crashBack;
    this.runner.root.position.set(laneX(this.visLane), this.visY, rz);
    const laneLean = (sim.lane - this.visLane) * -0.35;
    const vertical = this.yT < 1 ? Math.sign(this.yTo - this.yFrom) * (1 - this.yT) * 0.6 : 0;
    this.runner.setLean(this.crashT >= 0 ? Math.min(1.1, this.crashT * 2) : -vertical * 0.5, laneLean);
    this.runner.update(pdt, sim.phase === 'done' ? 1 : 1.2);

    // road follows the runner's altitude
    this.road.position.set(0, this.visY, rz);
    const roadOffset = (sim.z / 8) % 1;
    for (const t of [this.roadMat.map, this.roadMat.emissiveMap]) if (t) t.offset.y = roadOffset;

    // gates ride at your altitude until you pass them
    for (const r of this.rows) {
      r.group.position.y = r.frozenY ?? this.visY;
      const near = Math.abs(r.group.position.z - rz) < 140;
      r.group.visible = near;
      if (r.flash > 0) {
        r.flash = Math.max(0, r.flash - pdt * 2);
        r.panels.forEach((p, i) => {
          const m = p.material as THREE.MeshBasicMaterial;
          m.opacity = i === r.chosen ? 1 : 0.35 + 0.65 * (1 - r.flash);
          p.scale.setScalar(i === r.chosen ? 1 + r.flash * 0.25 : 1);
        });
      } else if (r.chosen < 0) {
        r.panels.forEach((p) => { p.scale.setScalar(1); (p.material as THREE.MeshBasicMaterial).opacity = 1; });
      }
    }
    for (const t of this.tunnels) {
      t.group.visible = Math.abs(t.group.position.z - rz) < 260;
      const isNext = t.seg === sim.seg;
      const pulse = isNext ? 1.3 + Math.sin(this.time * 6) * 0.5 : 0.9;
      if (t.pulse > 0) t.pulse = Math.max(0, t.pulse - pdt * 1.5);
      for (const f of t.frame) (f.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse + t.pulse * 1.2;
      const behind = t.group.position.z > rz + 0.4 && this.crashT < 0;
      for (const b of t.blocks) b.visible = !behind;
    }

    this.showGhost(sim, ghost);
    // ghosts keep a readable size on screen however far ahead they are
    for (const c of this.ghostGroup.children) c.scale.setScalar(Math.max(1, Math.abs(c.position.z - rz) / 13));

    // camera: behind and above, looking ahead and a little toward the next tunnel slot
    const under = this.camera.position.y < 0;
    const tunnelY = altY(sim.segment.tunnel);
    const camLift = this.visY < -0.01 ? Math.min(3.5, Math.max(1.5, -0.45 - this.visY)) : 3.5;
    this.camY += (this.visY + camLift - this.camY) * Math.min(1, dt * 6);
    const cx = laneX(this.visLane) * 0.55;
    this.camera.position.set(cx, this.camY, rz + 5.8 + (this.crashT >= 0 ? 1.5 : 0));
    const lookY = this.visY + 1.5 + THREE.MathUtils.clamp(tunnelY - this.visY, -6, 6) * 0.22;
    this.camera.lookAt(cx * 0.6, lookY, rz - 22);
    if (under !== this.wasUnder) {
      this.wasUnder = under;
      this.camRoll = this.reduced ? 0 : (under ? 0.09 : -0.09);
      this.spawnBurst(new THREE.Vector3(this.runner.root.position.x, 0, rz), 0xbff8ff, 60);
    }
    this.camRoll *= Math.pow(0.04, dt);
    this.shake *= Math.pow(0.02, dt);
    this.camera.rotateZ(this.camRoll);
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.6;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
    }

    // world that follows the camera
    const cz = this.camera.position.z;
    this.sky.position.copy(this.camera.position);
    this.stars.position.set(this.camera.position.x, 0, cz);
    this.sun.position.set(0, 55, cz - 520);
    this.mountains.position.set(0, 0, cz - 380);
    this.surface.position.set(0, -0.08, cz - 300);
    this.seabed.position.set(0, SEABED_Y, cz - 300);
    for (const m of [this.surfaceMat, this.seabedMat]) {
      if (m.map) m.map.offset.set((this.time * 0.004) % 1, (-cz / 46.6) % 1);
      if (m.emissiveMap) m.emissiveMap.offset.copy(m.map!.offset);
    }
    this.skyMat.uniforms.uTime.value = this.time;
    this.sunMat.uniforms.uTime.value = this.time;
    this.sunLight.position.set(this.runner.root.position.x - 6, this.visY + 14, rz + 8);
    this.sunLight.target.position.copy(this.runner.root.position);
    this.runnerLight.position.set(this.runner.root.position.x, this.visY + 2.2, rz + 1.5);

    // medium: sky above zero, sea (or ice) below
    const k = THREE.MathUtils.smoothstep(-this.camera.position.y, -0.6, 0.6);
    const ice = this.theme === 'ice';
    const above = new THREE.Color(ice ? 0x123a66 : 0x2a0b4a);
    const below = new THREE.Color(ice ? 0x174a78 : 0x07506e);
    this.fog.color.copy(above).lerp(below, k);
    this.fog.near = THREE.MathUtils.lerp(ice ? 30 : 40, 12, k);
    this.fog.far = THREE.MathUtils.lerp(ice ? 220 : 260, ice ? 130 : 125, k);
    this.skyMat.uniforms.uUnder.value = k;
    (this.scene.background as THREE.Color).copy(this.fog.color);
    this.hemi.color.set(ice ? 0xdff4ff : 0xb08cff).lerp(new THREE.Color(ice ? 0xbfe6ff : 0x5ff6ff), k);
    this.hemi.intensity = 1.3 + k * 0.9;
    this.runnerLight.color.set(k > 0.5 ? 0x7dff9a : 0x3cf2ff);
    this.stars.visible = k < 0.5;
    this.mountains.visible = k < 0.5;
    this.sun.visible = !ice && k < 0.5;

    this.updateParticles(pdt, k);
    this.updateDecor(pdt, cz);
    this.updateShards(pdt);
    this.updateBursts(pdt);

    if (render) {
      if (this.bloomOn) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
    }
  }

  private updateParticles(dt: number, under: number): void {
    const cz = this.camera.position.z;
    const cy = this.camera.position.y;
    this.bubbles.visible = under > 0.3 && this.theme === 'sea';
    if (this.bubbles.visible) {
      const p = this.bubbles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * (1 + (i % 5) * 0.4);
        let z = p.getZ(i);
        if (y > 0 || y < cy - 25) y = cy - 20 + Math.random() * 18;
        if (y > -0.2) y = cy - 15;
        if (z > cz + 10) z -= 130;
        if (z < cz - 120) z += 130;
        p.setY(i, Math.min(-0.2, y));
        p.setZ(i, z);
      }
      p.needsUpdate = true;
    }
    if (this.snow.visible) {
      const p = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * (2 + (i % 4));
        let z = p.getZ(i);
        if (y < Math.max(0, cy - 12)) y = cy + 14 + Math.random() * 6;
        if (z > cz + 10) z -= 130;
        if (z < cz - 120) z += 130;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(this.time + i) * dt * 0.5);
        p.setZ(i, z);
      }
      p.needsUpdate = true;
    }
  }

  private updateDecor(dt: number, cz: number): void {
    for (const j of this.jellies) {
      const u = j.userData;
      while (u.z > cz + 20) u.z -= 230;
      while (u.z < cz - 210) u.z += 230;
      const baseY = Math.min(-2.5, this.camera.position.y + u.rel);
      j.position.set(u.x + Math.sin(this.time * 0.4 + u.phase) * 1.5, baseY + Math.sin(this.time * 0.9 + u.phase) * 1.2, u.z);
      const s = u.scale * (1 + Math.sin(this.time * 2.2 + u.phase) * 0.08);
      j.scale.set(s, u.scale * (1 - Math.sin(this.time * 2.2 + u.phase) * 0.1), s);
      j.rotation.y += dt * 0.3;
    }
    for (const m of this.mantas) {
      const u = m.userData;
      while (u.z > cz + 30) u.z -= 280;
      u.z += dt * 4;
      const baseY = Math.max(6, this.camera.position.y + u.rel);
      m.position.set(u.side * u.x + Math.sin(this.time * 0.3 + u.phase) * 3, baseY + Math.sin(this.time * 0.8 + u.phase) * 1.5, u.z);
      m.rotation.z = Math.sin(this.time * 0.8 + u.phase) * 0.25 * u.side;
      m.visible = this.theme === 'sea' && this.camera.position.y > 0;
    }
    for (const b of this.buoys) {
      const u = b.userData;
      while (u.z > cz + 20) u.z -= 280;
      b.position.set(u.side * (3 * LANE_W / 2 + 6), Math.sin(this.time * 1.3 + u.z) * 0.15 - 0.6, u.z);
      b.rotation.z = Math.sin(this.time * 0.9 + u.z) * 0.05;
    }
    if (this.station) {
      while (this.station.position.z > cz + 30) this.station.position.z -= 320;
    }
  }

  private updateShards(dt: number): void {
    if (!this.shardState.length) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let alive = 0;
    for (const s of this.shardState) {
      s.life -= dt;
      if (s.life <= 0) continue;
      s.v.y -= 9 * dt;
      s.p.addScaledVector(s.v, dt);
      e.set(s.r.x * s.life, s.r.y * s.life, s.r.z * s.life);
      q.setFromEuler(e);
      m.compose(s.p, q, tmpV.setScalar(Math.min(1, s.life)));
      this.shards.setMatrixAt(alive++, m);
    }
    this.shards.count = alive;
    this.shards.instanceMatrix.needsUpdate = true;
    if (!alive) this.shardState = [];
  }

  private updateBursts(dt: number): void {
    this.bursts = this.bursts.filter((b) => {
      b.life -= dt;
      const p = b.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        b.vel[i * 3 + 1] -= 6 * dt;
        p.setXYZ(i, p.getX(i) + b.vel[i * 3] * dt, p.getY(i) + b.vel[i * 3 + 1] * dt, p.getZ(i) + b.vel[i * 3 + 2] * dt);
      }
      p.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, b.life / b.max);
      if (b.life <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
  }

  /** Screen position (CSS px) of a point beside the runner, for the big readout. */
  readoutAnchor(w: number, h: number): { x: number; y: number; visible: boolean } {
    tmpV.copy(this.runner.root.position).add(new THREE.Vector3(-2.0, 1.1, 0));
    tmpV.project(this.camera);
    return { x: Math.max(70, (tmpV.x * 0.5 + 0.5) * w), y: Math.min(h - 130, (-tmpV.y * 0.5 + 0.5) * h), visible: tmpV.z < 1 };
  }

  get rendererInfo() { return this.renderer.info; }
}
