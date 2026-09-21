<?php

namespace App\Http\Resources;

use App\Models\StackLayer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin StackLayer */
class StackLayerResource extends JsonResource
{
    /**
     * @return array{slug:string, name:string, tagline:string, glyph:string, items:array}
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'tagline' => $this->tagline,
            'glyph' => $this->glyph,
            'items' => StackItemResource::collection($this->items)->resolve(),
        ];
    }
}
