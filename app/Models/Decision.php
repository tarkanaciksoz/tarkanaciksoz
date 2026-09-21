<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Decision extends Model
{
    use HasFactory;

    protected $fillable = ['title', 'body', 'visible', 'position'];

    protected function casts(): array
    {
        return ['visible' => 'boolean'];
    }
}
