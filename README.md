# Glass Box

A personal site for a backend engineer, built so that the thing it claims to be good at is
visible rather than described. The home page draws a map of the stack; that map is not
markup, it is `GET /api/stack` answering. A second tab sends that same request again and
shows what happened inside it: the browser's own timings, every span on the server, the SQL
with the database's query plan, and the lines of deployed code each step came from.

## Stack

Laravel 12 · PHP 8.3 · Inertia · React 19 · TypeScript · Tailwind 4 · SQLite · Pest ·
Scramble (OpenAPI).

## Running it

```bash
composer install && npm install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
npm run build            # or: npm run dev
php artisan serve
```

The site is at `/`, the generated API documentation at `/docs/api`.

## The API

Everything the page shows comes from these endpoints. There is no data in the HTML.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/profile` | Name, role, location, focus and links |
| GET | `/api/stack` | Stack layers with the tools inside them |
| GET | `/api/systems` | Systems built, each with problem, approach and lesson |
| GET | `/api/decisions` | Operating rules and what taught each one |
| GET | `/api/traces/{id}` | A recorded request: spans, SQL, query plans, source |
| POST | `/api/traces/{id}/client-timing` | Browser timings the server cannot measure |

Responses are cached for five minutes and carry `Cache-Status`. The public rate limit is 60
requests a minute per address.

## Tracing

Every API response carries an `X-Trace-Id`. Pass it to `/api/traces/{id}` and the whole
request comes back.

Explanations live in the code rather than in a content file, so they cannot drift from what
the code does:

```php
#[Trace('Stack map', why: 'Read-heavy, changes a few times a month, safe to cache for five minutes.')]
public function index(): JsonResponse
```

PHP attributes attach to declarations only, so a block inside a method is wrapped instead:

```php
Tracing::span(
    #[Trace('Build the map', why: 'Runs only on a cache miss.')]
    fn () => StackLayerResource::collection($this->stack->map())->resolve(),
);
```

How it fits together:

- `TraceRequest` opens the root span before anything else in the API group, so a throttled
  or rejected request still leaves a record, and stores the trace after the response is sent.
- `TraceRoute` wraps the controller action and marks where middleware ends.
- A query listener records each statement with its bindings, its `EXPLAIN` output and the
  application line that issued it. Cache, session and queue statements are left out: they
  are plumbing, not the story of the request.
- `SourceExcerpt` reads the lines from the checkout that served the request, with the commit
  hash, so nothing on the page is a paste.
- The tracer reports what its spans did not claim as unattributed time. Leaf spans plus
  unattributed always equals the total, and a test asserts it.

Traces live in the cache for `TRACING_TTL_MINUTES` (default one day). Turn the whole thing
off with `TRACING_ENABLED=false`; set `APP_COMMIT` in deploys where `git` is not available.

## Tests

```bash
php artisan test
./vendor/bin/pint
```

44 tests cover the endpoints, the cache behaviour (second request touches no database), the
recorded spans, the attribute explanations, the query plans, the unattributed arithmetic,
and the OpenAPI document.

## Content

Content lives in the database, seeded from `database/seeders/PortfolioSeeder.php`; the
stack map's rows come from `database/seeders/data/stack.json`. Nothing in this repository
names an employer, a server, an internal package or an application.
