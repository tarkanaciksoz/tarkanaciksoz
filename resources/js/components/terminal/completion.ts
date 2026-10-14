export type Tree = Record<string, string[]>;

export const COMMANDS = [
    'cat',
    'cd',
    'clear',
    'composer',
    'curl',
    'date',
    'df',
    'echo',
    'env',
    'exit',
    'find',
    'free',
    'git',
    'grep',
    'head',
    'help',
    'history',
    'hostname',
    'id',
    'less',
    'ls',
    'man',
    'mkdir',
    'nano',
    'neofetch',
    'php',
    'ps',
    'pwd',
    'rm',
    'sudo',
    'tail',
    'top',
    'touch',
    'tree',
    'uname',
    'uptime',
    'vim',
    'whoami',
];

const SUBCOMMANDS: Record<string, string[]> = {
    git: ['branch', 'diff', 'log', 'status'],
    php: ['-v', 'artisan'],
    composer: ['install', 'outdated', 'show'],
    uname: ['-a', '-r'],
    df: ['-h'],
    free: ['-h'],
    ls: ['-a', '-l', '-la'],
    curl: ['/api/decisions', '/api/flows', '/api/profile', '/api/stack', '/api/systems'],
    man: ['bash', 'cat', 'cd', 'grep', 'ls'],
};

const ARTISAN = ['about', 'cache:clear', 'migrate', 'octane:start', 'queue:work', 'route:list', 'tinker'];

/** Commands whose arguments are paths; `cd` only takes directories. */
const PATH_COMMANDS = new Set(['cat', 'cd', 'find', 'grep', 'head', 'less', 'ls', 'nano', 'rm', 'tail', 'touch', 'tree', 'vim', 'mkdir']);

export function resolve(cwd: string, home: string, target: string): string {
    const base = target.startsWith('/') ? '' : cwd === '~' ? home : cwd.replace(/^~/, home);
    const raw = target.startsWith('~') ? home + target.slice(1) : target.startsWith('/') ? target : `${base}/${target}`;
    const parts: string[] = [];
    for (const part of raw.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') parts.pop();
        else parts.push(part);
    }
    return '/' + parts.join('/');
}

export function display(path: string, home: string): string {
    if (path === home) return '~';
    if (path.startsWith(home + '/')) return '~' + path.slice(home.length);
    return path;
}

export const isDir = (tree: Tree, path: string) => Object.prototype.hasOwnProperty.call(tree, path === '' ? '/' : path);

export type Completion = { token: string; candidates: string[] };

/** Candidates for the last token of the line, as full replacements for that token. */
export function complete(line: string, cwd: string, home: string, tree: Tree): Completion {
    const tokens = line.split(' ');
    const token = tokens[tokens.length - 1];
    const position = tokens.length - 1;
    const first = tokens[0];

    if (position === 0) {
        return { token, candidates: COMMANDS.filter((c) => c.startsWith(token)) };
    }

    if (first === 'php' && tokens[1] === 'artisan' && position === 2) {
        return { token, candidates: ARTISAN.filter((c) => c.startsWith(token)) };
    }

    const subs = SUBCOMMANDS[first];
    if (subs && position === 1 && !token.includes('/')) {
        const matches = subs.filter((c) => c.startsWith(token));
        if (matches.length || !PATH_COMMANDS.has(first)) return { token, candidates: matches };
    }

    if (!PATH_COMMANDS.has(first) && first !== 'sudo') return { token, candidates: [] };

    const slash = token.lastIndexOf('/');
    const dirPart = slash >= 0 ? token.slice(0, slash + 1) : '';
    const basePart = slash >= 0 ? token.slice(slash + 1) : token;
    const dir = dirPart ? resolve(cwd, home, dirPart) : resolve(cwd, home, '.');
    const entries = tree[dir] ?? [];

    const candidates = entries
        .filter((e) => e.startsWith(basePart))
        .filter((e) => (basePart.startsWith('.') ? true : !e.startsWith('.')))
        .filter((e) => (first === 'cd' ? e.endsWith('/') : true))
        .map((e) => dirPart + e);

    return { token, candidates };
}

export function commonPrefix(values: string[]): string {
    if (!values.length) return '';
    let prefix = values[0];
    for (const v of values.slice(1)) {
        while (!v.startsWith(prefix)) prefix = prefix.slice(0, -1);
    }
    return prefix;
}

export function apply(line: string, token: string, replacement: string): string {
    const head = line.slice(0, line.length - token.length);
    return head + replacement + (replacement.endsWith('/') ? '' : ' ');
}
