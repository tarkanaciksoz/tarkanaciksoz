import { CircuitBoard } from '@/components/circuit/circuit-board';
import type { SceneLayer } from '@/components/hero/glass-scene';
import { Hero, type HeroRequest } from '@/components/hero/hero';
import { heroLayers } from '@/components/hero/layers';
import { SplitReveal } from '@/components/motion/split-reveal';
import { Anatomy } from '@/components/portfolio/anatomy';
import { Ambient } from '@/components/signal/ambient';
import { TearDivider } from '@/components/signal/tear-divider';
import { Contact } from '@/components/site/contact';
import { Nav } from '@/components/site/nav';
import { Rules } from '@/components/site/rules';
import { Systems } from '@/components/site/systems';
import { apiGet, fetchTrace } from '@/lib/api';
import { ScrollTrigger } from '@/lib/gsap';
import { enableSmoothAnchors } from '@/lib/smooth-scroll';
import type { Decision, Flow, Profile, StackResponse, System } from '@/types/portfolio';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';

function useApi<T>(path: string) {
    const [state, setState] = useState<{ data: T | null; loading: boolean }>({ data: null, loading: true });

    useEffect(() => {
        let alive = true;
        apiGet<{ data: T }>(path)
            .then((result) => alive && setState({ data: result.body.data, loading: false }))
            .catch(() => alive && setState({ data: null, loading: false }));
        return () => {
            alive = false;
        };
    }, [path]);

    return state;
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
        observer.observe(document.body);
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
    const [stack, setStack] = useState<StackResponse | null>(null);
    const [layers, setLayers] = useState<SceneLayer[] | null>(null);
    const [request, setRequest] = useState<HeroRequest | null>(null);

    // The map's own request, and then the trace it left: the hero draws that trace.
    useEffect(() => {
        let alive = true;
        apiGet<StackResponse>('/api/stack')
            .then(async (result) => {
                if (!alive) return;
                setStack(result.body);
                if (!result.traceId) return;
                const trace = await fetchTrace(result.traceId);
                if (!alive || !trace) return;
                setLayers(heroLayers(trace, result.timing, result.cache));
                setRequest({ status: trace.status, serverMs: trace.duration_ms, cache: result.cache });
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => enableSmoothAnchors(), []);
    useScrollRefresh();

    const p = profile.data;

    return (
        <>
            <Head title={p ? `${p.name}, ${p.role}` : 'Backend & infrastructure engineer'} />

            <div className="grain relative min-h-screen bg-black font-sans text-zinc-100 selection:bg-[#ff3b30] selection:text-black">
                <Ambient />
                <Nav name={p?.name ?? null} ready={!systems.loading && !decisions.loading} />

                <main className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pt-14 pb-16 sm:px-8 lg:px-12">
                    <Hero profile={p} layers={layers} request={request} />

                    <TearDivider />
                    <section id="stack" className="relative z-10 scroll-mt-16 pt-10">
                        <div className="flex flex-wrap items-end justify-between gap-6">
                            <SplitReveal
                                text="The tools, and what happens between them"
                                className="max-w-[18ch] text-4xl leading-[0.98] font-semibold tracking-[-0.04em] text-zinc-50 sm:text-6xl"
                            />
                            <p className="max-w-[44ch] text-zinc-400">
                                Every chip is a tool I run. Pick a scenario and a signal walks the chips it really touches, in order, with the reason
                                for each hop.
                            </p>
                        </div>
                        <div className="mt-10">
                            {stack && flows.data ? (
                                <>
                                    <CircuitBoard layers={stack.data} flows={flows.data} />
                                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                                        <p className="font-mono text-[12.5px] text-zinc-500">
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
                                            : {stack.meta.items} tools, {flows.data.length} scenarios.
                                        </p>
                                        <a
                                            href="#made"
                                            className="jitter rounded-[2px] border border-white/25 px-4 py-2.5 font-mono text-[12px] tracking-[0.08em] whitespace-nowrap uppercase hover:border-white"
                                        >
                                            How this was made ↓
                                        </a>
                                    </div>
                                </>
                            ) : (
                                <div
                                    className="h-[420px] animate-pulse rounded-[2px] border border-white/8 bg-white/[0.02]"
                                    aria-label="Loading the board"
                                />
                            )}
                        </div>
                    </section>

                    <TearDivider />
                    <section id="made" className="relative z-10 scroll-mt-16 pt-10">
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
                            <SplitReveal
                                text="How this page was made"
                                className="max-w-[14ch] text-4xl leading-[0.98] font-semibold tracking-[-0.04em] text-zinc-50 sm:text-6xl"
                            />
                            <p className="max-w-[60ch] text-zinc-400">
                                When this section came into view, the page built the stack it runs on, sent the request behind the map above, read the
                                trace that request left, and began replaying it slowly: what the browser measured, what the server did, the SQL with
                                the database's own plan, and the deployed lines each step came from.
                            </p>
                        </div>
                        <div className="mt-10">
                            <Anatomy />
                        </div>
                    </section>

                    {systems.data?.length ? (
                        <>
                            <TearDivider />
                            <Systems systems={systems.data} />
                        </>
                    ) : null}

                    {decisions.data?.length ? (
                        <>
                            <TearDivider />
                            <Rules decisions={decisions.data} />
                        </>
                    ) : null}

                    <TearDivider />
                    <Contact profile={p} />
                </main>
            </div>
        </>
    );
}
