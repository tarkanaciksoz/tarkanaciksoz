<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#050506">
        <meta name="description" content="{{ config('profile.headline') }} {{ config('profile.intro') }}">
        <meta property="og:type" content="website">
        <meta property="og:title" content="{{ config('profile.name') }}, {{ config('profile.role') }}">
        <meta property="og:description" content="{{ config('profile.headline') }} {{ config('profile.intro') }}">
        <meta property="og:url" content="{{ url('/') }}">
        <meta name="twitter:card" content="summary">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
