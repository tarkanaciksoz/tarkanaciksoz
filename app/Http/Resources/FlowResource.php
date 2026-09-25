<?php

namespace App\Http\Resources;

use App\Models\Flow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Flow */
class FlowResource extends JsonResource
{
    /**
     * @param  array<string, int>  $itemIds  stack item name => id, so the client can light the right chip
     */
    public static function withItems(iterable $flows, array $itemIds): array
    {
        return collect($flows)->map(fn (Flow $flow) => [
            'slug' => $flow->slug,
            'title' => $flow->title,
            'summary' => $flow->summary,
            'steps' => collect($flow->steps)->map(fn (array $step) => [
                'item_id' => $itemIds[$step['tool']] ?? null,
                'tool' => $step['tool'],
                'note' => $step['note'],
                'hot' => (bool) ($step['hot'] ?? false),
            ])->values()->all(),
        ])->values()->all();
    }

    /**
     * @return array{slug:string, title:string, summary:string, steps:array}
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'summary' => $this->summary,
            'steps' => $this->steps,
        ];
    }
}
