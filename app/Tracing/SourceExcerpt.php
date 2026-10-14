<?php

namespace App\Tracing;

use ReflectionFunctionAbstract;

/**
 * Turns a reflected function or method into "file, lines, excerpt, commit, link": the
 * evidence panel on the page. Not a paste; read from the same checkout that served the
 * request, and linked to that commit on the public repository.
 */
final class SourceExcerpt
{
    private const CONTEXT_BEFORE = 2;

    private const CONTEXT_AFTER = 1;

    private const MAX_LINES = 40;

    public static function for(ReflectionFunctionAbstract $ref): ?array
    {
        $file = $ref->getFileName();
        $start = $ref->getStartLine();
        $end = $ref->getEndLine();

        if (! $file || ! $start || ! $end || ! is_readable($file)) {
            return null;
        }

        $lines = file($file, FILE_IGNORE_NEW_LINES) ?: [];
        $from = max(1, $start - self::CONTEXT_BEFORE);
        $to = min(count($lines), $end + self::CONTEXT_AFTER, $from + self::MAX_LINES - 1);

        $excerpt = [];
        for ($n = $from; $n <= $to; $n++) {
            $excerpt[] = ['n' => $n, 'text' => $lines[$n - 1] ?? ''];
        }

        return self::record(self::relative($file), $start, $end, $excerpt,
            str_contains($file, DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR));
    }

    /**
     * @param  list<array{n:int, text:string}>  $excerpt
     * @return array{file:string, vendor:bool, line_start:int, line_end:int, excerpt:list<array{n:int, text:string}>, commit:string|null, url:string|null, commit_url:string|null}
     */
    public static function record(string $file, int $start, int $end, array $excerpt, bool $vendor = false): array
    {
        return [
            'file' => $file,
            'vendor' => $vendor,
            'line_start' => $start,
            'line_end' => $end,
            'excerpt' => $excerpt,
            'commit' => Repository::short(),
            'url' => $vendor ? null : Repository::fileUrl($file, $start, $end),
            'commit_url' => Repository::commitUrl(),
        ];
    }

    public static function relative(string $file): string
    {
        $base = rtrim(base_path(), DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR;

        return str_starts_with($file, $base) ? substr($file, strlen($base)) : $file;
    }
}
