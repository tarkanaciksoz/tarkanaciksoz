<?php

namespace App\Http\Resources;

use App\Models\StackItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin StackItem */
class StackItemResource extends JsonResource
{
    /**
     * @return array{id:int, name:string, icon:string|null, usage:string|null, services:int|null, why:string, instead_of:string|null}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'icon' => $this->icon,
            'usage' => $this->usage,
            'services' => $this->services,
            'why' => $this->why,
            'instead_of' => $this->instead_of,
        ];
    }
}
