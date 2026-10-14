@php
    // Everything a crawler or a link preview needs is here, in the first response: the page
    // itself is drawn by JavaScript from the API, which preview scrapers never run.
    $name = config('profile.name');
    $title = $name.' · '.config('profile.role');
    $description = config('profile.headline').' '.config('profile.intro');
    $base = rtrim(config('app.url'), '/');
    $links = collect(config('profile.links'));
    $profiles = $links->pluck('href')->filter(fn (string $href) => str_starts_with($href, 'https://'))->values();
    $structured = [
        '@context' => 'https://schema.org',
        '@graph' => [
            [
                '@type' => 'Person',
                '@id' => $base.'/#person',
                'name' => $name,
                'jobTitle' => config('profile.role'),
                'url' => $base.'/',
                'sameAs' => $profiles,
                'address' => ['@type' => 'PostalAddress', 'addressLocality' => config('profile.location')],
            ],
            [
                '@type' => 'WebSite',
                '@id' => $base.'/#website',
                'url' => $base.'/',
                'name' => $name,
                'inLanguage' => 'en',
                'publisher' => ['@id' => $base.'/#person'],
            ],
        ],
    ];
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#050506">
        <meta name="color-scheme" content="dark">
        <meta name="description" content="{{ $description }}">
        <meta name="author" content="{{ $name }}">
        <link rel="canonical" href="{{ $base }}/">

        <meta property="og:type" content="website">
        <meta property="og:site_name" content="{{ $name }}">
        <meta property="og:title" content="{{ $title }}">
        <meta property="og:description" content="{{ $description }}">
        <meta property="og:url" content="{{ $base }}/">
        <meta property="og:locale" content="en_US">
        <meta property="og:image" content="{{ $base }}/og.png">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:image:alt" content="{{ config('profile.headline') }} {{ $title }}.">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="{{ $title }}">
        <meta name="twitter:description" content="{{ $description }}">
        <meta name="twitter:image" content="{{ $base }}/og.png">

        <link rel="icon" href="/favicon.ico" sizes="32x32">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/site.webmanifest">

        <script type="application/ld+json">{!! json_encode($structured, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) !!}</script>

        <title inertia>{{ $title }}</title>

        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
        <noscript>
            <main style="max-width: 40rem; margin: 0 auto; padding: 4rem 1.5rem; color: #e4e4e7; background: #050506; font-family: system-ui, sans-serif; line-height: 1.6">
                <h1 style="margin: 0; font-size: 2rem; color: #fafafa">{{ $name }}</h1>
                <p style="margin: 0.25rem 0 1.5rem; color: #a1a1aa">{{ config('profile.role') }}, {{ config('profile.location') }}</p>
                <p>{{ $description }}</p>
                <p>Most of this page is drawn from its own API, so it needs JavaScript. The API is documented at <a href="/docs/api" style="color: #fafafa">/docs/api</a>.</p>
                <ul style="padding-left: 1.2rem">
                    @foreach ($links as $link)
                        <li><a href="{{ $link['href'] }}" style="color: #fafafa">{{ $link['label'] }}</a></li>
                    @endforeach
                </ul>
            </main>
        </noscript>
    </body>
</html>
