import gsap from 'gsap';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/** One layer of the request, as the hero draws it: a slab whose thickness is its share of the time. */
export type SceneLayer = { id: string; name: string; ms: number; slowest: boolean; reached: boolean; note: string | null };

const BOX = { w: 3.2, h: 4.6 };
const SLAB = 2.5;
const STACK_H = 3.6;
const MIN_SLAB = 0.14;
const GAP = 0.2;
const TOP_Y = BOX.h / 2 + 1.4;
const RED = new THREE.Color('#ff3b30');
const WHITE = new THREE.Color('#ffffff');
const CYAN = new THREE.Color('#22d3ee');

/** The page's own red and cyan split, plus a short tear when the signal is kicked. */
const SignalShader = {
    uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uTime: { value: 0 },
        uKick: { value: 0 },
        uSplit: { value: 0.0016 },
        uLines: { value: 600 },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uKick;
        uniform float uSplit;
        uniform float uLines;
        varying vec2 vUv;

        float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }

        void main() {
            vec2 uv = vUv;
            float row = floor(uv.y * 28.0);
            float torn = step(0.72, rand(vec2(row, floor(uTime * 24.0))));
            uv.x += (rand(vec2(row, floor(uTime * 37.0))) - 0.5) * 0.08 * uKick * torn;

            float a = uSplit + uKick * 0.01;
            float r = texture2D(tDiffuse, uv + vec2(a, 0.0)).r;
            vec2 gb = texture2D(tDiffuse, uv - vec2(a, 0.0)).gb;
            vec3 col = vec3(r, gb);
            col *= 0.9 + 0.1 * sin(vUv.y * uLines * 3.14159);

            // Transparent where nothing was drawn, so the page shows through; the faintest bloom haze is cut.
            float m = max(col.r, max(col.g, col.b));
            // Cut after sRGB encoding, where a whisper of linear glow has already become a visible grey.
            float keep = smoothstep(0.02, 0.07, m);
            col *= keep;
            gl_FragColor = vec4(col, clamp(max(smoothstep(0.02, 0.25, m) * keep, max(col.r, max(col.g, col.b))), 0.0, 1.0));
        }
    `,
};

function ditherTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let y = 0; y < 64; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 64; x += 4) g.fillRect(x, y, 1, 1);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    t.magFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

type Slab = {
    layer: SceneLayer;
    group: THREE.Group;
    body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
    top: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    height: { value: number };
    y: number;
    flash: number;
    label: HTMLElement | null;
};

/**
 * A glass box with the request inside it. Each slab is one layer the request
 * crossed, as thick as its share of the time; a packet falls through them in
 * that rhythm and climbs back out. Scrolling away takes the box apart.
 */
export class GlassScene {
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private bloom: UnrealBloomPass;
    private signal: ShaderPass;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    private rig = new THREE.Group();
    private box: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
    private boxFaces: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    private scan: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private packet: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    private trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private trailPoints: THREE.Vector3[] = [];
    private bits: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
    private slabs: Slab[] = [];
    private slabGeometry = new THREE.BoxGeometry(SLAB, 1, SLAB);
    private slabEdges = new THREE.EdgesGeometry(this.slabGeometry);
    private dither = ditherTexture();
    private loop: gsap.core.Timeline | null = null;
    /** Where the packet is along its path: -1 above the box, k inside slab k, fractions in between. */
    private probe = { at: -1, visible: 0 };
    private pointer = new THREE.Vector2();
    private tilt = new THREE.Vector2();
    private progress = 0;
    private spread = 0;
    private nextKick = 0;
    private kick = 0;
    private running = false;
    private disposed = false;
    private width = 1;
    private height = 1;
    private aim = 0.8;
    private readonly onPointer = (e: PointerEvent) => {
        this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    private readonly tick = () => this.frame();

    constructor(
        private canvas: HTMLCanvasElement,
        private reduced: boolean,
    ) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

        this.camera.position.set(8.2, 5.4, 9.4);
        this.camera.lookAt(0, -0.1, 0);
        this.scene.add(this.rig);
        this.rig.rotation.y = -0.18;

        // The box itself: hairline edges and a whisper of glass.
        const boxGeometry = new THREE.BoxGeometry(BOX.w, BOX.h, BOX.w);
        this.box = new THREE.LineSegments(
            new THREE.EdgesGeometry(boxGeometry),
            new THREE.LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.42 }),
        );
        this.boxFaces = new THREE.Mesh(
            boxGeometry,
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.018, side: THREE.DoubleSide, depthWrite: false }),
        );
        this.rig.add(this.box, this.boxFaces);

        // A scan plane that follows the packet, so its depth reads at a glance.
        const s = BOX.w / 2;
        this.scan = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-s, 0, -s),
                new THREE.Vector3(s, 0, -s),
                new THREE.Vector3(s, 0, s),
                new THREE.Vector3(-s, 0, s),
            ]),
            new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0 }),
        );
        this.rig.add(this.scan);

        this.packet = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        this.rig.add(this.packet);

        for (let i = 0; i < 26; i++) this.trailPoints.push(new THREE.Vector3(0, TOP_Y, 0));
        const trailGeometry = new THREE.BufferGeometry().setFromPoints(this.trailPoints);
        const fade = new Float32Array(this.trailPoints.length * 3);
        this.trailPoints.forEach((_, i) => {
            const k = 1 - i / this.trailPoints.length;
            fade.set([k, k, k], i * 3);
        });
        trailGeometry.setAttribute('color', new THREE.BufferAttribute(fade, 3));
        this.trail = new THREE.Line(
            trailGeometry,
            new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending }),
        );
        this.rig.add(this.trail);

        // Loose bits drifting up inside the glass: the background, caught in the box.
        const count = 150;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions.set([(Math.random() - 0.5) * BOX.w * 0.94, (Math.random() - 0.5) * BOX.h, (Math.random() - 0.5) * BOX.w * 0.94], i * 3);
            const tint = Math.random();
            const c = tint < 0.08 ? RED : tint < 0.16 ? CYAN : WHITE;
            const k = 0.35 + Math.random() * 0.4;
            colors.set([c.r * k, c.g * k, c.b * k], i * 3);
        }
        const bitGeometry = new THREE.BufferGeometry();
        bitGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        bitGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.bits = new THREE.Points(
            bitGeometry,
            new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }),
        );
        this.rig.add(this.bits);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.2, 0.18);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
        this.signal = new ShaderPass(SignalShader);
        this.composer.addPass(this.signal);

        window.addEventListener('pointermove', this.onPointer, { passive: true });
        this.nextKick = performance.now() + 2500;
    }

    /**
     * Lays the slabs out for a new trace; thicknesses tween from what was there before.
     * Thickness follows the square root of each layer's time, so one slow layer cannot
     * flatten the rest into lines; the labels carry the exact numbers.
     */
    setLayers(layers: SceneLayer[], labels: (HTMLElement | null)[]): void {
        const total = layers.reduce((n, l) => n + Math.sqrt(l.ms), 0) || 1;
        const room = STACK_H - GAP * (layers.length - 1);
        const free = room - MIN_SLAB * layers.length;

        const fresh = this.slabs.length !== layers.length || this.slabs.some((s, i) => s.layer.id !== layers[i].id);
        if (fresh) {
            this.slabs.forEach((s) => {
                this.rig.remove(s.group);
                s.body.material.dispose();
                s.edges.material.dispose();
                s.top.material.dispose();
                s.top.geometry.dispose();
            });
            this.slabs = layers.map((layer) => this.makeSlab(layer));
        }

        layers.forEach((layer, i) => {
            const slab = this.slabs[i];
            slab.layer = layer;
            slab.label = labels[i] ?? null;
            slab.edges.material.color.copy(layer.slowest ? RED : WHITE);
            const target = MIN_SLAB + free * (Math.sqrt(layer.ms) / total);
            if (this.reduced || fresh) slab.height.value = target;
            else gsap.to(slab.height, { value: target, duration: 1.1, ease: 'expo.out' });
        });

        if (fresh && !this.reduced) {
            // Slabs arrive from above, bottom first, the way the stack is built below.
            [...this.slabs].reverse().forEach((slab, i) => {
                slab.group.position.y = 6;
                (slab.group.userData as { drop: number }).drop = 6;
                gsap.to(slab.group.userData, { drop: 0, duration: 0.9, delay: 0.15 + i * 0.12, ease: 'bounce.out' });
            });
        }

        this.buildLoop();
        if (this.reduced) this.render(performance.now());
    }

    private makeSlab(layer: SceneLayer): Slab {
        const group = new THREE.Group();
        const side = new THREE.MeshBasicMaterial({ color: 0x0b0b0d, transparent: true, opacity: 0.92 });
        const body = new THREE.Mesh(this.slabGeometry, side);
        const edges = new THREE.LineSegments(this.slabEdges, new THREE.LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.55 }));
        const top = new THREE.Mesh(
            new THREE.PlaneGeometry(SLAB * 0.96, SLAB * 0.96),
            new THREE.MeshBasicMaterial({ map: this.dither, color: 0x6b6b72, transparent: true, opacity: 0.5, depthWrite: false }),
        );
        top.rotation.x = -Math.PI / 2;
        group.add(body, edges, top);
        group.userData = { drop: 0 };
        this.rig.add(group);
        return { layer, group, body, edges, top, height: { value: MIN_SLAB }, y: 0, flash: 0, label: null };
    }

    /** The packet's journey: down through each layer, lingering in proportion to its time, then back up. */
    private buildLoop(): void {
        this.loop?.kill();
        if (this.reduced || !this.slabs.length) return;

        const total = this.slabs.reduce((n, s) => n + s.layer.ms, 0) || 1;
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.1, delay: 1.4 });
        tl.set(this.probe, { at: -1, visible: 1 });

        const deepest = this.slabs.reduce((d, s, k) => (s.layer.reached ? k : d), 0);
        this.slabs.forEach((slab, k) => {
            // Below the deepest layer the request reached, nothing happened; it turns back there.
            if (k > deepest || !slab.layer.reached) return;
            tl.to(this.probe, {
                at: k,
                duration: 0.42,
                ease: 'power2.in',
                onComplete: () => {
                    slab.flash = 1;
                },
            });
            tl.to({}, { duration: 0.2 + 2.4 * (slab.layer.ms / total) });
        });

        tl.to(this.probe, { at: -1, duration: 0.85, ease: 'power3.inOut' });
        tl.set(this.probe, { visible: 0 });
        this.loop = tl;
        if (!this.running) tl.pause();
    }

    /** 0 at the top of the hero, 1 once it has scrolled away: the box opens and the stack comes apart. */
    setProgress(p: number): void {
        this.progress = p;
        if (this.reduced) this.render(performance.now());
    }

    resize(width: number, height: number): void {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.camera.aspect = this.width / this.height;
        // Portrait frames pull the camera back so the box never crops.
        this.camera.zoom = Math.min(0.84, this.camera.aspect / 1.08);
        this.aim = this.camera.aspect > 1.2 ? 0.8 : 0.55;
        // Narrow frames: a smaller box, pushed left, so the labels on its right still fit.
        if (this.width < 560) {
            this.camera.zoom = 0.6;
            this.aim = 1.35;
        }
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height, false);
        this.composer.setSize(this.width, this.height);
        this.bloom.resolution.set(this.width / 2, this.height / 2);
        this.signal.uniforms.uLines.value = this.height;
        if (this.reduced || !this.running) this.render(performance.now());
    }

    start(): void {
        if (this.running || this.disposed) return;
        this.running = true;
        if (this.reduced) {
            this.render(performance.now());
            return;
        }
        this.loop?.resume();
        gsap.ticker.add(this.tick);
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        this.loop?.pause();
        gsap.ticker.remove(this.tick);
    }

    private frame(): void {
        if (document.hidden) return;
        this.render(performance.now());
    }

    /** The packet's height for a fractional position along its path. */
    private probeY(): number {
        const at = this.probe.at;
        const yOf = (k: number) => (k < 0 ? TOP_Y : (this.slabs[k]?.y ?? 0));
        const lo = Math.floor(at);
        return yOf(lo) + (yOf(Math.min(lo + 1, this.slabs.length - 1)) - yOf(lo)) * (at - lo);
    }

    private layout(): void {
        const spread = this.spread;
        const gap = GAP + spread * 0.55;
        const heights = this.slabs.map((s) => s.height.value);
        const stack = heights.reduce((a, b) => a + b, 0) + gap * Math.max(0, this.slabs.length - 1);
        let y = stack / 2;

        this.slabs.forEach((slab, i) => {
            const h = heights[i];
            slab.y = y - h / 2;
            y -= h + gap;
            const drop = (slab.group.userData as { drop: number }).drop ?? 0;
            slab.group.position.y = slab.y + drop;
            // Coming apart, every other slab slides a little out of line.
            slab.group.position.x = spread * (i % 2 ? 0.35 : -0.35);
            slab.group.rotation.y = spread * (i % 2 ? 0.12 : -0.12);
            slab.body.scale.y = h;
            slab.edges.scale.y = h;
            slab.top.position.y = h / 2 + 0.002;
        });
    }

    private render(now: number): void {
        const reduced = this.reduced;
        this.spread += (this.progress - this.spread) * (reduced ? 1 : 0.08);
        this.layout();

        if (!reduced) {
            this.tilt.lerp(this.pointer, 0.045);
            this.rig.rotation.y = -0.18 + this.tilt.x * 0.32 + this.spread * 0.55 + Math.sin(now / 4200) * 0.05;
            this.rig.rotation.x = this.tilt.y * 0.08;
        }
        this.rig.position.y = -this.spread * 0.2;
        this.camera.position.set(8.2, 5.4 + this.spread * 0.6, 9.4 + this.spread * 3);
        // Aim right of centre so the box sits left and its labels have room.
        this.camera.lookAt(this.aim, -0.1, -this.aim * 0.9);

        this.box.material.opacity = 0.42 * (1 - this.spread * 0.85);
        this.box.scale.setScalar(1 + this.spread * 0.18);
        this.boxFaces.scale.copy(this.box.scale);

        // Packet, trail and scan plane.
        const visible = this.probe.visible > 0 && !reduced;
        this.packet.visible = this.trail.visible = visible;
        const py = this.probeY();
        this.packet.position.set(0, py, 0);
        this.packet.rotation.y = now / 600;
        const last = this.trailPoints.pop()!;
        this.trailPoints.unshift(last.copy(this.packet.position));
        const trail = this.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
        this.trailPoints.forEach((p, i) => trail.setXYZ(i, p.x, p.y, p.z));
        trail.needsUpdate = true;
        const inBox = Math.abs(py) < BOX.h / 2;
        this.scan.position.y = py;
        this.scan.material.opacity += ((visible && inBox ? 0.55 : 0) - this.scan.material.opacity) * 0.15;

        // A slab the packet has just reached lights up, then settles.
        this.slabs.forEach((slab) => {
            slab.flash *= reduced ? 0 : 0.955;
            const base = slab.layer.reached ? 0.55 : 0.18;
            slab.edges.material.opacity = Math.min(1, base + slab.flash * 0.6);
            slab.top.material.opacity = (slab.layer.reached ? 0.42 : 0.1) + slab.flash * 0.5;
            slab.top.material.color.setScalar(0.42 + slab.flash * 0.58);
            if (slab.layer.slowest) slab.top.material.color.lerp(RED, 0.35 + slab.flash * 0.4);
        });

        if (!reduced) {
            const pos = this.bits.geometry.getAttribute('position') as THREE.BufferAttribute;
            for (let i = 0; i < pos.count; i++) {
                let y = pos.getY(i) + 0.0035;
                if (y > BOX.h / 2) y = -BOX.h / 2;
                pos.setY(i, y);
            }
            pos.needsUpdate = true;

            if (now > this.nextKick) {
                this.kick = 1;
                this.nextKick = now + 4200 + Math.random() * 6000;
            }
            this.kick *= 0.86;
        }
        this.bits.scale.setScalar(1 + this.spread * 0.25);
        this.signal.uniforms.uKick.value = this.kick + this.spread * 0.15;
        this.signal.uniforms.uTime.value = now / 1000;

        this.composer.render();
        this.placeLabels();
    }

    private readonly anchor = new THREE.Vector3();

    /** HTML labels ride the box's right-hand edge at each slab's height, projected each frame, clear of the glass. */
    private placeLabels(): void {
        this.rig.updateMatrixWorld();
        const edge = (BOX.w / 2) * this.box.scale.x;
        this.slabs.forEach((slab) => {
            if (!slab.label) return;
            this.anchor.set(edge, slab.group.position.y, -edge);
            this.rig.localToWorld(this.anchor);
            this.anchor.project(this.camera);
            const x = (this.anchor.x * 0.5 + 0.5) * this.width;
            const y = (-this.anchor.y * 0.5 + 0.5) * this.height;
            slab.label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateY(-50%)`;
            slab.label.style.opacity = String(slab.layer.reached ? 0.62 + Math.min(0.38, slab.flash) : 0.32);
        });
    }

    dispose(): void {
        this.disposed = true;
        this.stop();
        this.loop?.kill();
        window.removeEventListener('pointermove', this.onPointer);
        this.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(material)) material.forEach((m) => m.dispose());
            else material?.dispose();
        });
        this.dither.dispose();
        this.composer.dispose();
        this.renderer.dispose();
    }
}
