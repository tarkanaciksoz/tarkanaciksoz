import type { StackItem, StackLayer } from '@/types/portfolio';
import { useMemo, useState } from 'react';
import { DecodeText } from '../signal/decode-text';

type Element = { item: StackItem; layer: StackLayer; group: number; number: number; symbol: string };

/**
 * Two-letter symbols, assigned the way chemistry does it: first letter plus the
 * next free letter, preferring an internal capital (ClickHouse → Ch), never reused.
 */
function assignSymbols(layers: StackLayer[]): Map<number, string> {
    const used = new Set<string>();
    const out = new Map<number, string>();

    for (const layer of layers) {
        for (const item of layer.items) {
            const chars = item.name.replace(/[^A-Za-z0-9]/g, '');
            const first = chars[0]?.toUpperCase() ?? '?';
            const rest = chars.slice(1);
            const capitals = [...rest].filter((c) => /[A-Z]/.test(c));
            const order = [rest[0], ...capitals, ...rest.slice(1)].filter(Boolean) as string[];

            let symbol = first;
            for (const c of order) {
                const candidate = first + c.toLowerCase();
                if (!used.has(candidate)) {
                    symbol = candidate;
                    break;
                }
            }
            used.add(symbol);
            out.set(item.id, symbol);
        }
    }
    return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The stack as a periodic table: every layer a group, every tool an element with a
 * number, a symbol and a weight (the services that use it). The key box shows the
 * selected element, the way a real table explains its own legend.
 */
export function PeriodicStack({ layers }: { layers: StackLayer[] }) {
    const elements = useMemo(() => {
        const symbols = assignSymbols(layers);
        let n = 0;
        return layers.map((layer, group) =>
            layer.items.map<Element>((item) => ({ item, layer, group: group + 1, number: ++n, symbol: symbols.get(item.id) ?? '?' })),
        );
    }, [layers]);

    const all = elements.flat();
    const [selectedId, setSelectedId] = useState<number>(() => layers[2]?.items[1]?.id ?? all[0]?.item.id);
    const selected = all.find((e) => e.item.id === selectedId) ?? all[0];
    const max = Math.max(1, ...all.map((e) => e.item.services ?? 0));

    return (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-12">
            <div className="min-w-0">
                <div className="grid gap-6 lg:grid-cols-7 lg:gap-2">
                    {elements.map((group, gi) => (
                        <div key={layers[gi].slug} className="min-w-0">
                            <div className="mb-2 border-b border-white/15 pb-1.5">
                                <div className="font-mono text-[10px] text-[#ff3b30]">{`G${gi + 1}`}</div>
                                <div className="truncate text-[12.5px] font-medium text-zinc-200">{layers[gi].name}</div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-1">
                                {group.map((el) => {
                                    const active = el.item.id === selected?.item.id;
                                    const counted = el.item.services !== null;
                                    const weight = counted ? (el.item.services as number) / max : 0;

                                    return (
                                        <button
                                            key={el.item.id}
                                            type="button"
                                            aria-pressed={active}
                                            aria-label={`${el.item.name}, element ${el.number}`}
                                            onClick={() => setSelectedId(el.item.id)}
                                            className={`group relative aspect-square min-w-0 overflow-hidden rounded-[2px] border p-1.5 text-left transition-colors lg:aspect-[1/0.92] ${
                                                active
                                                    ? 'border-white bg-white text-black'
                                                    : `bg-[#060607] text-zinc-100 hover:border-[#ff3b30] ${counted ? 'border-white/20' : 'border-dashed border-white/15'}`
                                            }`}
                                        >
                                            {!active && (
                                                <span
                                                    className="dither pointer-events-none absolute inset-0"
                                                    style={{ opacity: counted ? 0.1 + weight * 0.75 : 0.05 }}
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <span className="relative flex items-start justify-between font-mono text-[9.5px] leading-none">
                                                <span className={active ? 'text-zinc-600' : 'text-zinc-500'}>{pad(el.number)}</span>
                                                <span className={active ? 'text-[#ff3b30]' : counted ? 'text-[#ff3b30]' : 'text-zinc-700'}>
                                                    {counted ? el.item.services : '—'}
                                                </span>
                                            </span>
                                            <span
                                                className="split relative mt-1 block text-center text-[22px] leading-none font-medium tracking-[-0.02em] sm:text-[26px] lg:mt-2 lg:text-[28px]"
                                                data-text={el.symbol}
                                            >
                                                {el.symbol}
                                            </span>
                                            <span
                                                className={`relative mt-1 block truncate text-center text-[9.5px] leading-tight lg:mt-2 lg:text-[10.5px] ${
                                                    active ? 'text-zinc-700' : 'text-zinc-400'
                                                }`}
                                            >
                                                {el.item.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10.5px] text-zinc-600">
                    <span>
                        <span className="text-zinc-400">01</span> element number
                    </span>
                    <span>
                        <span className="text-[#ff3b30]">39</span> services using it
                    </span>
                    <span>denser dither = more services</span>
                    <span className="border border-dashed border-white/20 px-1">dashed</span>
                    <span>= not counted</span>
                </div>
            </div>

            {selected && (
                <aside className="scanlines relative overflow-hidden rounded-[2px] border border-white/20 bg-[#050506] xl:sticky xl:top-20">
                    <div className="border-b border-white/10 px-5 py-2 font-mono text-[10.5px] tracking-[0.14em] text-zinc-500 uppercase">
                        <span className="text-[#ff3b30]">▌</span> Key · G{selected.group} {selected.layer.name}
                    </div>
                    <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-5 p-5">
                        <div className="relative aspect-square border border-white bg-white p-2 text-black">
                            <div className="flex justify-between font-mono text-[11px] leading-none">
                                <span>{pad(selected.number)}</span>
                                <span className="text-[#ff3b30]">{selected.item.services ?? '—'}</span>
                            </div>
                            <div className="mt-3 text-center text-[52px] leading-none font-medium tracking-[-0.03em]">
                                <DecodeText key={selected.item.id} text={selected.symbol} duration={360} />
                            </div>
                            <div className="mt-2 truncate text-center text-[11px] text-zinc-700">{selected.item.name}</div>
                        </div>
                        <div className="min-w-0 self-center">
                            <div className="text-xl leading-tight font-medium tracking-[-0.02em] text-zinc-50">
                                <DecodeText key={`n${selected.item.id}`} text={selected.item.name} duration={420} />
                            </div>
                            <div className="mt-2 font-mono text-[11px] leading-relaxed text-zinc-500">
                                <div>group · {selected.layer.name.toLowerCase()}</div>
                                {selected.item.usage && selected.item.usage !== `${selected.item.services} services` && (
                                    <div>in · {selected.item.usage}</div>
                                )}
                                <div>weight · {selected.item.services !== null ? `${selected.item.services} services` : 'not counted'}</div>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-white/10 px-5 py-4">
                        <p className="text-[14.5px] text-zinc-200">{selected.item.why}</p>
                        {selected.item.instead_of && (
                            <p className="mt-3 text-[13.5px] text-zinc-500">
                                <span className="text-zinc-300">Instead of:</span> {selected.item.instead_of}
                            </p>
                        )}
                    </div>
                </aside>
            )}
        </div>
    );
}
