import * as THREE from 'three';
import { WHITE, type ChapterFrame, type Targets } from './types';

const VERT = /* glsl */ `
    attribute vec4 aColor;
    attribute float aSize;
    attribute float aSq;
    attribute float aGlyph;
    uniform float uDpr;
    varying vec4 vColor;
    varying float vSq;
    varying float vGlyph;
    void main() {
        vColor = aColor;
        vSq = aSq;
        vGlyph = aGlyph;
        gl_PointSize = aSize * uDpr;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const FRAG = /* glsl */ `
    uniform sampler2D uAtlas;
    varying vec4 vColor;
    varying float vSq;
    varying float vGlyph;
    void main() {
        vec2 uv = gl_PointCoord;
        float glyph = texture2D(uAtlas, vec2((vGlyph + uv.x) * 0.5, 1.0 - uv.y)).a;
        vec2 d = abs(uv - 0.5);
        float square = step(max(d.x, d.y), 0.42);
        float a = mix(glyph, square, vSq) * vColor.a;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor.rgb, a);
    }
`;

/** Two glyphs, 0 and 1, side by side: the same characters as the background's bits. */
function atlas(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '500 50px "Geist Mono", ui-monospace, monospace';
    g.fillText('0', 32, 34);
    g.fillText('1', 96, 34);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return t;
}

/**
 * The page's bits as one field of points over the whole viewport. Chapters
 * decide where each bit belongs; the field only integrates: a spring toward the
 * target, a little life on top, and a push away from the pointer.
 */
export class BitField {
    readonly n: number;
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1);
    private geometry = new THREE.BufferGeometry();
    private material: THREE.ShaderMaterial;
    private pos: Float32Array;
    private col: Float32Array;
    private size: Float32Array;
    private sq: Float32Array;
    private px: Float32Array;
    private py: Float32Array;
    private vx: Float32Array;
    private vy: Float32Array;
    private k: Float32Array;
    private restX: Float32Array;
    private restY: Float32Array;
    private t: Targets;
    private frameFn: ChapterFrame | null = null;
    private running = false;
    private raf = 0;
    private vw = 1;
    private vh = 1;
    private readonly onPointer = (e: PointerEvent) => {
        this.t.pointer.x = e.clientX;
        this.t.pointer.y = e.clientY;
    };
    private readonly onLeave = () => {
        this.t.pointer.x = -9999;
        this.t.pointer.y = -9999;
    };

    constructor(
        private canvas: HTMLCanvasElement,
        n: number,
    ) {
        this.n = n;
        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'default' });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        const f = () => new Float32Array(n);
        this.pos = new Float32Array(n * 3);
        this.col = new Float32Array(n * 4);
        this.size = f();
        this.sq = f();
        this.px = f();
        this.py = f();
        this.vx = f();
        this.vy = f();
        this.k = f();
        this.restX = f();
        this.restY = f();
        const glyph = f();
        const seed = f();
        const seed2 = f();

        this.vw = window.innerWidth;
        this.vh = window.innerHeight;
        for (let i = 0; i < n; i++) {
            // Each bit answers its spring at its own pace, so formations arrive as a swarm.
            this.k[i] = 0.016 + Math.random() * 0.03;
            this.restX[i] = Math.random();
            this.restY[i] = Math.random();
            this.px[i] = this.restX[i] * this.vw;
            this.py[i] = this.restY[i] * this.vh;
            glyph[i] = Math.random() < 0.5 ? 0 : 1;
            seed[i] = Math.random();
            seed2[i] = Math.random();
        }

        this.t = {
            n,
            vw: this.vw,
            vh: this.vh,
            x: f(),
            y: f(),
            a: f(),
            r: f(),
            g: f(),
            b: f(),
            s: f(),
            sq: f(),
            seed,
            seed2,
            pointer: { x: -9999, y: -9999 },
            rest: (from, to) => this.rest(from, to),
        };
        this.rest(0, n);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('aSq', new THREE.BufferAttribute(this.sq, 1).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('aGlyph', new THREE.BufferAttribute(glyph, 1));
        this.material = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: { uAtlas: { value: atlas() }, uDpr: { value: this.renderer.getPixelRatio() } },
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        const points = new THREE.Points(this.geometry, this.material);
        points.frustumCulled = false;
        this.scene.add(points);

        window.addEventListener('pointermove', this.onPointer, { passive: true });
        document.addEventListener('pointerleave', this.onLeave);
        this.resize();
    }

    private rest(from: number, to: number) {
        const t = this.t;
        for (let i = from; i < to; i++) {
            t.x[i] = this.restX[i] * t.vw;
            t.y[i] = this.restY[i] * t.vh;
            t.a[i] = 0.045;
            t.r[i] = WHITE[0];
            t.g[i] = WHITE[1];
            t.b[i] = WHITE[2];
            t.s[i] = 7;
            t.sq[i] = 0;
        }
    }

    setChapter(fn: ChapterFrame | null) {
        this.frameFn = fn;
    }

    resize() {
        this.vw = window.innerWidth;
        this.vh = window.innerHeight;
        this.t.vw = this.vw;
        this.t.vh = this.vh;
        this.renderer.setSize(this.vw, this.vh, false);
        this.camera.left = 0;
        this.camera.right = this.vw;
        this.camera.top = 0;
        this.camera.bottom = this.vh;
        this.camera.updateProjectionMatrix();
    }

    start() {
        if (this.running) return;
        this.running = true;
        const loop = (now: number) => {
            this.raf = requestAnimationFrame(loop);
            if (document.hidden) return;
            this.step(now / 1000);
        };
        this.raf = requestAnimationFrame(loop);
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.raf);
    }

    private step(time: number) {
        const t = this.t;
        if (this.frameFn) this.frameFn(t, time);
        else this.rest(0, this.n);

        const { pos, col, size, sq, px, py, vx, vy, k } = this;
        const mx = t.pointer.x;
        const my = t.pointer.y;
        for (let i = 0; i < this.n; i++) {
            // A little life on top of every target, so nothing ever freezes.
            const wobble = Math.sin(time * 1.3 + t.seed[i] * 40) * 0.6;
            let ax = (t.x[i] + wobble - px[i]) * k[i];
            let ay = (t.y[i] + Math.cos(time * 1.1 + t.seed2[i] * 40) * 0.6 - py[i]) * k[i];
            const dx = px[i] - mx;
            const dy = py[i] - my;
            const d2 = dx * dx + dy * dy;
            if (d2 < 12100) {
                const d = Math.sqrt(d2) || 1;
                const push = (1 - d / 110) * 2.4;
                ax += (dx / d) * push;
                ay += (dy / d) * push;
            }
            vx[i] = (vx[i] + ax) * 0.84;
            vy[i] = (vy[i] + ay) * 0.84;
            px[i] += vx[i];
            py[i] += vy[i];

            pos[i * 3] = px[i];
            pos[i * 3 + 1] = py[i];
            const c = i * 4;
            col[c] += (t.r[i] - col[c]) * 0.08;
            col[c + 1] += (t.g[i] - col[c + 1]) * 0.08;
            col[c + 2] += (t.b[i] - col[c + 2]) * 0.08;
            col[c + 3] += (t.a[i] - col[c + 3]) * 0.07;
            size[i] += (t.s[i] - size[i]) * 0.1;
            sq[i] += (t.sq[i] - sq[i]) * 0.1;
        }

        for (const name of ['position', 'aColor', 'aSize', 'aSq']) (this.geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        this.stop();
        window.removeEventListener('pointermove', this.onPointer);
        document.removeEventListener('pointerleave', this.onLeave);
        this.geometry.dispose();
        this.material.uniforms.uAtlas.value.dispose();
        this.material.dispose();
        this.renderer.dispose();
    }
}
