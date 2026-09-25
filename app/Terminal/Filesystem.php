<?php

namespace App\Terminal;

use App\Models\Decision;
use App\Models\StackLayer;
use App\Models\System;

/**
 * The fictional machine behind the terminal. Its tree is fixed so answers stay
 * consistent between commands, and its files are filled from the site's real data,
 * so `cat stack.json` tells the truth.
 */
final class Filesystem
{
    public const HOME = '/home/guest';

    /** @return array<string, list<string>> directory => entries (directories end with /) */
    public static function tree(): array
    {
        $systems = System::query()->where('visible', true)->orderBy('position')->pluck('slug')
            ->map(fn (string $slug) => "{$slug}.md")->all();

        return [
            '/' => ['bin/', 'etc/', 'home/', 'tmp/', 'usr/', 'var/'],
            '/home' => ['guest/'],
            self::HOME => ['README.md', 'stack.json', 'rules.txt', 'contact.txt', 'systems/', '.bash_history'],
            self::HOME.'/systems' => $systems,
            '/etc' => ['hostname', 'os-release', 'passwd'],
            '/var' => ['log/'],
            '/var/log' => ['glassbox.log'],
            '/tmp' => [],
            '/usr' => ['bin/'],
            '/bin' => [],
            '/usr/bin' => [],
        ];
    }

    /** Compact facts the shell may quote from, so file contents are real rather than invented. */
    public static function facts(): string
    {
        $profile = config('profile');

        $stack = StackLayer::query()
            ->with(['items' => fn ($q) => $q->where('visible', true)->orderBy('position')])
            ->orderBy('position')->get()
            ->map(fn (StackLayer $layer) => $layer->slug.': '.$layer->items
                ->map(fn ($item) => $item->name.($item->services !== null ? " ({$item->services} services)" : ''))
                ->implode(', '))
            ->implode("\n");

        $systems = System::query()->where('visible', true)->orderBy('position')->get()
            ->map(fn (System $s) => "{$s->slug}.md: {$s->title}. {$s->summary}")
            ->implode("\n");

        $rules = Decision::query()->where('visible', true)->orderBy('position')->pluck('title')
            ->map(fn (string $t, int $i) => ($i + 1).". {$t}")
            ->implode("\n");

        $links = collect($profile['links'] ?? [])->map(fn ($l) => "{$l['label']}: {$l['href']}")->implode("\n");

        $tree = collect(self::tree())
            ->map(fn ($entries, $dir) => $dir.': '.(implode(' ', $entries) ?: '(empty)'))
            ->implode("\n");

        return <<<TXT
        OWNER: {$profile['name']}, {$profile['role']}, {$profile['location']}.
        README.md: {$profile['headline']} {$profile['intro']}

        DIRECTORY TREE:
        {$tree}

        stack.json (layer: tools):
        {$stack}

        systems/:
        {$systems}

        rules.txt:
        {$rules}

        contact.txt:
        {$links}
        TXT;
    }
}
