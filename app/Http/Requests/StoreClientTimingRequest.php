<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreClientTimingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'dns_ms' => ['required', 'numeric', 'min:0', 'max:60000'],
            'tcp_ms' => ['required', 'numeric', 'min:0', 'max:60000'],
            'tls_ms' => ['required', 'numeric', 'min:0', 'max:60000'],
            'ttfb_ms' => ['required', 'numeric', 'min:0', 'max:60000'],
            'download_ms' => ['required', 'numeric', 'min:0', 'max:60000'],
            'total_ms' => ['required', 'numeric', 'min:0', 'max:60000'],
            'transfer_size' => ['nullable', 'integer', 'min:0'],
            'protocol' => ['nullable', 'string', 'max:24'],
        ];
    }
}
