// The runner hero: the rigged Tripo model when present, a procedural stand-in otherwise.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type Pose = 'run' | 'rise' | 'dive' | 'crash' | 'cheer' | 'idle';

const CLIP_PATTERNS: Record<Pose, RegExp[]> = {
  run: [/run/i, /sprint/i, /jog/i, /walk/i],
  rise: [/jump/i, /leap/i, /hop/i],
  dive: [/dive/i, /fall/i, /swim/i, /jump/i],
  crash: [/stumble/i, /hit/i, /react/i, /fall/i, /knock/i, /die/i, /death/i],
  cheer: [/cheer/i, /victory/i, /celebrat/i, /dance/i, /clap/i, /win/i],
  idle: [/idle/i, /stand/i, /breath/i],
};

export function loader(): GLTFLoader {
  const l = new GLTFLoader();
  l.setMeshoptDecoder(MeshoptDecoder);
  return l;
}

export class Runner {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<Pose, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private pose: Pose = 'idle';
  private t = 0;
  private stand: THREE.Group | null = null;
  private limbs: THREE.Object3D[] = [];
  modelLoaded = false;
  clipNames: string[] = [];

  constructor() {
    this.root.add(this.body);
    this.buildStandIn();
  }

  private buildStandIn(): void {
    const g = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.5, metalness: 0.2 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x3cf2ff, emissive: 0x3cf2ff, emissiveIntensity: 1.6 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xff2fb3, emissive: 0xff2fb3, emissiveIntensity: 1.4 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98b62, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 12), suit);
    torso.position.y = 1.05;
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 24), trim);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin);
    head.position.y = 1.58;
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.06, 8, 24, Math.PI * 1.2), pink);
    visor.position.set(0, 1.6, 0);
    visor.rotation.set(0, Math.PI * 0.9, 0);
    g.add(torso, stripe, head, visor);
    const limb = (x: number, y: number, len: number, mat: THREE.Material) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, len, 4, 8), mat);
      m.position.y = -len / 2 - 0.04;
      pivot.add(m);
      g.add(pivot);
      this.limbs.push(pivot);
    };
    limb(-0.12, 0.72, 0.55, suit);
    limb(0.12, 0.72, 0.55, suit);
    limb(-0.34, 1.3, 0.45, suit);
    limb(0.34, 1.3, 0.45, suit);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2fb3, emissiveIntensity: 0.8 });
    for (const p of this.limbs.slice(0, 2)) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), shoeMat);
      shoe.position.set(0, -0.68, -0.06);
      p.add(shoe);
    }
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.stand = g;
    this.body.add(g);
  }

  /** Swap in the Tripo hero. Height is normalized to ~2.1 m (game scale), facing −z (away from camera). */
  async load(url: string): Promise<boolean> {
    try {
      const gltf = await loader().loadAsync(url);
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = 2.1 / Math.max(0.01, size.y);
      model.scale.setScalar(s);
      box.setFromObject(model);
      model.position.y -= box.min.y;
      model.rotation.y = Math.PI; // Tripo faces +z; we run toward −z
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.frustumCulled = false;
        }
      });
      if (this.stand) this.body.remove(this.stand);
      this.body.add(model);
      // clips are "in place" but `run` holds the hips forward; strip x/z root motion so crossfades don't slide
      for (const clip of gltf.animations) {
        for (const track of clip.tracks) {
          if (!/Hips\.position$/.test(track.name)) continue;
          for (let i = 0; i < track.values.length; i += 3) { track.values[i] = 0; track.values[i + 2] = 0; }
        }
      }
      this.mixer = new THREE.AnimationMixer(model);
      this.clipNames = gltf.animations.map((c) => c.name);
      for (const pose of Object.keys(CLIP_PATTERNS) as Pose[]) {
        const clip = CLIP_PATTERNS[pose].map((re) => gltf.animations.find((c) => re.test(c.name))).find(Boolean);
        if (clip) {
          const a = this.mixer.clipAction(clip);
          if (pose === 'crash' || pose === 'rise' || pose === 'dive') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
          this.actions.set(pose, a);
        }
      }
      this.modelLoaded = true;
      const p = this.pose;
      this.pose = 'idle';
      this.setPose(p === 'idle' ? 'run' : p, true);
      return true;
    } catch (err) {
      console.warn('runner model not loaded, using stand-in', err);
      return false;
    }
  }

  setPose(pose: Pose, force = false): void {
    if (pose === this.pose && !force) return;
    this.pose = pose;
    const next = this.actions.get(pose) ?? (pose === 'idle' ? null : this.actions.get('run')) ?? null;
    if (!next || !this.mixer) return;
    if (next === this.current && !force) return;
    next.reset();
    next.setEffectiveWeight(1);
    if (pose === 'run') next.timeScale = 1.25;
    next.play();
    if (this.current && this.current !== next) this.current.crossFadeTo(next, 0.15, false);
    this.current = next;
  }

  get currentPose(): Pose { return this.pose; }

  /** dt in seconds; `speed` scales the run cycle. */
  update(dt: number, speed = 1): void {
    this.t += dt * speed;
    if (this.mixer) {
      this.mixer.update(dt * (this.pose === 'run' ? speed : 1));
      // a pose that finished (jump/dive) falls back to running
      if ((this.pose === 'rise' || this.pose === 'dive') && this.current && !this.current.isRunning()) this.setPose('run');
      return;
    }
    // stand-in procedural cycle
    const k = this.t * 11;
    const swing = this.pose === 'run' ? 0.9 : this.pose === 'cheer' ? 0 : 0.3;
    const [lL, lR, aL, aR] = this.limbs;
    lL.rotation.x = Math.sin(k) * swing;
    lR.rotation.x = -Math.sin(k) * swing;
    aL.rotation.x = -Math.sin(k) * swing;
    aR.rotation.x = Math.sin(k) * swing;
    if (this.pose === 'cheer') { aL.rotation.z = -2.6; aR.rotation.z = 2.6; } else { aL.rotation.z = 0; aR.rotation.z = 0; }
    this.body.position.y = this.pose === 'run' ? Math.abs(Math.sin(k)) * 0.08 : 0;
  }

  /** Lean/tilt for diving and rising, applied on top of animation. */
  setLean(pitch: number, roll: number): void {
    this.body.rotation.x = pitch;
    this.body.rotation.z = roll;
  }
}
