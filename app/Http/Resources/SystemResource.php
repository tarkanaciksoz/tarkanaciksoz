<?php

namespace App\Http\Resources;

use App\Models\System;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin System */
class SystemResource extends JsonResource
{
    /**
     * @return array{slug:string, title:string, summary:string, problem:string, approach:string, lesson:string|null, tags:array<int,string>, scale:string|null, image:string|null}
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'summary' => $this->summary,
            'problem' => $this->problem,
            'approach' => $this->approach,
            'lesson' => $this->lesson,
            'tags' => $this->tags,
            'scale' => $this->scale,
            'image' => $this->image,
        ];
    }
}
