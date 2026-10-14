import { CircuitBoard } from '@/components/circuit/circuit-board';
import type { SceneLayer } from '@/components/hero/glass-scene';
import { Hero, type HeroRequest } from '@/components/hero/hero';
import { heroLayers } from '@/components/hero/layers';
import { Machine } from '@/components/machine/machine';
import { Ambient } from '@/components/signal/ambient';
import { TearDivider } from '@/components/signal/tear-divider';
import { JumpGlitch, ScrollProgress } from '@/components/site/chrome';
import { Contact } from '@/components/site/contact';
import { Intro } from '@/components/site/intro';
import { LiveMarquee } from '@/components/site/live-marquee';
import { Nav } from '@/components/site/nav';
import { Rules } from '@/components/site/rules';
import { SectionHead } from '@/components/site/section-head';
import { SectionState, type Loadable } from '@/components/site/section-state';
import { SmoothShell } from '@/components/site/smooth-shell';
import { Systems } from '@/components/site/systems';
import { apiGet, fetchTrace } from '@/lib/api';
import { ScrollTrigger } from '@/lib/gsap';
import { enableSmoothAnchors } from '@/lib/smooth-scroll';
import type { Decision, Flow, Profile, StackResponse, System } from '@/types/portfolio';
import { Head } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';

function useApi<T>(path: string): Loadable<T> {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({ data: null, loading: true, error: false });

    useEffect(() => {
        let alive = true;
        setState((s) => ({ ...s, loading: true, error: false }));
        apiGet<{ data: T }>(path)
            .then((result) => alive && setState({ data: result.body.data, loading: false, error: result.status >= 400 }))
            .catch(() => alive && setState({ data: null, loading: false, error: true }));
        return () => {
            alive = false;
        };
    }, [path, attempt]);

    const reload = useCallback(() => setAttempt((n) => n + 1), []);
    return { ...state, reload };
}

/** Content arrives after the first paint; every trigger below it has to be measured again when it does. */
function useScrollRefresh() {
    useEffect(() => {
        let timer = 0;
        const refresh = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                ScrollTrigger.sort();
                ScrollTrigger.refresh();
            }, 160);
        };
        const observer = new ResizeObserver(refresh);
        // Under ScrollSmoother the body's height is derived; the content is what actually grows.
        observer.observe(document.getElementById('smooth-content') ?? document.body);
        document.fonts?.ready.then(refresh);
        return () => {
            window.clearTimeout(timer);
            observer.disconnect();
        };
    }, []);
}

