<?php

namespace App\Repositories;

use App\Models\Decision;
use App\Tracing\Attributes\Trace;
use Illuminate\Database\Eloquent\Collection;

final class DecisionRepository
{
    #[Trace('Visible decisions, in order', why: 'Same shape as systems: small, ordered, cached with the rest of the page payload.', kind: 'repository')]
    public function visible(): Collection
    {
        return Decision::query()->where('visible', true)->orderBy('position')->get();
    }
}
