import type { StackItem, StackLayer } from '@/types/portfolio';
import { useState } from 'react';
import { DecodeText } from '../signal/decode-text';

/** Type size carries the data: the more services use a tool, the larger and brighter it is set. */
function tier(item: StackItem): string {
    if (item.services === null) return 'text-[15px] sm:text-[17px] text-zinc-500';
    if (item.services >= 30) return 'text-[19px] sm:text-[23px] text-zinc-50';
    if (item.services >= 10) return 'text-[17px] sm:text-[20px] text-zinc-200';
    return 'text-[15px] sm:text-[17px] text-zinc-300';
}

/**
 * The stack as an index: one row per layer, its tools set in type sized by how much
 * they are used. Selecting a tool opens its reasoning directly under its row.
 */
export function StackIndex({ layers }: { layers: StackLayer[] }) {
    const [open, setOpen] = useState<number | null>(() => layers[2]?.items[1]?.id ?? null);

    return (
        <div className="border-t border-white/10">
            {layers.map((layer, li) => {
                const selected = layer.items.find((i) => i.id === open) ?? null;

                return (
                    <div key={layer.slug} className="border-b border-white/10">
                        <div className="grid gap-3 py-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:py-6">
                            <div>
                                <div className="font-mono text-[10.5px] text-[#ff3b30]">{`0x${((li + 1) * 16).toString(16).toUpperCase().padStart(2, '0')}`}</div>
                                <div className="mt-1 text-[17px] leading-tight font-medium text-zinc-100">{layer.name}</div>
                                <div className="mt-1 font-mono text-[11px] text-zinc-600">{layer.tagline}</div>
                            </div>

                            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2.5">
                                {layer.items.map((item) => {
                                    const active = item.id === open;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            aria-expanded={active}
                                            onClick={() => setOpen(active ? null : item.id)}
                                            className={`jitter leading-tight font-medium tracking-[-0.01em] transition-colors hover:text-white ${tier(item)} ${
                                                active ? 'text-white underline decoration-[#ff3b30] decoration-2 underline-offset-[6px]' : ''
                                            }`}
                                        >
                                            {item.name}
                                            {item.services !== null && (
                                                <sup className="ml-1 font-mono text-[10px] font-normal tracking-normal text-[#ff3b30]">
                                                    {item.services}
                                                </sup>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div
                            className={`grid transition-[grid-template-rows] duration-300 ease-out ${selected ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                        >
                            <div className="overflow-hidden">
                                {selected && (
                                    <div className="grid gap-3 pb-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
                                        <div className="font-mono text-[11px] text-zinc-500">
                                            <div className="text-zinc-200">
                                                <DecodeText key={selected.id} text={selected.name} duration={380} />
                                            </div>
                                            {selected.usage && <div className="mt-1">in {selected.usage}</div>}
                                            <div className="mt-1">{selected.services !== null ? `${selected.services} services` : 'not counted'}</div>
                                        </div>
                                        <div className="max-w-[72ch] border-l-2 border-[#ff3b30] pl-4">
                                            <p className="text-[15px] text-zinc-200">{selected.why}</p>
                                            {selected.instead_of && (
                                                <p className="mt-2 text-[14px] text-zinc-500">
                                                    <span className="text-zinc-300">Instead of:</span> {selected.instead_of}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
