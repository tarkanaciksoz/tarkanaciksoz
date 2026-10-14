import { prefersReducedMotion } from '@/lib/gsap';
import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { BitField } from './field';
import type { ChapterFrame, Targets } from './types';

type Chapter = { section: RefObject<HTMLElement | null>; frame: ChapterFrame };
type Registry = Map<string, Chapter>;

const Ctx = createContext<Registry | null>(null);

/** How many bits the field draws, and how many bytes of the response each one stands for. */
export function bitBudget(bytes: number) {
    const max = window.matchMedia('(max-width: 767px)').matches ? 4500 : 12000;
    const perDot = Math.max(1, Math.ceil(bytes / max));
    return { count: Math.ceil(bytes / perDot), perDot };
}

/**
 * The chapter that owns the field this frame: the section crossing the middle of
 * the screen. Decided every frame from where the sections really are, so a
 * chapter can never be left in charge of a section that has scrolled away, in
 * either direction. Between sections the bits fall back to the background drift.
 */
function director(chapters: Registry): ChapterFrame {
    return (t: Targets, time: number) => {
        const mid = t.vh / 2;
        for (const chapter of chapters.values()) {
            const r = chapter.section.current?.getBoundingClientRect();
            if (r && r.top <= mid && r.bottom >= mid) return chapter.frame(t, time);
        }
        t.rest(0, t.n);
    };
}

/**
 * One field of bits behind the whole page. Each section registers a chapter (a
 * function that says where every bit belongs) and owns the field while it is the
 * section in the middle of the screen. Three.js arrives in its own chunk once the
 * page knows how many bytes it is drawing.
 */
export function BitStage({ bytes, children }: { bytes: number | null; children: ReactNode }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const chapters = useRef<Registry>(new Map());

    useEffect(() => {
        const el = canvas.current;
        if (!el || !bytes || prefersReducedMotion()) return;
        let alive = true;
        let instance: BitField | null = null;
        const onResize = () => instance?.resize();

        import('./field').then(({ BitField }) => {
            if (!alive) return;
            try {
                instance = new BitField(el, bitBudget(bytes).count);
            } catch {
                return;
            }
            instance.setChapter(director(chapters.current));
            instance.start();
            window.addEventListener('resize', onResize);
        });

        return () => {
            alive = false;
            window.removeEventListener('resize', onResize);
            instance?.dispose();
        };
    }, [bytes]);

    return (
        <Ctx.Provider value={chapters.current}>
            <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-[1] h-full w-full" aria-hidden="true" />
            {children}
        </Ctx.Provider>
    );
}

/**
 * Registers a section's chapter. The frame is read through a ref, so it can close
 * over fresh state without registering again.
 */
export function useBitChapter(id: string, section: RefObject<HTMLElement | null>, frame: ChapterFrame) {
    const chapters = useContext(Ctx);
    const latest = useRef(frame);
    latest.current = frame;

    useEffect(() => {
        if (!chapters) return;
        chapters.set(id, { section, frame: (t, time) => latest.current(t, time) });
        return () => {
            chapters.delete(id);
        };
    }, [chapters, id, section]);
}
