import { Anatomy } from '@/components/portfolio/anatomy';
import { StackBoard } from '@/components/portfolio/stack-board';
import { apiGet } from '@/lib/api';
import type { Decision, Profile, StackResponse, System } from '@/types/portfolio';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';

type Tab = 'stack' | 'anatomy';

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
    const [tab, setTab] = useState<Tab>('stack');
    const profile = useApi<Profile>('/api/profile');
    const [stack, setStack] = useState<StackResponse | null>(null);
    const systems = useApi<System[]>('/api/systems');
    const decisions = useApi<Decision[]>('/api/decisions');

    useEffect(() => {
        apiGet<StackResponse>('/api/stack')
            .then((result) => setStack(result.body))
            .catch(() => undefined);
    }, []);

    const p = profile.data;

    return (
        <>
            <Head title={p ? `${p.name} · ${p.role}` : 'Backend & infrastructure engineer'} />

            <div className="min-h-screen bg-black text-zinc-100 selection:bg-white selection:text-black">
                <header className="sticky top-0 z-30 border-b border-white/8 bg-black/70 backdrop-blur">
                    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
                        <a href="#top" className="text-sm font-medium">
                            {p?.name ?? '—'}
                            <span className="ml-2 hidden font-mono text-[11px] text-zinc-500 sm:inline">backend · infrastructure</span>
                        </a>
                        <nav className="flex items-center gap-4 text-[13px] text-zinc-400 sm:gap-6">
                            <a href="#systems" className="hover:text-zinc-100">
                                Systems
                            </a>
                            <a href="#rules" className="hover:text-zinc-100">
                                Rules
                            </a>
                            <a href="/docs/api" className="hover:text-zinc-100">
                                API
                            </a>
                            <a href="#contact" className="hover:text-zinc-100">
                                Contact
                            </a>
                        </nav>
                    </div>
                </header>

                <main id="top" className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
                    <section className="pt-14 pb-8 sm:pt-20">
                        <div className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
                            {p?.role ?? 'Backend engineer'} · {p?.location ?? 'Istanbul'}
                        </div>
                        <h1 className="mt-4 max-w-[19ch] text-3xl leading-[1.08] font-medium tracking-tight text-balance sm:text-5xl">
                            {p?.headline ?? 'I build and run the backends behind consumer mobile apps.'}
                        </h1>
                        <p className="mt-5 max-w-[58ch] text-[17px] text-zinc-400">{p?.intro ?? ''}</p>
                        {p?.focus?.length ? (
                            <ul className="mt-6 grid gap-2 text-[15px] text-zinc-300 sm:grid-cols-3">
                                {p.focus.map((line) => (
                                    <li key={line} className="border-t border-white/10 pt-2.5">
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        ) : null}

                        <div className="mt-8 inline-flex overflow-hidden rounded-lg border border-white/12">
                            {(
                                [
                                    ['stack', 'What I work with'],
                                    ['anatomy', 'How this page is served'],
                                ] as [Tab, string][]
                            ).map(([key, label], i) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === key}
                                    onClick={() => setTab(key)}
                                    className={`px-3 py-2.5 text-[13px] font-medium transition-colors sm:px-4 sm:text-sm ${i === 0 ? 'border-r border-white/12' : ''} ${
                                        tab === key ? 'bg-white/10 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </section>

                    {tab === 'stack' ? (
                        <section>
                            {stack ? (
                                <>
                                    <StackBoard layers={stack.data} rows={stack.meta.items} />
                                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0a0a0b] px-4 py-3">
                                        <p className="font-mono text-[12.5px] text-zinc-400">
                                            This map is not markup. It is{' '}
                                            <a href="/docs/api" className="text-zinc-100 underline decoration-white/25 underline-offset-4">
                                                GET /api/stack
                                            </a>
                                            , {stack.meta.items} rows across {stack.meta.layers} layers.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTab('anatomy');
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm font-medium hover:border-white/30"
                                        >
                                            Watch that request
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="font-mono text-sm text-zinc-500">Loading the stack…</p>
                            )}
                        </section>
                    ) : (
                        <section>
                            <p className="mb-6 max-w-[64ch] text-zinc-400">
                                The map on the other tab is one request. Here is that request, opened up: what the browser measured, what the server
                                did, the SQL with the database's own plan, and the lines of deployed code each step came from.
                            </p>
                            <Anatomy />
                        </section>
                    )}

                    <section id="systems" className="mt-24 border-t border-white/8 pt-14 sm:mt-32">
                        <div className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Systems</div>
                        <h2 className="mt-3 max-w-[22ch] text-2xl leading-tight font-medium tracking-tight text-balance sm:text-3xl">
                            What I have built, and the problem each piece answers
                        </h2>
                        <div className="mt-8 grid gap-3 sm:grid-cols-2">
                            {(systems.data ?? []).map((system) => (
                                <article key={system.slug} className="rounded-xl border border-white/8 bg-[#0a0a0b] p-5 sm:p-6">
                                    <h3 className="text-lg leading-snug font-medium">{system.title}</h3>
                                    <p className="mt-1.5 text-[14.5px] text-zinc-400">{system.summary}</p>
                                    <dl className="mt-4 grid grid-cols-[68px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[14px]">
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
                                    {system.scale && <p className="mt-3 font-mono text-[11px] text-zinc-500">{system.scale}</p>}
                                </article>
                            ))}
                        </div>
                    </section>

                    <section id="rules" className="mt-24 border-t border-white/8 pt-14">
                        <div className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Rules</div>
                        <h2 className="mt-3 max-w-[24ch] text-2xl leading-tight font-medium tracking-tight text-balance sm:text-3xl">
                            How I run servers, and what taught me each rule
                        </h2>
                        <div className="mt-8 grid gap-x-10 sm:grid-cols-2">
                            {(decisions.data ?? []).map((decision) => (
                                <div key={decision.id} className="border-b border-white/8 py-4">
                                    <h3 className="text-[15px] font-medium">{decision.title}</h3>
                                    <p className="mt-1.5 text-[14px] text-zinc-400">{decision.body}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section id="contact" className="mt-24 flex flex-wrap items-end justify-between gap-6 border-t border-white/8 pt-14">
                        <div>
                            <h2 className="max-w-[20ch] text-2xl leading-tight font-medium tracking-tight text-balance sm:text-3xl">
                                Want to see a different request?
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
                                    className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
                                        i === 0 ? 'bg-white text-black hover:bg-zinc-200' : 'border border-white/12 hover:border-white/30'
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
