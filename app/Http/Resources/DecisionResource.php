<?php

namespace App\Http\Resources;

use App\Models\Decision;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Decision */
class DecisionResource extends JsonResource
{
    /**
     * @return array{id:int, title:string, body:string}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
        ];
    }
}
