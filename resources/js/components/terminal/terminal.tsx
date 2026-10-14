import { apiGet } from '@/lib/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../signal/use-reduced-motion';
import { apply, commonPrefix, complete, display, isDir, resolve, type Tree } from './completion';

type Line = { id: number; kind: 'cmd' | 'out' | 'err'; text: string; who?: string; cwd?: string };
type Exchange = { command: string; output: string };
type Menu = { token: string; items: string[]; index: number };

const HISTORY_KEY = 'glassbox:terminal-history';
const HOST = 'glassbox';

/** Answered here, not by the model: what this shell can actually do. */
const HELP = [
    'This shell answers from a model, except where it can ask the real API.',
    '',
    '  curl /api/<name>     a real request to this site: stack, systems, decisions, flows, profile',
    '  ls, cd, cat, tree    look around /home/guest',
    '  whoami, uname -a     who and where',
    '  history, clear       this session',
    '',
    '  tab completes   up/down history   ctrl+c stops   esc leaves',
].join('\n');

/** A GET to the site's own API, printed the way curl -i would: status, the headers that matter, the start of the body. */
async function realCurl(path: string): Promise<string> {
    const result = await apiGet<unknown>(path);
    const body = JSON.stringify(result.body, null, 2).split('\n');
    const shown = body.slice(0, 18);
    return [
        `HTTP/1.1 ${result.status}`,
        `X-Trace-Id: ${result.traceId ?? 'none'}`,
        ...(result.cache ? [`Cache-Status: ${result.cache}`] : []),
        '',
        ...shown,
        ...(body.length > shown.length ? [`... ${body.length - shown.length} more lines`] : []),
    ].join('\n');
}

let nextId = 1;
const line = (kind: Line['kind'], text: string, extra: Partial<Line> = {}): Line => ({ id: nextId++, kind, text, ...extra });

function loadHistory(): string[] {
    try {
        return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]');
    } catch {
        return [];
    }
}

function PromptLabel({ who, cwd }: { who: string; cwd: string }) {
    return (
        <span className="shrink-0 whitespace-pre">
            <span className={who === 'guest' ? 'text-zinc-300' : 'text-[#ff3b30]'}>{who}</span>
            <span className="text-zinc-400">@{HOST}</span>
            <span className="text-zinc-400">:{cwd}</span>
            <span className="text-zinc-400">$ </span>
        </span>
    );
}

/**
 * The hero terminal. The owner's `whoami` plays first, then the visitor gets a
 * prompt of their own. Everything it prints after that comes from the shell on the
 * server, streamed as it is written; completion and history are local.
 */
