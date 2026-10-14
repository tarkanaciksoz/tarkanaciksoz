import { ms } from '@/lib/api';
import type { ClientTiming, SourceExcerpt, Trace } from '@/types/portfolio';
import type { ReactNode } from 'react';
import { crc32, HexDump } from '../signal/hex-dump';
import { NoiseField } from '../signal/noise-field';
import type { Step } from './steps';

export type RunData = { trace: Trace; client: ClientTiming | null; raw: string; cache: string | null };

/** A titled block of proof: what the claim on the left rests on. */
function Frame({ label, aside, children, foot }: { label: ReactNode; aside?: ReactNode; children: ReactNode; foot?: ReactNode }) {
    return (
        <figure className="flex min-h-0 flex-col border border-white/10 bg-[#08080a]">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-4 py-2 font-mono text-[12px] text-zinc-400">
                <span className="min-w-0 break-all">{label}</span>
                {aside}
            </figcaption>
            <div className="min-h-0 overflow-auto">{children}</div>
            {foot && <div className="border-t border-white/10 px-4 py-2 font-mono text-[11.5px] text-zinc-600">{foot}</div>}
        </figure>
    );
}

function Lines({ lines }: { lines: { n: number; text: string; hit: boolean }[] }) {
    return (
        <pre className="py-2 font-mono text-[12px] leading-relaxed">
            {lines.map((line) => (
                <div
                    key={line.n}
                    className={`grid grid-cols-[44px_minmax(0,1fr)] ${line.hit ? 'bg-[#ff3b30]/10 shadow-[inset_2px_0_0_#ff3b30]' : ''}`}
                >
                    <span className={`pr-3 text-right select-none ${line.hit ? 'text-[#ff3b30]' : 'text-zinc-600'}`}>{line.n}</span>
                    <span className={`pr-4 whitespace-pre ${line.hit ? 'text-zinc-100' : 'text-zinc-400'}`}>{line.text || ' '}</span>
                </div>
            ))}
        </pre>
    );
}

function Code({ source }: { source: SourceExcerpt }) {
    return (
        <Frame
            label={source.file}
            aside={
                source.vendor ? (
                    <span className="text-zinc-500">vendor</span>
                ) : (
                    source.commit && <span className="border border-white/25 px-1.5 text-zinc-200">{source.commit}</span>
                )
            }
            foot="Read from the checkout that served this request, not pasted in."
        >
            <Lines lines={source.excerpt.map((l) => ({ n: l.n, text: l.text, hit: l.n >= source.line_start && l.n <= source.line_end }))} />
        </Frame>
    );
}

