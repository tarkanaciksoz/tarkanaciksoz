<?php

namespace App\Repositories;

use App\Models\System;
use App\Tracing\Attributes\Trace;
use Illuminate\Database\Eloquent\Collection;

final class SystemRepository
{
    #[Trace('Visible systems, in order', why: 'Filter and sort share one index; the set is small and fully cached.', kind: 'repository')]
    public function visible(): Collection
    {
        return System::query()->where('visible', true)->orderBy('position')->get();
    }
}