export function Terminal({ owner, intro }: { owner: string; intro: string }) {
    const reduced = useReducedMotion();
    const [lines, setLines] = useState<Line[]>([]);
    const [typed, setTyped] = useState(0);
    const [ready, setReady] = useState(false);
    const [input, setInput] = useState('');
    const [cwd, setCwd] = useState('~');
    const [running, setRunning] = useState(false);
    const [menu, setMenu] = useState<Menu | null>(null);
    const [focused, setFocused] = useState(false);
    const [fs, setFs] = useState<{ home: string; tree: Tree }>({ home: '/home/guest', tree: {} });
    const history = useRef<string[]>([]);
    const cursor = useRef<number>(-1);
    const exchanges = useRef<Exchange[]>([]);
    const abort = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const whoami = 'whoami';

    useEffect(() => {
        history.current = loadHistory();
        fetch('/api/terminal/fs', { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((json) => setFs(json.data))
            .catch(() => undefined);
    }, []);

    // The owner's line types itself once; then the prompt is handed to the visitor.
    useEffect(() => {
        if (reduced) {
            setTyped(whoami.length);
            setReady(true);
            return;
        }
        let i = 0;
        let timer = window.setTimeout(function tick() {
            i += 1;
            setTyped(i);
            if (i < whoami.length) timer = window.setTimeout(tick, 70 + Math.random() * 60);
            else timer = window.setTimeout(() => setReady(true), 260);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [reduced]);

    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [lines, input, menu, ready]);

    const suggestion = useMemo(() => {
        if (!input || menu || running) return '';
        const { token, candidates } = complete(input, cwd, fs.home, fs.tree);
        if (!token || candidates.length !== 1) return '';
        return candidates[0].slice(token.length);
    }, [input, cwd, fs, menu, running]);

    const print = useCallback((next: Line) => setLines((all) => [...all, next]), []);

    const run = useCallback(
        async (raw: string) => {
            const command = raw.trim();
            print(line('cmd', raw, { who: 'guest', cwd }));
            if (!command) return;

            history.current = [...history.current.filter((h) => h !== command), command].slice(-50);
            try {
                window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.current));
            } catch {
                /* storage may be blocked */
            }

            if (command === 'clear') {
                setLines([]);
                return;
            }

            if (command === 'help') {
                print(line('out', HELP));
                exchanges.current = [...exchanges.current, { command, output: 'help printed' }].slice(-6);
                return;
            }

            // A curl at this site's own API is answered by the API itself, not imagined.
            const curl = command.match(/^curl\b[^|>]*?(\/api\/[\w\-/]+)/);
            if (curl && !curl[1].startsWith('/api/terminal')) {
                setRunning(true);
                try {
                    const text = await realCurl(curl[1]);
                    print(line('out', text));
                    exchanges.current = [...exchanges.current, { command, output: text.slice(0, 600) }].slice(-6);
                } catch {
                    print(line('err', `curl: (7) Failed to connect to ${HOST} port 80`));
                } finally {
                    setRunning(false);
                    window.setTimeout(() => inputRef.current?.focus(), 0);
                }
                return;
            }

            // The prompt follows `cd` right away; if the shell says the path is not there, it goes back.
            const previous = cwd;
            const cd = command.match(/^cd(?:\s+(\S+))?$/);
            if (cd) {
                const target = resolve(cwd, fs.home, cd[1] ?? '~');
                if (isDir(fs.tree, target)) setCwd(display(target, fs.home));
            }

            const out = line('out', '');
            print(out);
            setRunning(true);
            const controller = new AbortController();
            abort.current = controller;
            let text = '';

            try {
                const response = await fetch('/api/terminal', {
                    method: 'POST',
                    signal: controller.signal,
                    headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
                    body: JSON.stringify({ command, cwd, history: exchanges.current.slice(-6) }),
                });

                if (response.status === 429) {
                    text = 'bash: fork: retry: Resource temporarily unavailable (rate limited, try again in a minute)';
                    setLines((all) => all.map((l) => (l.id === out.id ? { ...l, kind: 'err', text } : l)));
                    return;
                }
                if (response.status === 422) {
                    text = 'bash: input too long';
                    setLines((all) => all.map((l) => (l.id === out.id ? { ...l, kind: 'err', text } : l)));
                    return;
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                while (reader) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    text += decoder.decode(value, { stream: true });
                    const current = text;
                    setLines((all) => all.map((l) => (l.id === out.id ? { ...l, text: current } : l)));
                }
            } catch (error) {
                if ((error as Error).name === 'AbortError') {
                    setLines((all) => all.map((l) => (l.id === out.id ? { ...l, text: text + '^C' } : l)));
                } else {
                    text = 'bash: connection reset by peer';
                    setLines((all) => all.map((l) => (l.id === out.id ? { ...l, kind: 'err', text } : l)));
                }
            } finally {
                setRunning(false);
                abort.current = null;
                if (cd && /No such file|Not a directory/i.test(text)) setCwd(previous);
                exchanges.current = [...exchanges.current, { command, output: text.slice(0, 600) }].slice(-6);
                window.setTimeout(() => inputRef.current?.focus(), 0);
            }
        },
        [cwd, fs, print],
    );

    const openCompletion = useCallback(
        (direction: 1 | -1) => {
            if (menu) {
                setMenu({ ...menu, index: (menu.index + direction + menu.items.length) % menu.items.length });
                return;
            }
            const { token, candidates } = complete(input, cwd, fs.home, fs.tree);
            if (!candidates.length) return;
            if (candidates.length === 1) {
                setInput(apply(input, token, candidates[0]));
                return;
            }
            const prefix = commonPrefix(candidates);
            if (prefix.length > token.length) {
                setInput(input.slice(0, input.length - token.length) + prefix);
                return;
            }
            setMenu({ token, items: candidates, index: 0 });
        },
        [menu, input, cwd, fs],
    );

    const accept = useCallback(
        (item?: string) => {
            if (!menu) return;
            setInput(apply(input, menu.token, item ?? menu.items[menu.index]));
            setMenu(null);
            inputRef.current?.focus();
        },
        [menu, input],
    );

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            if (running) abort.current?.abort();
            else {
                print(line('cmd', input + '^C', { who: 'guest', cwd }));
                setInput('');
                setMenu(null);
            }
            return;
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            setLines([]);
            return;
        }
        if (running) return;

        // An empty line gives Tab back to the page, so the terminal is never a keyboard trap.
        if (e.key === 'Tab' && !input && !menu) return;
        if (e.key === 'Escape' && !menu) {
            inputRef.current?.blur();
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            openCompletion(e.shiftKey ? -1 : 1);
            return;
        }

        if (menu) {
            if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                setMenu({ ...menu, index: (menu.index + 1) % menu.items.length });
                return;
            }
            if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                setMenu({ ...menu, index: (menu.index - 1 + menu.items.length) % menu.items.length });
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                accept();
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setMenu(null);
                return;
            }
        }

        if (e.key === 'ArrowRight' && suggestion) {
            e.preventDefault();
            setInput(input + suggestion);
            return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const list = history.current;
            if (!list.length) return;
            const at = cursor.current === -1 ? list.length : cursor.current;
            const next = e.key === 'ArrowUp' ? Math.max(0, at - 1) : Math.min(list.length, at + 1);
            cursor.current = next;
            setInput(next === list.length ? '' : list[next]);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            cursor.current = -1;
            const value = input;
            setInput('');
            setMenu(null);
            run(value);
        }
    };

    return (
        <div
            className="relative border-l border-white/15 pl-4 font-mono text-[13px] leading-[1.7] transition-colors focus-within:border-[#ff3b30]/70"
            onClick={() => inputRef.current?.focus()}
        >
            <div
                ref={scrollRef}
                role="log"
                aria-live="polite"
                aria-label="Terminal output"
                className="max-h-[188px] min-h-[84px] overflow-y-auto pr-2"
            >
                <div className="flex flex-wrap">
                    <PromptLabel who={owner} cwd="~" />
                    <span className="text-zinc-100">{whoami.slice(0, typed)}</span>
                    {!ready && <span className="blink ml-px inline-block h-[1.1em] w-[0.6em] translate-y-[0.2em] bg-zinc-200" />}
                </div>
                {ready && <div className="text-zinc-400">{intro}</div>}

                {lines.map((l) =>
                    l.kind === 'cmd' ? (
                        <div key={l.id} className="flex flex-wrap break-all">
                            <PromptLabel who={l.who ?? 'guest'} cwd={l.cwd ?? '~'} />
                            <span className="whitespace-pre-wrap text-zinc-100">{l.text}</span>
                        </div>
                    ) : (
                        <div key={l.id} className={`break-words whitespace-pre-wrap ${l.kind === 'err' ? 'text-[#ff3b30]' : 'text-zinc-300'}`}>
                            {l.text}
                            {running && l.id === lines[lines.length - 1]?.id && (
                                <span className="blink inline-block h-[1.1em] w-[0.6em] translate-y-[0.2em] bg-zinc-400" />
                            )}
                        </div>
                    ),
                )}

                {ready && !running && (
                    <div className="flex flex-wrap break-all">
                        <PromptLabel who="guest" cwd={cwd} />
                        <span className="whitespace-pre-wrap text-zinc-100">{input}</span>
                        <span className="whitespace-pre text-zinc-400">{suggestion}</span>
                        {!input && !lines.length && !focused && <span className="ml-1 text-zinc-400">type help</span>}
                        <span
                            className={`inline-block h-[1.1em] w-[0.6em] translate-y-[0.2em] ${focused ? 'blink bg-zinc-100' : 'border border-zinc-500'}`}
                            aria-hidden="true"
                        />
                    </div>
                )}

                {menu && (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-1">
                        {menu.items.map((item, i) => (
                            <button
                                key={item}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => accept(item)}
                                className={i === menu.index ? 'bg-zinc-50 px-1 text-black' : 'px-1 text-zinc-400 hover:text-white'}
                            >
                                {item.split('/').filter(Boolean).pop()}
                                {item.endsWith('/') ? '/' : ''}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <input
                ref={inputRef}
                id="terminal-input"
                value={input}
                onChange={(e) => {
                    setInput(e.target.value);
                    setMenu(null);
                }}
                onKeyDown={onKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                disabled={!ready}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Terminal input"
                className="absolute h-px w-px opacity-0"
            />

            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openCompletion(1)}
                className="absolute right-0 bottom-0 rounded-[2px] border border-white/15 px-2 py-0.5 text-[11px] text-zinc-400 sm:hidden"
                aria-label="Complete"
            >
                ⇥ tab
            </button>
        </div>
    );
}
