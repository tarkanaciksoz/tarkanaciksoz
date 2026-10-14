/** Everything the terminal understands. Nothing else runs; there is no model behind it. */
export const COMMANDS = ['cat', 'cd', 'clear', 'curl', 'date', 'echo', 'help', 'history', 'ls', 'pwd', 'whoami'];

export const FILES = ['about.txt', 'contact.txt'];

/** The site's own endpoints, which `curl` really calls. */
export const ENDPOINTS = ['/api/decisions', '/api/flows', '/api/profile', '/api/stack', '/api/systems'];

export type Completion = { token: string; candidates: string[] };

/** Candidates for the last word of the line, as full replacements for that word. */
export function complete(line: string): Completion {
    const words = line.split(' ');
    const token = words[words.length - 1];
    if (words.length === 1) return { token, candidates: COMMANDS.filter((c) => c.startsWith(token)) };
    const pool = words[0] === 'cat' ? FILES : words[0] === 'curl' ? ENDPOINTS : [];
    return { token, candidates: pool.filter((c) => c.startsWith(token)) };
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
    return line.slice(0, line.length - token.length) + replacement + ' ';
}