export default function Home() {
    const profile = useApi<Profile>('/api/profile');
    const systems = useApi<System[]>('/api/systems');
    const decisions = useApi<Decision[]>('/api/decisions');
    const flows = useApi<Flow[]>('/api/flows');
    const [stackAttempt, setStackAttempt] = useState(0);
    const [stack, setStack] = useState<Loadable<StackResponse>>({ data: null, loading: true, error: false, reload: () => undefined });
    const [layers, setLayers] = useState<SceneLayer[] | null>(null);
    const [request, setRequest] = useState<HeroRequest | null>(null);

    // The map's own request, and then the trace it left: the hero draws that trace.
    useEffect(() => {
        let alive = true;
        const reload = () => setStackAttempt((n) => n + 1);
        setStack({ data: null, loading: true, error: false, reload });
        apiGet<StackResponse>('/api/stack')
            .then(async (result) => {
                if (!alive) return;
                setStack({ data: result.body, loading: false, error: false, reload });
                const trace = result.traceId ? await fetchTrace(result.traceId) : null;
                if (!alive) return;
                if (!trace) return setRequest('failed');
                setLayers(heroLayers(trace, result.timing, result.cache));
                setRequest({ status: trace.status, serverMs: trace.duration_ms, cache: result.cache });
            })
            .catch(() => {
                if (!alive) return;
                setStack({ data: null, loading: false, error: true, reload });
                setRequest('failed');
            });
        return () => {
            alive = false;
        };
    }, [stackAttempt]);

    useEffect(() => enableSmoothAnchors(), []);
    useScrollRefresh();

    const p = profile.data;
    // The board needs both answers; it waits, or fails, on whichever is behind.
    const board: Loadable<{ stack: StackResponse; flows: Flow[] }> = {
        data: stack.data && flows.data ? { stack: stack.data, flows: flows.data } : null,
        loading: stack.loading || flows.loading,
        error: stack.error || flows.error,
        reload: () => {
            if (stack.error) stack.reload();
            if (flows.error) flows.reload();
        },
    };

    return (
        <>
            <Head title={p ? `${p.name}, ${p.role}` : 'Backend & infrastructure engineer'} />

            <div className="grain relative min-h-screen bg-[#050506] font-sans text-zinc-100 selection:bg-[#ff3b30] selection:text-black">
                <a
                    href="#content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[2px] focus:bg-zinc-50 focus:px-4 focus:py-2 focus:font-mono focus:text-[12px] focus:text-black"
                >
                    Skip to content
                </a>
                <Ambient />
                <ScrollProgress />
                <Nav name={p?.name ?? null} ready={!systems.loading && !decisions.loading} />
                <JumpGlitch />
                <Intro />

                <SmoothShell>
                    <main
                        id="content"
                        tabIndex={-1}
                        className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pt-14 pb-16 outline-none sm:px-8 lg:px-12"
                    >
                        <Hero profile={p} layers={layers} request={request} />

                        <div className="mt-6 sm:mt-10">
                            <LiveMarquee />
                        </div>
                        <section id="stack" className="relative scroll-mt-16 pt-10">
                            <SectionHead title="The tools, and what happens between them">
                                Every chip is a tool I run. Pick a scenario and a signal walks the chips it really touches, in order, with the reason
                                for each hop.
                            </SectionHead>
                            <div className="mt-10">
                                <SectionState
                                    state={board}
                                    endpoint="/api/stack"
                                    skeleton={
                                        <>
                                            <div className="flex gap-2">
                                                {[150, 180, 160, 210].map((w) => (
                                                    <div key={w} className="h-10 animate-pulse bg-white/[0.04]" style={{ width: w }} />
                                                ))}
                                            </div>
                                            <div className="mt-6 aspect-[1200/650] animate-pulse border border-white/8 bg-white/[0.02]" />
                                        </>
                                    }
                                >
                                    {board.data && (
                                        <>
                                            <CircuitBoard layers={board.data.stack.data} flows={board.data.flows} />
                                            <p className="mt-8 font-mono text-[12.5px] text-zinc-400">
                                                This board is not markup. It is{' '}
                                                <a
                                                    href="/docs/api"
                                                    className="text-zinc-100 underline decoration-white/25 underline-offset-4 hover:decoration-white"
                                                >
                                                    GET /api/stack
                                                </a>{' '}
                                                and{' '}
                                                <a
                                                    href="/docs/api"
                                                    className="text-zinc-100 underline decoration-white/25 underline-offset-4 hover:decoration-white"
                                                >
                                                    GET /api/flows
                                                </a>
                                                : {board.data.stack.meta.items} tools, {board.data.flows.length} scenarios.
                                            </p>
                                        </>
                                    )}
                                </SectionState>
                            </div>
                        </section>

                        <TearDivider />
                        <section id="made" className="relative scroll-mt-16 pt-10">
                            <SectionHead title="How this page was made">
                                One real request to this site, from fetch() to the last byte, sent as you arrived here. Every bar was measured; under
                                each step is the code, SQL or bytes it rests on.
                            </SectionHead>
                            <div className="mt-10">
                                <Machine />
                            </div>
                        </section>

                        <TearDivider />
                        <Systems state={systems} />

                        <TearDivider />
                        <Rules state={decisions} />

                        <TearDivider />
                        <Contact profile={p} />
                    </main>
                </SmoothShell>
            </div>
        </>
    );
}
