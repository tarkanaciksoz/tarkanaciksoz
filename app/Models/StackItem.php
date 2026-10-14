<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StackItem extends Model
{
    use HasFactory;

    protected $fillable = ['stack_layer_id', 'name', 'icon', 'usage', 'services', 'why', 'instead_of', 'visible', 'position'];

    protected function casts(): array
    {
        return ['visible' => 'boolean', 'services' => 'integer'];
    }

    public function layer(): BelongsTo
    {
        return $this->belongsTo(StackLayer::class, 'stack_layer_id');
    }
}
