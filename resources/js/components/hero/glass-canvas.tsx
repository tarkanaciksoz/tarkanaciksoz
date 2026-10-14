import { ms } from '@/lib/api';
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useEffect, useRef, useState } from 'react';
import type { GlassScene, SceneLayer } from './glass-scene';

/**
 * Hosts the WebGL scene. Three.js arrives in its own chunk after the page is
 * up; the scene renders only while it is on screen, and opens up as the hero
 * scrolls away. Without WebGL the same numbers are shown as a list.
 */
export function GlassCanvas({ layers, className = '' }: { layers: SceneLayer[] | null; className?: string }) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
    const sceneRef = useRef<GlassScene | null>(null);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        let scene: GlassScene | null = null;
        let observer: ResizeObserver | null = null;

        import('./glass-scene')
            .then(({ GlassScene }) => {
                const wrap = wrapRef.current;
                const canvas = canvasRef.current;
                if (!alive || !wrap || !canvas) return;
                try {
                    scene = new GlassScene(canvas, prefersReducedMotion());
                } catch {
                    setFailed(true);
                    return;
                }
                sceneRef.current = scene;
                observer = new ResizeObserver(() => scene?.resize(wrap.clientWidth, wrap.clientHeight));
                observer.observe(wrap);
                scene.resize(wrap.clientWidth, wrap.clientHeight);
                setReady(true);
            })
            .catch(() => alive && setFailed(true));

        return () => {
            alive = false;
            observer?.disconnect();
            scene?.dispose();
            sceneRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (ready && layers) sceneRef.current?.setLayers(layers, labelRefs.current.slice(0, layers.length));
    }, [ready, layers]);

    useGSAP(
        () => {
            const scene = sceneRef.current;
            const wrap = wrapRef.current;
            if (!ready || !scene || !wrap) return;

            // Draw only while any of it is on screen.
            const visible = ScrollTrigger.create({
                trigger: wrap,
                start: 'top bottom',
                end: 'bottom top',
                onToggle: (self) => (self.isActive ? scene.start() : scene.stop()),
            });
            if (visible.isActive) scene.start();

            // Scrolling the hero away takes the box apart.
            ScrollTrigger.create({
                trigger: wrap.closest('section') ?? wrap,
                start: 'top top',
                end: 'bottom top',
                scrub: true,
                onUpdate: (self) => scene.setProgress(self.progress),
            });

            gsap.fromTo(canvasRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, ease: 'power2.out' });
        },
        { dependencies: [ready], scope: wrapRef },
    );

    if (failed) {
        return (
            <ol className={`flex flex-col justify-center gap-2 font-mono text-[12px] ${className}`}>
                {(layers ?? []).map((l) => (
                    <li key={l.id} className="flex justify-between border-b border-white/10 py-1.5">
                        <span className="text-zinc-400">{l.name}</span>
                        <span className={l.slowest ? 'text-[#ff3b30]' : 'text-zinc-100'}>{l.ms > 0 ? `${ms(l.ms)} ms` : l.note}</span>
                    </li>
                ))}
            </ol>
        );
    }

    return (
        <div ref={wrapRef} className={`relative overflow-hidden ${className}`}>
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                {(layers ?? []).map((l, i) => (
                    <div
                        key={l.id}
                        ref={(el) => {
                            labelRefs.current[i] = el;
                        }}
                        className="absolute top-0 left-0 flex items-center gap-2 font-mono text-[11px] whitespace-nowrap will-change-transform"
                        style={{ opacity: 0 }}
                    >
                        <span className={`h-px w-5 sm:w-8 ${l.slowest ? 'bg-[#ff3b30]' : 'bg-white/45'}`} />
                        <span className="text-zinc-400">{l.name}</span>
                        <span className={`tabular-nums ${l.slowest ? 'text-[#ff3b30]' : 'text-zinc-100'}`}>
                            {l.ms > 0 ? `${ms(l.ms)} ms` : l.note}
                        </span>
                    </div>
                ))}
            </div>
            {/* Screen readers get the numbers, not the picture. */}
            <ol className="sr-only">
                {(layers ?? []).map((l) => (
                    <li key={l.id}>{`${l.name}: ${l.ms > 0 ? `${ms(l.ms)} milliseconds` : l.note}`}</li>
                ))}
            </ol>
        </div>
    );
}
