<!doctype html>
<html lang="en" data-theme="{{ $config->renderer()->get('theme', 'light') }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="color-scheme" content="{{ $config->renderer()->get('theme', 'light') }}">
    <meta name="description" content="The API behind tarkanaciksoz.com: every response carries a trace id you can open.">
    <link rel="canonical" href="{{ rtrim(config('app.url'), '/') }}/docs/api">
    <link rel="icon" href="/favicon.ico" sizes="32x32">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <title>{{ $config->get('ui.title') ?? config('app.name') . ' - API Docs' }}</title>

    <script src="https://unpkg.com/@stoplight/elements@8.4.2/web-components.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements@8.4.2/styles.min.css">

    @include('scramble::dev-tools', ['renderer' => 'elements'])

    <script>
        const originalFetch = window.fetch;

        // intercept TryIt requests and add the XSRF-TOKEN header,
        // which is necessary for Sanctum cookie-based authentication to work correctly
        window.fetch = (url, options) => {
            const CSRF_TOKEN_COOKIE_KEY = "XSRF-TOKEN";
            const CSRF_TOKEN_HEADER_KEY = "X-XSRF-TOKEN";
            const getCookieValue = (key) => {
                const cookie = document.cookie.split(';').find((cookie) => cookie.trim().startsWith(key));
                return cookie?.split("=")[1];
            };

            const updateFetchHeaders = (
                headers,
                headerKey,
                headerValue,
            ) => {
                if (headers instanceof Headers) {
                    headers.set(headerKey, headerValue);
                } else if (Array.isArray(headers)) {
                    headers.push([headerKey, headerValue]);
                } else if (headers) {
                    headers[headerKey] = headerValue;
                }
            };
            const csrfToken = getCookieValue(CSRF_TOKEN_COOKIE_KEY);
            if (csrfToken) {
                const { headers = new Headers() } = options || {};
                updateFetchHeaders(headers, CSRF_TOKEN_HEADER_KEY, decodeURIComponent(csrfToken));
                return originalFetch(url, {
                    ...options,
                    headers,
                });
            }

            return originalFetch(url, options);
        };
    </script>

    {{-- The docs wear the site's colours and type, so following "API docs" does not feel like leaving. --}}
    <style>
        @font-face { font-family: 'Geist'; src: url('{{ Vite::asset('resources/fonts/Geist-Variable.woff2') }}') format('woff2'); font-weight: 100 900; font-display: swap; }
        @font-face { font-family: 'Geist Mono'; src: url('{{ Vite::asset('resources/fonts/GeistMono-Variable.woff2') }}') format('woff2'); font-weight: 100 900; font-display: swap; }
        [data-theme="dark"] {
            --font-ui: 'Geist', ui-sans-serif, system-ui, sans-serif;
            --font-prose: 'Geist', ui-sans-serif, system-ui, sans-serif;
            --font-code: 'Geist Mono', ui-monospace, monospace;
            --font-mono: 'Geist Mono', ui-monospace, monospace;
            --color-canvas: #050506;
            --color-canvas-pure: #050506;
            --color-canvas-tint: #08080a;
            --color-canvas-50: #08080a;
            --color-canvas-100: #0b0b0d;
            --color-canvas-200: #111114;
            --color-canvas-300: #18181b;
            --color-canvas-400: #1f1f23;
            --color-canvas-500: #27272a;
            --color-canvas-dialog: #0b0b0d;
            --color-primary: #ff3b30;
            --color-primary-tint: rgba(255, 59, 48, 0.12);
            --color-primary-light: #ff6a61;
            --color-primary-dark: #e0261c;
            --color-text: #e4e4e7;
            --color-text-heading: #fafafa;
            --color-text-paragraph: #d4d4d8;
            --color-text-muted: #a1a1aa;
            --color-text-light: #a1a1aa;
            --color-link: #ff6a61;
        }
        [data-theme="dark"] ::selection { background: #ff3b30; color: #000; }
        html, body { margin:0; height:100%; }
        body { background-color: var(--color-canvas); }
        /* issues about the dark theme of stoplight/mosaic-code-viewer using web component:
         * https://github.com/stoplightio/elements/issues/2188#issuecomment-1485461965
         */
        [data-theme="dark"] .token.property {
            color: rgb(128, 203, 196) !important;
        }
        [data-theme="dark"] .token.operator {
            color: rgb(255, 123, 114) !important;
        }
        [data-theme="dark"] .token.number {
            color: rgb(247, 140, 108) !important;
        }
        [data-theme="dark"] .token.string {
            color: rgb(165, 214, 255) !important;
        }
        [data-theme="dark"] .token.boolean {
            color: rgb(121, 192, 255) !important;
        }
        [data-theme="dark"] .token.punctuation {
            color: #dbdbdb !important;
        }
    </style>
</head>
<body style="height: 100vh; overflow-y: hidden">
<elements-api
    id="docs"
    @foreach($config->renderer()->all(except: ['theme']) as $key => $value)
        @continue(! $value)
        {{ $key }}="{{ $value === true ? 'true' : ($value === false ? 'false' : $value) }}"
    @endforeach
/>
<script>
    (async () => {
        const docs = document.getElementById('docs');
        docs.apiDescriptionDocument = @json($spec);
    })();
</script>

@if($config->renderer()->get('theme', 'light') === 'system')
    <script>
        var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        function updateTheme(e) {
            if (e.matches) {
                window.document.documentElement.setAttribute('data-theme', 'dark');
                window.document.getElementsByName('color-scheme')[0].setAttribute('content', 'dark');
            } else {
                window.document.documentElement.setAttribute('data-theme', 'light');
                window.document.getElementsByName('color-scheme')[0].setAttribute('content', 'light');
            }
        }

        mediaQuery.addEventListener('change', updateTheme);
        updateTheme(mediaQuery);
    </script>
@endif
</body>
</html>
