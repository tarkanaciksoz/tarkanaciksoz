# Tarkan Açıksöz

Backend & infrastructure engineer in Istanbul. I build and run the APIs, payments, push and
AI pipelines behind mobile apps, and the servers they run on.

**[tarkanaciksoz.com](https://tarkanaciksoz.com)** ·
[LinkedIn](https://www.linkedin.com/in/tarkan-a%C3%A7%C4%B1ks%C3%B6z-5b2863208) ·
[tarkanaciksoz@gmail.com](mailto:tarkanaciksoz@gmail.com)

---

## This repository is the site

The page at [tarkanaciksoz.com](https://tarkanaciksoz.com) is built so that what it claims
is visible rather than described:

- **Everything on it comes from its own API.** The stack map, the systems, the rules and the
  profile are JSON from the endpoints below; there is no content in the HTML.
- **Every dot on the page is a byte.** The field of bits that draws the sphere, the stack and
  the numbers is one point per byte of the `GET /api/stack` response that drew it.
- **It traces itself.** The page sends a real request as you arrive and walks you through
  where its milliseconds went: DNS, connection, the server's boot and middleware, the
  controller, the cache, the SQL with the database's own query plan, and the bytes on the
  wire, each beside the code or record it rests on.

## The API

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/profile` | Name, role, location, focus and links |
| GET | `/api/stack` | Stack layers with the tools inside them |
| GET | `/api/flows` | Scenarios routed through the stack, hop by hop |
| GET | `/api/systems` | Systems built, each with problem, approach and lesson |
| GET | `/api/decisions` | Operating rules and what taught each one |
| GET | `/api/traces/{id}` | A recorded request: spans, SQL, query plans, source |
| POST | `/api/traces/{id}/client-timing` | Browser timings the server cannot measure |

Responses are cached for five minutes and carry `Cache-Status`. The public rate limit is 60
requests a minute per address. The OpenAPI document is generated from the code and served
at [`/docs/api`](https://tarkanaciksoz.com/docs/api).

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

## The front end

Inertia with React 19 and TypeScript, Tailwind 4. One Three.js points field (a lazy chunk)
carries every visual: sections register a shape and the bits spring to it as the section
crosses the middle of the screen. GSAP drives the pinned sections and smooth scrolling.
The terminal under `whoami` is a small client-side shell: `help`, `ls`, `cat`, and `curl`
against the real API.

## Running it

```bash
composer install && npm install
cp .env.example .env && php artisan key:generate
# for local work: APP_URL=http://localhost:8000, APP_ENV=local, APP_DEBUG=true
touch database/database.sqlite
php artisan migrate --seed
npm run dev              # or: npm run build
php artisan serve
```

Laravel 12 · PHP 8.3+ · Inertia · React 19 · TypeScript · Tailwind 4 · Three.js · GSAP ·
SQLite · Pest · Scramble.

## Deploying

The server holds a git checkout of `main` behind nginx and Cloudflare. One command, run there
as root, pulls, installs, builds the assets, migrates, syncs the content from the seed files
and rebuilds the caches:

```bash
deploy-tarkanaciksoz
```

That command is `scripts/deploy.sh`, installed root-owned in `/usr/local/sbin`. Root never
runs the copy inside the checkout, which the deploy itself rewrites; a change to the script
is reviewed and installed by hand (the command is in the script's header).

## Tests

```bash
php artisan test
./vendor/bin/pint
```

The tests cover the endpoints, the cache behaviour (a second request touches no database),
the recorded spans, the attribute explanations, the query plans, the unattributed
arithmetic and the OpenAPI document.

## Content

Content lives in the database, seeded from `database/seeders/PortfolioSeeder.php`; the stack
map comes from `database/seeders/data/stack.json` and the scenarios from
`database/seeders/data/flows.php`.
