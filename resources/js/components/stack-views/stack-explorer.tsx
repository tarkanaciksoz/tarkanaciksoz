import type { StackItem, StackLayer } from '@/types/portfolio';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardView } from './board';
import { ExplodedView } from './exploded';
import { LogicAnalyzerView } from './logic-analyzer';
import { MemoryMapView } from './memory-map';
import type { Selection, ViewProps } from './shared';
import { ShellTreeView } from './shell-tree';
import { ToolDetail } from './tool-detail';

type ViewKey = 'board' | 'memory' | 'signal' | 'shell' | 'stack';

const VIEWS: { key: ViewKey; label: string; hint: string; render: (p: ViewProps) => React.ReactNode }[] = [
    { key: 'memory', label: 'memory', hint: 'segments and allocations', render: (p) => <MemoryMapView {...p} /> },
    { key: 'signal', label: 'signal', hint: 'a logic analyser capture', render: (p) => <LogicAnalyzerView {...p} /> },
    { key: 'shell', label: 'shell', hint: 'tree over /stack', render: (p) => <ShellTreeView {...p} /> },
    { key: 'stack', label: 'stack', hint: 'an exploded tower', render: (p) => <ExplodedView {...p} /> },
    { key: 'board', label: 'board', hint: 'rows and chips', render: (p) => <BoardView {...p} /> },
];

const STORAGE_KEY = 'glassbox:stack-view';

function initialView(): ViewKey {
    if (typeof window === 'undefined') return 'memory';
    const fromUrl = new URLSearchParams(window.location.search).get('view') as ViewKey | null;
    if (fromUrl && VIEWS.some((v) => v.key === fromUrl)) return fromUrl;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY) as ViewKey | null;
        if (stored && VIEWS.some((v) => v.key === stored)) return stored;
    } catch {
        /* storage may be blocked; fall back to the default */
    }
    return 'memory';
}

/**
 * One response, several projections. The data never changes between views —
 * only how it is drawn — which is the point a backend person would make about an API.
 */
export function StackExplorer({ layers, rows }: { layers: StackLayer[]; rows: number }) {
    const [view, setView] = useState<ViewKey>(initialView);
    const [selected, setSelected] = useState<Selection>(() => (layers[2]?.items[1] ? { layer: layers[2], item: layers[2].items[1] } : null));

    const choose = useCallback((key: ViewKey) => {
        setView(key);
        try {
            window.localStorage.setItem(STORAGE_KEY, key);
        } catch {
            /* ignore */
        }
        const url = new URL(window.location.href);
        url.searchParams.set('view', key);
        window.history.replaceState(null, '', url);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
            const n = Number(e.key);
            if (n >= 1 && n <= VIEWS.length) choose(VIEWS[n - 1].key);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [choose]);

    const onSelect = useCallback((layer: StackLayer, item: StackItem) => setSelected({ layer, item }), []);

    const index = useMemo(() => {
        if (!selected) return 0;
        return (
            layers.slice(0, layers.indexOf(selected.layer)).reduce((n, l) => n + l.items.length, 0) + selected.layer.items.indexOf(selected.item) + 1
        );
    }, [layers, selected]);

    const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex max-w-full min-w-0 items-center gap-2 font-mono text-[11.5px]">
                    <span className="shrink-0 text-zinc-600">render as</span>
                    <div className="inline-flex min-w-0 overflow-x-auto rounded-sm border border-white/15">
                        {VIEWS.map((v, i) => (
                            <button
                                key={v.key}
                                type="button"
                                aria-pressed={view === v.key}
                                onClick={() => choose(v.key)}
                                className={`shrink-0 px-2.5 py-1.5 tracking-[0.06em] whitespace-nowrap transition-colors ${i ? 'border-l border-white/15' : ''} ${
                                    view === v.key ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                <span className={view === v.key ? 'text-zinc-500' : 'text-zinc-600'}>{i + 1}</span> {v.label}
                            </button>
                        ))}
                    </div>
                </div>
                <span className="font-mono text-[11px] text-zinc-600">
                    same response, {current.hint} · keys 1–{VIEWS.length}
                </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:gap-10">
                <div className="min-w-0">{current.render({ layers, selected, onSelect })}</div>
                <ToolDetail selected={selected} index={index} total={rows} variant={view === 'shell' ? 'terminal' : 'card'} />
            </div>
        </div>
    );
}
