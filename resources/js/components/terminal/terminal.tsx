import { apiGet } from '@/lib/api';
import type { Profile } from '@/types/portfolio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../signal/use-reduced-motion';
import { apply, commonPrefix, complete, ENDPOINTS, FILES } from './completion';

type Line = { id: number; kind: 'cmd' | 'out' | 'err'; text: string };
type Menu = { token: string; items: string[]; index: number };

const HISTORY_KEY = 'glassbox:terminal-history';
const HOST = 'glassbox';
const HOME = '/home/guest';

const HELP = [
    'help                this list',
    'whoami              who you are, and whose site this is',
    'ls, cat <file>      the files here: about.txt, contact.txt',
    'pwd, cd             where you are (there is only home)',
    'echo, date          the usual',
    'history, clear      this session',
    'curl /api/<name>    a real request to this site',
    '',
    'tab completes, up and down walk the history, esc leaves',
].join('\n');

let nextId = 1;
const line = (kind: Line['kind'], text: string): Line => ({ id: nextId++, kind, text });

function loadHistory(): string[] {
    try {
        return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]');
    } catch {
        return [];
    }
}

function PromptLabel({ who }: { who: string }) {
    return (
        <span className="shrink-0 whitespace-pre">
            <span className={who === 'guest' ? 'text-zinc-300' : 'text-[#ff3b30]'}>{who}</span>
            <span className="text-zinc-400">@{HOST}:~$ </span>
        </span>
    );
}

/** A GET to the site's own API, printed the way curl -i would: status, the headers that matter, the start of the body. */
async function curl(path: string): Promise<string> {
    const result = await apiGet<unknown>(path);
    const body = JSON.stringify(result.body, null, 2).split('\n');
    const shown = body.slice(0, 16);
    return [
        `HTTP/1.1 ${result.status}`,
        `X-Trace-Id: ${result.traceId ?? 'none'}`,
        ...(result.cache ? [`Cache-Status: ${result.cache}`] : []),
        '',
        ...shown,
        ...(body.length > shown.length ? [`... ${body.length - shown.length} more lines`] : []),
    ].join('\n');
}

/**
 * The hero terminal: a tiny, honest shell. The owner's `whoami` plays first,
 * then the visitor gets a prompt with a handful of commands, all answered here
 * in the browser. `curl` is the one that leaves the page: it calls the API.
 */
export function Terminal({ owner, profile }: { owner: string; profile: Profile | null }) {
    const reduced = useReducedMotion();
    const [lines, setLines] = useState<Line[]>([]);
    const [typed, setTyped] = useState(0);
    const [ready, setReady] = useState(false);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [menu, setMenu] = useState<Menu | null>(null);
    const [focused, setFocused] = useState(false);
    const history = useRef<string[]>([]);
    const cursor = useRef<number>(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const whoami = 'whoami';
    const intro = profile ? `${profile.role}, ${profile.location}` : 'reading /api/profile';

    useEffect(() => {
        history.current = loadHistory();
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
        if (!input || menu || busy) return '';
        const { token, candidates } = complete(input);
        if (!token || candidates.length !== 1) return '';
        return candidates[0].slice(token.length);
    }, [input, menu, busy]);

    const files = useMemo<Record<string, string>>(
        () => ({
            'about.txt': profile ? [profile.headline, '', profile.intro, '', ...profile.focus.map((f) => `- ${f}`)].join('\n') : 'loading',
            'contact.txt': profile ? profile.links.map((l) => `${l.label.padEnd(10)} ${l.href.replace(/^mailto:/, '')}`).join('\n') : 'loading',
        }),
        [profile],
    );

    /** Every command, answered in place. Returns the output, or null for nothing to print. */
    const answer = useCallback(
        async (command: string): Promise<Line | null> => {
            const [name, ...args] = command.split(/\s+/);
            const arg = args.join(' ');
            switch (name) {
                case 'help':
                    return line('out', HELP);
                case 'whoami':
                    return line('out', `guest\n(this site belongs to ${owner}: ${intro})`);
                case 'pwd':
                    return line('out', HOME);
                case 'ls':
                    return line('out', FILES.join('  '));
                case 'cat':
                    if (!arg) return line('err', 'cat: which file? try: cat about.txt');
                    return files[arg] ? line('out', files[arg]) : line('err', `cat: ${arg}: No such file or directory`);
                case 'cd':
                    return !arg || arg === '~' || arg === HOME ? null : line('err', `cd: ${arg}: No such file or directory`);
                case 'echo':
                    return line('out', arg);
                case 'date':
                    return line('out', new Date().toString());
                case 'history':
                    return line('out', history.current.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n'));
                case 'curl': {
                    const path = args.find((a) => a.startsWith('/api/'));
                    if (!path) return line('err', `curl: try one of ${ENDPOINTS.join(', ')}`);
                    try {
                        return line('out', await curl(path));
                    } catch {
                        return line('err', `curl: (7) Failed to connect to ${HOST}`);
                    }
                }
                default:
                    return line('err', `${name}: command not found. Try help.`);
            }
        },
        [files, intro, owner],
    );

    const run = useCallback(
        async (raw: string) => {
            const command = raw.trim();
            setLines((all) => [...all, line('cmd', raw)]);
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

            setBusy(true);
            const out = await answer(command);
            setBusy(false);
            if (out) setLines((all) => [...all, out]);
            window.setTimeout(() => inputRef.current?.focus(), 0);
        },
        [answer],
    );

    const openCompletion = useCallback(
        (direction: 1 | -1) => {
            if (menu) {
                setMenu({ ...menu, index: (menu.index + direction + menu.items.length) % menu.items.length });
                return;
            }
            const { token, candidates } = complete(input);
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
        [menu, input],
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
            setLines((all) => [...all, line('cmd', input + '^C')]);
            setInput('');
            setMenu(null);
            return;
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            setLines([]);
            return;
        }
        if (busy) return;

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
            void run(value);
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
                    <PromptLabel who={owner} />
                    <span className="text-zinc-100">{whoami.slice(0, typed)}</span>
                    {!ready && <span className="blink ml-px inline-block h-[1.1em] w-[0.6em] translate-y-[0.2em] bg-zinc-200" />}
                </div>
                {ready && <div className="text-zinc-400">{intro}</div>}

                {lines.map((l) =>
                    l.kind === 'cmd' ? (
                        <div key={l.id} className="flex flex-wrap break-all">
                            <PromptLabel who="guest" />
                            <span className="whitespace-pre-wrap text-zinc-100">{l.text}</span>
                        </div>
                    ) : (
                        <div key={l.id} className={`break-words whitespace-pre-wrap ${l.kind === 'err' ? 'text-[#ff3b30]' : 'text-zinc-300'}`}>
                            {l.text}
                        </div>
                    ),
                )}

                {ready && !busy && (
                    <div className="flex flex-wrap break-all">
                        <PromptLabel who="guest" />
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
                                {item}
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