function Sql({ step }: { step: Step }) {
    const plan = step.explain ?? [];
    return (
        <Frame
            label="the statement, and the database's own plan for it"
            foot={step.source ? `called from ${step.source.file}:${step.source.line_start}` : 'issued by the framework'}
        >
            <pre className="px-4 py-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-zinc-100">{step.sql}</pre>
            {plan.length > 0 && (
                <table className="mx-4 mb-3 w-max min-w-[calc(100%-2rem)] border-collapse font-mono text-[11.5px]">
                    <thead>
                        <tr>
                            {Object.keys(plan[0]).map((key) => (
                                <th key={key} className="pr-4 pb-1 text-left font-normal text-zinc-500">
                                    {key}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {plan.map((row, r) => (
                            <tr key={r}>
                                {Object.values(row).map((value, c) => (
                                    <td key={c} className="border-t border-white/8 py-1.5 pr-4 whitespace-nowrap text-zinc-300">
                                        {String(value)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Frame>
    );
}

/** The trace record as GET /api/traces/{id} returned it, with this step's line lit. */
function TraceRecord({ trace, focus }: { trace: Trace; focus: string }) {
    const lines: { text: string; hit: boolean }[] = [
        { text: `"duration_ms": ${trace.duration_ms},`, hit: false },
        { text: '"phases": [', hit: false },
        ...trace.phases.map((p, i) => ({
            text: `    { "name": "${p.name}", "ms": ${p.ms} }${i < trace.phases.length - 1 ? ',' : ''}`,
            hit: focus === `phase-${p.name}`,
        })),
        { text: '],', hit: false },
        { text: `"leaf_ms": ${trace.leaf_ms},`, hit: false },
        { text: `"unattributed_ms": ${trace.unattributed_ms},`, hit: focus === 'unattributed' },
    ];
    return (
        <Frame label={`GET /api/traces/${trace.id}`} foot="The same record this view was drawn from.">
            <Lines lines={lines.map((l, i) => ({ n: i + 1, ...l }))} />
        </Frame>
    );
}

function Timing({ client, focus }: { client: ClientTiming; focus: string }) {
    const rows: [string, string, boolean][] = [
        ['domainLookup', `${ms(client.dns_ms)} ms`, focus === 'dns'],
        ['connect (TCP)', `${ms(client.tcp_ms)} ms`, focus === 'conn'],
        ['secureConnection (TLS)', `${ms(client.tls_ms)} ms`, focus === 'conn'],
        ['protocol', client.protocol ?? 'n/a', focus === 'conn'],
        ['responseStart', `${ms(client.ttfb_ms)} ms after the request left`, focus === 'wire'],
        ['transferSize', client.transfer_size ? `${client.transfer_size.toLocaleString()} bytes` : 'n/a', false],
    ];
    return (
        <Frame label="performance.getEntriesByType('resource')" foot="Measured by your browser, then posted to the trace under the same id.">
            <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-6 px-4 py-3 font-mono text-[12.5px]">
                {rows.map(([k, v, hit]) => (
                    <div key={k} className="contents">
                        <dt className={`py-1 ${hit ? 'text-[#ff3b30]' : 'text-zinc-500'}`}>{k}</dt>
                        <dd className={`py-1 ${hit ? 'text-zinc-50' : 'text-zinc-300'}`}>{v}</dd>
                    </div>
                ))}
            </dl>
        </Frame>
    );
}

function Fetch({ data }: { data: RunData }) {
    const lines = [
        "const response = await fetch('/api/stack', {",
        "    headers: { Accept: 'application/json' },",
        '});',
        '',
        `response.status                       // ${data.trace.status}`,
        `response.headers.get('X-Trace-Id')    // ${data.trace.id}`,
        `response.headers.get('Cache-Status')  // ${data.cache ?? 'none'}`,
    ];
    return (
        <Frame label="resources/js/lib/api.ts" foot="The trace id in the response header is how this view found the record.">
            <Lines lines={lines.map((text, i) => ({ n: i + 1, text, hit: i >= 4 }))} />
        </Frame>
    );
}

function Wait({ data }: { data: RunData }) {
    const ttfb = data.client?.ttfb_ms ?? data.trace.duration_ms;
    const server = Math.min(ttfb, data.trace.duration_ms);
    const share = ttfb ? server / ttfb : 1;
    return (
        <Frame label="time to first byte, split" foot="The server owns only the middle of the wait; the rest is distance.">
            <div className="px-4 py-5">
                <div className="flex h-3 w-full">
                    <span className="h-full bg-white/20" style={{ width: `${((1 - share) / 2) * 100}%` }} />
                    <span className="h-full bg-zinc-100" style={{ width: `${share * 100}%` }} />
                    <span className="h-full bg-white/20" style={{ width: `${((1 - share) / 2) * 100}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-3 font-mono text-[12.5px] text-zinc-400">
                    <span>out and back: {ms(ttfb - server)} ms</span>
                    <span className="text-zinc-100">server: {ms(server)} ms</span>
                </div>
            </div>
        </Frame>
    );
}

function Body({ raw }: { raw: string }) {
    const bytes = new TextEncoder().encode(raw).length;
    return (
        <Frame label={`response body, ${bytes.toLocaleString()} bytes`} aside={<span className="text-zinc-200">crc32 {crc32(raw)}</span>}>
            <div className="px-4 py-3">
                <HexDump source={raw} rows={7} />
            </div>
        </Frame>
    );
}

/** What the claim about one step rests on: real code, real SQL, real timings, real bytes. */
export function Evidence({ step, data }: { step: Step; data: RunData }) {
    if (step.sql) return <Sql step={step} />;
    if (step.source) return <Code source={step.source} />;

    switch (step.key) {
        case 'fetch':
            return <Fetch data={data} />;
        case 'dns':
        case 'conn':
            return data.client ? <Timing client={data.client} focus={step.key} /> : null;
        case 'wire':
            return <Wait data={data} />;
        case 'back':
            return <Body raw={data.raw} />;
        case 'unattributed': {
            const share = Math.min(0.9, step.ms / Math.max(data.trace.duration_ms, 0.001));
            return (
                <div className="grid gap-3">
                    <div className="relative h-20 overflow-hidden border border-white/10">
                        <NoiseField className="absolute inset-0 h-full w-full" density={0.06 + share * 0.6} />
                    </div>
                    <TraceRecord trace={data.trace} focus={step.key} />
                </div>
            );
        }
        default:
            return <TraceRecord trace={data.trace} focus={step.key} />;
    }
}
