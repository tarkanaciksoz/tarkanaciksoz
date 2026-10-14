<?php

namespace App\Tracing;

/**
 * Which commit is serving this request, and where a reader can open it.
 *
 * HEAD is read from the .git directory on every call rather than cached: a deploy moves
 * it, and a cached hash would point the page's links at a commit that is no longer live.
 * Reading two small files costs less than starting a git process.
 */
final class Repository
{
    /** Full hash of the deployed commit, or null when there is no way to know it. */
    public static function head(): ?string
    {
        if ($configured = config('tracing.commit')) {
            return $configured;
        }

        $git = base_path('.git');
        $head = @file_get_contents($git.'/HEAD');
        if ($head === false) {
            return null;
        }

        $head = trim($head);
        if (! str_starts_with($head, 'ref: ')) {
            return self::hash($head);
        }

        $ref = substr($head, 5);
        $loose = @file_get_contents($git.'/'.$ref);
        if ($loose !== false) {
            return self::hash(trim($loose));
        }

        // After `git gc` a branch tip may only live in packed-refs.
        foreach (@file($git.'/packed-refs', FILE_IGNORE_NEW_LINES) ?: [] as $line) {
            if (str_ends_with($line, ' '.$ref)) {
                return self::hash(strtok($line, ' '));
            }
        }

        return null;
    }

    /** The seven-character form people read. */
    public static function short(): ?string
    {
        $head = self::head();

        return $head ? substr($head, 0, 7) : null;
    }

    /** The commit on the public repository, or null when either is unknown. */
    public static function commitUrl(): ?string
    {
        $base = self::base();
        $head = self::head();

        return $base && $head ? "{$base}/commit/{$head}" : null;
    }

    /** The repository's files at the deployed commit; a relative path appended opens one. */
    public static function filesUrl(): ?string
    {
        $base = self::base();
        $head = self::head();

        return $base && $head ? "{$base}/blob/{$head}" : null;
    }

    /**
     * A file at the deployed commit, with the given lines highlighted. Vendor code is not
     * in the repository, so it gets no link.
     */
    public static function fileUrl(string $file, ?int $start = null, ?int $end = null): ?string
    {
        $files = self::filesUrl();
        if (! $files || $file === '' || str_starts_with($file, 'vendor/') || str_starts_with($file, '/')) {
            return null;
        }

        $anchor = match (true) {
            $start === null => '',
            $end === null || $end === $start => "#L{$start}",
            default => "#L{$start}-L{$end}",
        };

        return "{$files}/{$file}{$anchor}";
    }

    private static function base(): ?string
    {
        $url = config('tracing.repository');

        return $url ? rtrim($url, '/') : null;
    }

    private static function hash(string $value): ?string
    {
        return preg_match('/^[0-9a-f]{7,40}$/', $value) ? $value : null;
    }
}
