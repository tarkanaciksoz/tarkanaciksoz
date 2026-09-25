import { hex, isSelected, maxServices, weight, type ViewProps } from './shared';

/**
 * The stack as a memory map: each layer is a segment at its own base address,
 * each tool a block allocated inside it, as wide as the number of services that use it.
 */
export function MemoryMapView({ layers, selected, onSelect }: ViewProps) {
    const max = maxServices(layers);

    return (
        <div className="font-mono">
            <div className="hidden grid-cols-[190px_minmax(0,1fr)] gap-4 border-b border-white/10 pb-2 text-[10.5px] tracking-[0.14em] text-zinc-600 uppercase sm:grid">
                <span>segment · range</span>
                <span className="flex justify-between">
                    <span>allocation</span>
                    <span>1 unit = 1 service · dashed = not counted</span>
                </span>
            </div>

            {layers.map((layer, li) => {
                const base = li * 0x100;
                let cursor = base;

                return (
                    <div
                        key={layer.slug}
                        className="grid gap-2 border-b border-white/8 py-3 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-stretch sm:gap-4"
                    >
                        <div className="flex items-baseline gap-2 sm:block">
                            <div className="text-[10.5px] text-[#ff3b30]">{hex(base)}</div>
                            <div className="font-sans text-[15px] leading-tight font-medium text-zinc-100 sm:mt-1">{layer.name}</div>
                            <div className="text-[10.5px] text-zinc-600 sm:mt-1">
                                {hex(base)}–{hex(base + 0xff)}
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-wrap gap-px border border-white/10 sm:flex-nowrap">
                            {layer.items.map((item) => {
                                const w = weight(item, max);
                                const addr = cursor;
                                cursor += Math.max(8, Math.round(w * 0x40));
                                const active = isSelected(selected, item);
                                const counted = item.services !== null;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => onSelect(layer, item)}
                                        style={{ flexGrow: 0.6 + w * 1.4 }}
                                        className={`group relative min-h-[58px] min-w-0 basis-[calc(50%-1px)] overflow-hidden px-2.5 py-2 text-left outline-offset-[-1px] transition-colors sm:basis-0 ${
                                            active ? 'bg-white text-black' : 'bg-[#060607] text-zinc-200 hover:bg-[#0e0e10]'
                                        } ${counted ? '' : 'outline-1 -outline-offset-4 outline-white/15 outline-dashed'}`}
                                    >
                                        {!active && (
                                            <span
                                                className="dither pointer-events-none absolute inset-0"
                                                style={{ opacity: counted ? 0.15 + w * 0.7 : 0.08 }}
                                                aria-hidden="true"
                                            />
                                        )}
                                        <span
                                            className={`relative block text-[10px] ${active ? 'text-zinc-600' : 'text-zinc-600 group-hover:text-[#ff3b30]'}`}
                                        >
                                            {hex(addr)}
                                        </span>
                                        <span className="relative mt-1 block truncate font-sans text-[13px] leading-tight font-medium">
                                            {item.name}
                                        </span>
                                        <span className={`relative mt-0.5 block text-[10px] ${active ? 'text-zinc-700' : 'text-zinc-500'}`}>
                                            {counted ? `${item.services} svc` : 'not counted'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
