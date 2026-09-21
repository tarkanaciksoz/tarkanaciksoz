<?php

namespace App\Tracing;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;
use ReflectionFunctionAbstract;

/**
 * Turns a reflected function or method into "file, lines, excerpt, commit":
 * the evidence panel on the anatomy page. Not a paste; read from the same checkout that served the request.
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

        return [
            'file' => self::relative($file),
            'vendor' => str_contains($file, DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR),
            'line_start' => $start,
            'line_end' => $end,
            'excerpt' => $excerpt,
            'commit' => self::commit(),
        ];
    }

    public static function relative(string $file): string
    {
        $base = rtrim(base_path(), DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR;

        return str_starts_with($file, $base) ? substr($file, strlen($base)) : $file;
    }

    public static function commit(): ?string
    {
        if ($configured = config('tracing.commit')) {
            return $configured;
        }

        return Cache::remember('tracing:commit', now()->addHour(), function () {
            try {
                $result = Process::path(base_path())->run('git rev-parse --short HEAD');

                return $result->successful() ? trim($result->output()) : null;
            } catch (\Throwable) {
                return null;
            }
        });
    }
}
