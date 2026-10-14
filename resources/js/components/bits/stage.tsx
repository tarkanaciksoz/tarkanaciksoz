import { prefersReducedMotion, ScrollTrigger } from '@/lib/gsap';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type { BitField } from './field';
import type { ChapterFrame } from './types';

type Api = {
    register: (id: string, frame: ChapterFrame) => () => void;
    activate: (id: string) => void;
};

const Ctx = createContext<Api | null>(null);

/** How many bits the field draws, and how many bytes of the response each one stands for. */
export function bitBudget(bytes: number) {
    const max = window.matchMedia('(max-width: 767px)').matches ? 4500 : 12000;
    const perDot = Math.max(1, Math.ceil(bytes / max));
    return { count: Math.ceil(bytes / perDot), perDot };
}

/**
 * One field of bits behind the whole page. Each section registers a chapter (a
 * function that says where every bit belongs) and takes the field over while it
 * is the section on screen. Three.js arrives in its own chunk once the page
 * knows how many bytes it is drawing.
 */
export function BitStage({ bytes, children }: { bytes: number | null; children: ReactNode }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const field = useRef<BitField | null>(null);
    const chapters = useRef(new Map<string, ChapterFrame>());
    const active = useRef<string | null>(null);

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
            field.current = instance;
            instance.setChapter(active.current ? (chapters.current.get(active.current) ?? null) : null);
            instance.start();
            window.addEventListener('resize', onResize);
        });

        return () => {
            alive = false;
            window.removeEventListener('resize', onResize);
            instance?.dispose();
            field.current = null;
        };
    }, [bytes]);

    const api = useMemo<Api>(
        () => ({
            register(id, frame) {
                chapters.current.set(id, frame);
                if (active.current === id) field.current?.setChapter(frame);
                return () => {
                    chapters.current.delete(id);
                    if (active.current === id) field.current?.setChapter(null);
                };
            },
            activate(id) {
                active.current = id;
                field.current?.setChapter(chapters.current.get(id) ?? null);
            },
        }),
        [],
    );

    return (
        <Ctx.Provider value={api}>
            <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-[1] h-full w-full" aria-hidden="true" />
            {children}
        </Ctx.Provider>
    );
}

/**
 * Hands the field to a section while that section is the one on screen. The frame
 * is read through a ref, so it can close over fresh state without re-registering.
 */
export function useBitChapter(
    id: string,
    section: RefObject<HTMLElement | null>,
    frame: ChapterFrame,
    range = { start: 'top 55%', end: 'bottom 55%' },
) {
    const api = useContext(Ctx);
    const latest = useRef(frame);
    latest.current = frame;

    useEffect(() => {
        if (!api) return;
        return api.register(id, (t, time) => latest.current(t, time));
    }, [api, id]);

    useEffect(() => {
        const el = section.current;
        if (!api || !el) return;
        const trigger = ScrollTrigger.create({
            trigger: el,
            start: range.start,
            end: range.end,
            onToggle: (self) => self.isActive && api.activate(id),
        });
        if (trigger.isActive) api.activate(id);
        return () => trigger.kill();
    }, [api, id, section, range.start, range.end]);
}
