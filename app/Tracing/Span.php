<?php

namespace App\Tracing;

final class Span
{
    public ?float $durationMs = null;

    public function __construct(
        public readonly string $id,
        public readonly ?string $parentId,
        public readonly string $name,
        public readonly ?string $why,
        public readonly string $kind,
        public readonly float $startMs,
        public array $meta = [],
        public ?array $source = null,
    ) {}

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'parent_id' => $this->parentId,
            'name' => $this->name,
            'why' => $this->why,
            'kind' => $this->kind,
            'start_ms' => round($this->startMs, 3),
            'duration_ms' => round($this->durationMs ?? 0, 3),
            'meta' => $this->meta,
            'source' => $this->source,
        ];
    }
}
