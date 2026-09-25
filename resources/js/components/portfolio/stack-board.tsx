import type { StackItem, StackLayer } from '@/types/portfolio';
import { useState } from 'react';
import { DecodeText } from '../signal/decode-text';
import { Glyph } from './glyph';

type Selection = { layer: StackLayer; item: StackItem } | null;

export function StackBoard({ layers, rows }: { layers: StackLayer[]; rows: number }) {
    const [selected, setSelected] = useState<Selection>(() => (layers[2]?.items[1] ? { layer: layers[2], item: layers[2].items[1] } : null));

    const indexOf = (layer: StackLayer, item: StackItem) =>
        layers.slice(0, layers.indexOf(layer)).reduce((n, l) => n + l.items.length, 0) + layer.items.indexOf(item) + 1;

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:gap-10">
            <div className="border-t border-white/8">
                {layers.map((layer) => {
                    const on = selected?.layer.slug === layer.slug;
                    return (
                        <div
                            key={layer.slug}
                            className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 border-b border-white/8 py-4 sm:grid-cols-[96px_170px_minmax(0,1fr)] sm:items-center sm:gap-6"
                        >
                            <Glyph kind={layer.glyph} active={on} className="w-14 sm:w-24" />
                            <div className="min-w-0">
                                <div className="text-sm leading-tight font-medium text-zinc-100">{layer.name}</div>
                                <div className="mt-0.5 font-mono text-[10.5px] leading-snug text-zinc-500">{layer.tagline}</div>
                                <div className="mt-0.5 font-mono text-[10.5px] text-zinc-600">{layer.items.length} rows</div>
                            </div>
                            <div className="col-span-2 flex min-w-0 flex-wrap gap-1.5 sm:col-span-1">
                                {layer.items.map((item) => {
                                    const active = selected?.item.id === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => setSelected({ layer, item })}
                                            className={`rounded-sm border px-2 py-1 text-left text-[11.5px] leading-tight font-medium transition-colors ${
                                                active
                                                    ? 'border-white bg-white text-black'
                                                    : 'border-white/15 bg-transparent text-zinc-200 hover:border-[#ff3b30] hover:text-white'
                                            }`}
                                        >
                                            {item.name}
                                            {item.usage && (
                                                <span className={`ml-1.5 font-mono text-[10px] ${active ? 'text-zinc-600' : 'text-zinc-500'}`}>
                                                    {item.usage}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {selected && (
                <aside className="scanlines relative overflow-hidden rounded-sm border border-white/15 bg-[#050506] p-5 lg:sticky lg:top-20">
                    <div className="font-mono text-[10.5px] tracking-[0.14em] text-zinc-500 uppercase">
                        <span className="text-[#ff3b30]">▌</span> Layer · {selected.layer.name}
                    </div>
                    <h3 key={selected.item.id} className="mt-2 text-2xl leading-tight font-medium tracking-[-0.02em] text-zinc-50">
                        <DecodeText text={selected.item.name} duration={420} />
                    </h3>
                    {selected.item.usage && <div className="mt-1 font-mono text-xs text-zinc-400">in {selected.item.usage}</div>}
                    <p className="mt-3 text-sm text-zinc-200">{selected.item.why}</p>
                    {selected.item.instead_of && (
                        <p className="mt-3 border-t border-white/8 pt-3 text-[13px] text-zinc-400">
                            <span className="font-medium text-zinc-200">Instead of:</span> {selected.item.instead_of}
                        </p>
                    )}
                    <div className="mt-4 font-mono text-[11px] text-zinc-600">
                        row {indexOf(selected.layer, selected.item)} of {rows} · GET /api/stack
                    </div>
                </aside>
            )}
        </div>
    );
}
