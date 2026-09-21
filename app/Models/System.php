<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class System extends Model
{
    use HasFactory;

    protected $fillable = ['slug', 'title', 'summary', 'problem', 'approach', 'lesson', 'tags', 'scale', 'visible', 'position'];

    protected function casts(): array
    {
        return ['tags' => 'array', 'visible' => 'boolean'];
    }
}
