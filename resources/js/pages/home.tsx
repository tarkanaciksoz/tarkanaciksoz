import { CircuitBoard } from '@/components/circuit/circuit-board';
import { Anatomy } from '@/components/portfolio/anatomy';
import { Ambient } from '@/components/signal/ambient';
import { DecodeText } from '@/components/signal/decode-text';
import { GlitchBurst } from '@/components/signal/glitch-burst';
import { SignalPanel } from '@/components/signal/signal-panel';
import { TearDivider } from '@/components/signal/tear-divider';
import { Terminal } from '@/components/terminal/terminal';
import { apiGet } from '@/lib/api';
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

export default function Home() {
    const profile = useApi<Profile>('/api/profile');
    const [stack, setStack] = useState<StackResponse | null>(null);
    const [signal, setSignal] = useState<{ raw: string; cache: string | null; serverMs: number | null }>({ raw: '', cache: null, serverMs: null });
    const systems = useApi<System[]>('/api/systems');
    const decisions = useApi<Decision[]>('/api/decisions');
    const flows = useApi<Flow[]>('/api/flows');

    useEffect(() => {
        apiGet<StackResponse>('/api/stack')
            .then((result) => {
                setStack(result.body);
                setSignal({ raw: result.raw, cache: result.cache, serverMs: result.timing?.ttfb_ms ?? null });
            })
            .catch(() => undefined);
    }, []);

    const p = profile.data;

    useEffect(() => enableSmoothAnchors(), []);

    return (
        <>
            <Head title={p ? `${p.name} · ${p.role}` : 'Backend & infrastructure engineer'} />

            <div className="grain relative min-h-screen bg-black text-zinc-100 selection:bg-[#ff3b30] selection:text-black">
                <Ambient />
                <header className="sticky top-0 z-30 border-b border-white/8 bg-black/70 backdrop-blur">
                    <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
                        <a href="#top" className="text-sm font-medium whitespace-nowrap">
                            <GlitchBurst as="span" every={[10, 22]}>
                                {p?.name ?? '—'}
                            </GlitchBurst>
                            <span className="ml-2 hidden font-mono text-[11px] text-zinc-500 sm:inline">backend · infrastructure</span>
                        </a>
                        <nav className="flex items-center gap-3 text-[13px] text-zinc-400 sm:gap-6">
                            {(
                                [
                                    ['#stack', 'Stack', stack?.meta.items],
                                    ['#made', 'Machine', null],
                                    ['#systems', 'Systems', systems.data?.length],
                                    ['#rules', 'Rules', decisions.data?.length],
                                    ['/docs/api', 'API', 6],
                                    ['#contact', 'Contact', null],
                                ] as [string, string, number | null | undefined][]
                            ).map(([href, label, count]) => (
                                <a
                                    key={href}
                                    href={href}
                                    className={`jitter hover:text-zinc-100 ${href === '#rules' || href === '#contact' ? 'hidden md:inline' : ''}`}
                                >
                                    {label}
                                    {count ? (
                                        <sup className="ml-0.5 hidden font-mono text-[9px] text-[#ff3b30] sm:inline">
                                            {String(count).padStart(2, '0')}
                                        </sup>
                                    ) : null}
                                </a>
                            ))}
                        </nav>
                    </div>
                </header>

                <main id="top" className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pb-28 sm:px-8 lg:px-12">
                    <section className="relative z-10 grid gap-10 pt-14 pb-8 sm:pt-20 xl:grid-cols-[minmax(0,1fr)_480px] xl:items-center xl:gap-16">
                        <div>
                            <div className="max-w-2xl">
                                <Terminal owner="tarkan" intro={`${p?.role ?? 'Backend & infrastructure engineer'} · ${p?.location ?? 'Istanbul'}`} />
                            </div>
                            <GlitchBurst
                                as="h1"
                                every={[5, 11]}
                                className="mt-5 max-w-[20ch] text-[40px] leading-[0.98] font-medium tracking-[-0.035em] text-balance sm:text-6xl xl:text-7xl"
                            >
                                {p ? <DecodeText text={p.headline} duration={1100} /> : '\u00a0'}
                            </GlitchBurst>
                            <p className="mt-6 max-w-[60ch] text-[17px] text-zinc-400 lg:text-lg">{p?.intro ?? ''}</p>
                            {p?.focus?.length ? (
                                <ul className="mt-7 grid max-w-3xl gap-2 text-[15px] text-zinc-300 sm:grid-cols-3">
                                    {p.focus.map((line, i) => (
                                        <li key={line} className="border-t border-white/10 pt-2.5">
                                            <span className="mr-2 font-mono text-[10.5px] text-[#ff3b30]">{`0x${(i * 16).toString(16).toUpperCase().padStart(2, '0')}`}</span>
                                            {line}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                        <div className="hidden max-w-xl lg:block xl:max-w-none">
                            <SignalPanel raw={signal.raw} cache={signal.cache} serverMs={signal.serverMs} path="/api/stack" />
                        </div>
                    </section>

                    <TearDivider address="0x10" label="Stack · GET /api/stack" />
                    <section id="stack" className="relative z-10 pt-8">
                        <GlitchBurst
                            as="h2"
                            every={[8, 16]}
                            className="max-w-[24ch] text-3xl leading-[1.02] font-medium tracking-[-0.03em] text-balance sm:text-5xl"
                        >
                            <DecodeText text="What I work with, and what it does when something happens" duration={900} />
                        </GlitchBurst>
                        <div className="mt-8">
                            {stack && flows.data ? (
                                <>
                                    <CircuitBoard layers={stack.data} flows={flows.data ?? []} />
                                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-white/15 bg-[#050506] px-4 py-3">
                                        <p className="font-mono text-[12.5px] text-zinc-400">
                                            This board is not markup. It is{' '}
                                            <a href="/docs/api" className="jitter text-zinc-100 underline decoration-white/25 underline-offset-4">
                                                GET /api/stack
                                            </a>{' '}
                                            and{' '}
                                            <a href="/docs/api" className="jitter text-zinc-100 underline decoration-white/25 underline-offset-4">
                                                GET /api/flows
                                            </a>
                                            : {stack.meta.items} tools, {flows.data.length} scenarios.
                                        </p>
                                        <a
                                            href="#made"
                                            className="jitter rounded-sm bg-white px-3.5 py-2 font-mono text-[12px] tracking-[0.08em] text-black uppercase hover:bg-[#ff3b30]"
                                        >
                                            How this was made ↓
                                        </a>
                                    </div>
                                </>
                            ) : (
                                <p className="font-mono text-sm text-zinc-500">
                                    reading /api/stack <span className="blink inline-block h-3.5 w-2 translate-y-0.5 bg-zinc-400" />
                                </p>
                            )}
                        </div>
                    </section>

                    <TearDivider address="0x18" label="Machine · how this page was made" />
                    <section id="made" className="relative z-10 scroll-mt-16 pt-8">
                        <GlitchBurst
                            as="h2"
                            every={[7, 14]}
                            className="max-w-[22ch] text-3xl leading-[1.02] font-medium tracking-[-0.03em] text-balance sm:text-5xl"
                        >
                            <DecodeText text="How the map above was made" duration={900} />
                        </GlitchBurst>
                        <p className="mt-4 mb-8 max-w-[70ch] text-zinc-400">
                            The moment this section came into view, the page built the stack it runs on, sent the request behind the map, read the
                            trace that request left behind, and started replaying it slowly. What the browser measured, what the server did, the SQL
                            with the database's own plan, and the lines of deployed code each step came from.
                        </p>
                        <Anatomy />
                    </section>

                    <TearDivider address="0x20" label="Systems · GET /api/systems" />
                    <section id="systems" className="relative z-10 pt-8">
                        <GlitchBurst
                            as="h2"
                            every={[9, 18]}
                            className="max-w-[24ch] text-3xl leading-[1.02] font-medium tracking-[-0.03em] text-balance sm:text-5xl"
                        >
                            <DecodeText text="What I have built, and the problem each piece answers" duration={900} />
                        </GlitchBurst>
                        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {(systems.data ?? []).map((system, index) => (
                                <article
                                    key={system.slug}
                                    className="group relative overflow-hidden rounded-sm border border-white/10 bg-[#070708] p-5 transition-colors hover:border-white/30 sm:p-6"
                                >
                                    <span className="dither pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" />
                                    <div className="relative flex items-baseline justify-between gap-3 font-mono text-[10.5px] tracking-[0.12em] text-zinc-600 uppercase">
                                        <span className="text-[#ff3b30]">{`0x${(index * 16).toString(16).toUpperCase().padStart(3, '0')}`}</span>
                                        <span>{system.slug}</span>
                                    </div>
                                    <h3 className="split relative mt-3 text-xl leading-snug font-medium" data-text={system.title}>
                                        {system.title}
                                    </h3>
                                    <p className="relative mt-1.5 text-[14.5px] text-zinc-400">{system.summary}</p>
                                    <dl className="relative mt-4 grid grid-cols-[68px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[14px]">
                                        <dt className="font-mono text-[10px] tracking-[0.1em] text-zinc-500 uppercase">Problem</dt>
                                        <dd className="text-zinc-400">{system.problem}</dd>
                                        <dt className="font-mono text-[10px] tracking-[0.1em] text-zinc-500 uppercase">How</dt>
                                        <dd className="text-zinc-200">{system.approach}</dd>
                                        {system.lesson && (
                                            <>
                                                <dt className="font-mono text-[10px] tracking-[0.1em] text-zinc-500 uppercase">Learned</dt>
                                                <dd className="text-zinc-400">{system.lesson}</dd>
                                            </>
                                        )}
                                    </dl>
                                    <div className="mt-4 flex flex-wrap gap-1.5">
                                        {system.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10.5px] text-zinc-500"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    {system.scale && <p className="relative mt-3 font-mono text-[11px] text-zinc-300">{system.scale}</p>}
                                </article>
                            ))}
                        </div>
                    </section>

                    <TearDivider address="0x30" label="Rules · GET /api/decisions" />
                    <section id="rules" className="relative z-10 pt-8">
                        <GlitchBurst
                            as="h2"
                            every={[9, 18]}
                            className="max-w-[24ch] text-3xl leading-[1.02] font-medium tracking-[-0.03em] text-balance sm:text-5xl"
                        >
                            <DecodeText text="How I run servers, and what taught me each rule" duration={900} />
                        </GlitchBurst>
                        <div className="mt-8 grid gap-x-12 sm:grid-cols-2 xl:grid-cols-3">
                            {(decisions.data ?? []).map((decision, index) => (
                                <div key={decision.id} className="border-b border-white/8 py-4">
                                    <h3 className="text-[15px] font-medium">
                                        <span className="mr-2 font-mono text-[10.5px] text-[#ff3b30]">{`r${String(index).padStart(2, '0')}`}</span>
                                        {decision.title}
                                    </h3>
                                    <p className="mt-1.5 text-[14px] text-zinc-400">{decision.body}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <TearDivider address="0x40" label="Contact" />
                    <section id="contact" className="relative z-10 flex flex-wrap items-end justify-between gap-6 pt-8">
                        <div>
                            <h2 className="max-w-[20ch] text-2xl leading-tight font-medium tracking-tight text-balance sm:text-3xl">
                                <DecodeText text="Want to see a different request?" duration={800} />
                            </h2>
                            <p className="mt-3 max-w-[46ch] text-zinc-400">
                                Write with an endpoint or a problem. If it is interesting it becomes the next thing traced here: a write under a lock,
                                a rejected token, the request after the rate limit, a job that outlives its response.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(p?.links ?? []).map((link, i) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    className={`jitter rounded-sm px-4 py-2.5 font-mono text-[12px] tracking-[0.08em] uppercase ${
                                        i === 0 ? 'bg-white text-black hover:bg-[#ff3b30]' : 'border border-white/20 hover:border-white/50'
                                    }`}
                                >
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    </section>

                    <footer className="mt-16 flex flex-wrap justify-between gap-3 border-t border-white/8 pt-5 font-mono text-[11px] text-zinc-600">
                        <span>Every number on this page came from the API, live.</span>
                        <span>{p?.location}</span>
                    </footer>
                </main>
            </div>
        </>
    );
}
