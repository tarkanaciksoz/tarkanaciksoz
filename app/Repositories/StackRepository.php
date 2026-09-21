<?php

namespace App\Repositories;

use App\Models\StackLayer;
use App\Tracing\Attributes\Trace;
use Illuminate\Database\Eloquent\Collection;

final class StackRepository
{
    #[Trace(
        'Layers with their visible items',
        why: 'One query per relation instead of one per layer. The item filter and sort share idx_stack_visible_layer_pos, so the database reads them in order straight off the index.',
        kind: 'repository',
    )]
    public function map(): Collection
    {
        return StackLayer::query()
            ->with(['items' => fn ($q) => $q->where('visible', true)->orderBy('position')])
            ->orderBy('position')
            ->get();
    }
}
