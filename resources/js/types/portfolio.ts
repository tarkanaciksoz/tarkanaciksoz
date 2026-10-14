export type StackItem = {
    id: number;
    name: string;
    usage: string | null;
    /** Services using this tool, when counted; null means not counted. */
    services: number | null;
    /** Public path of the brand mark, or null when the tool has none. */
    icon: string | null;
    why: string;
    instead_of: string | null;
};

export type StackLayer = {
    slug: string;
    name: string;
    tagline: string;
    glyph: string;
    items: StackItem[];
};

export type System = {
    slug: string;
    title: string;
    summary: string;
    problem: string;
    approach: string;
    lesson: string | null;
    tags: string[];
    scale: string | null;
};

export type Decision = { id: number; title: string; body: string };

export type Profile = {
    name: string;
    role: string;
    location: string;
    headline: string;
    intro: string;
    focus: string[];
    links: { label: string; href: string }[];
};

export type SourceExcerpt = {
    file: string;
    vendor: boolean;
    line_start: number;
    line_end: number;
    excerpt: { n: number; text: string }[];
    commit: string | null;
};

export type Span = {
    id: string;
    parent_id: string | null;
    name: string;
    why: string | null;
    kind: string;
    start_ms: number;
    duration_ms: number;
    meta: Record<string, unknown> & {
        sql?: string;
        bindings?: unknown[];
        connection?: string;
        driver?: string;
        explain?: Record<string, unknown>[] | null;
    };
    source: SourceExcerpt | null;
};

export type ClientTiming = {
    dns_ms: number;
    tcp_ms: number;
    tls_ms: number;
    ttfb_ms: number;
    download_ms: number;
    total_ms: number;
    transfer_size?: number | null;
    protocol?: string | null;
};

export type Trace = {
    id: string;
    method: string;
    path: string;
    status: number;
    commit: string | null;
    runtime: { php: string; laravel: string; server: string };
    started_at: string;
    duration_ms: number;
    phases: { name: string; ms: number }[];
    spans: Span[];
    leaf_ms: number;
    unattributed_ms: number;
    client: ClientTiming | null;
};

export type StackResponse = {
    data: StackLayer[];
    meta: { layers: number; items: number; counted: number; cache: 'hit' | 'miss'; ttl_seconds: number };
};

export type FlowStep = { item_id: number | null; tool: string; note: string; hot: boolean };

export type Flow = { slug: string; title: string; summary: string; steps: FlowStep[] };
