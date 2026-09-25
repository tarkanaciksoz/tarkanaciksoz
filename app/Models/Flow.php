<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Flow extends Model
{
    use HasFactory;

    protected $fillable = ['slug', 'title', 'summary', 'steps', 'visible', 'position'];

    protected function casts(): array
    {
        return ['steps' => 'array', 'visible' => 'boolean'];
    }
}
