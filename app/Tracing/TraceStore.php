<?php

namespace App\Tracing;

use Illuminate\Contracts\Cache\Repository as Cache;

final class TraceStore
{
    public function __construct(private readonly Cache $cache) {}

    public function put(array $trace): void
    {
        $this->cache->put($this->key($trace['id']), $trace, now()->addMinutes(config('tracing.ttl_minutes')));
    }

    public function get(string $id): ?array
    {
        $trace = $this->cache->get($this->key($id));

        return is_array($trace) ? $trace : null;
    }

    public function attachClient(string $id, array $client): ?array
    {
        $trace = $this->get($id);
        if (! $trace) {
            return null;
        }

        $trace['client'] = $client;
        $this->put($trace);

        return $trace;
    }

    private function key(string $id): string
    {
        return 'trace:'.$id;
    }
}
