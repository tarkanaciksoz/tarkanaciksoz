<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StackLayer extends Model
{
    use HasFactory;

    protected $fillable = ['slug', 'name', 'tagline', 'glyph', 'position'];

    public function items(): HasMany
    {
        return $this->hasMany(StackItem::class)->orderBy('position');
    }
}
