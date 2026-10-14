<?php

namespace Database\Seeders;

use App\Models\Decision;
use App\Models\Flow;
use App\Models\StackItem;
use App\Models\StackLayer;
use App\Models\System;
use Illuminate\Database\Seeder;

class PortfolioSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedStack();
        $this->seedSystems();
        $this->seedDecisions();
        $this->seedFlows();
    }

    private function seedStack(): void
    {
        $layers = json_decode(file_get_contents(database_path('seeders/data/stack.json')), true);

        foreach ($layers as $layer) {
            $model = StackLayer::updateOrCreate(
                ['slug' => $layer['slug']],
                ['name' => $layer['name'], 'tagline' => $layer['tagline'], 'glyph' => $layer['glyph'], 'position' => $layer['position']],
            );

            foreach ($layer['items'] as $item) {
                $model->items()->updateOrCreate(
                    ['name' => $item['name']],
                    [
                        'usage' => $item['usage'],
                        'services' => $item['services'] ?? null,
                        'icon' => isset($item['icon']) ? "/icons/stack/{$item['icon']}.svg" : null,
                        'why' => $item['why'],
                        'instead_of' => $item['instead_of'],
                        'position' => $item['position'],
                        'visible' => true,
                    ],
                );
            }
        }
    }

    private function seedSystems(): void
    {
        $systems = [
            [
                'slug' => 'payments',
                'title' => 'Payments and subscriptions',
                'summary' => 'One purchase package for every app: store webhooks in, typed subscription events out.',
                'problem' => 'Each app validated receipts its own way. Renewals, grace periods and refunds were handled differently or not at all. A store change meant touching every repository.',
                'approach' => 'A webhook route per provider normalises subscription-platform and native store notifications into 17 typed events: initial purchase, renewal, grace period, refund and the rest. Receipts are verified server-side against both stores. Store credentials are managed centrally and copied into each app at deploy.',
                'lesson' => 'A package tag once shipped with a broken lockfile, and every deploy resolved dependencies fresh. Lockfiles are part of the image now.',
                'tags' => ['App Store Server API', 'Google Play RTDN', 'receipt validation', 'webhooks'],
                'scale' => 'in 25 of 57 services · 17 event listeners',
            ],
            [
                'slug' => 'push',
                'title' => 'Push notifications',
                'summary' => 'Every app moved to a new push provider without rewriting a single notification class.',
                'problem' => 'Notification code was tied to the old provider\'s tag model, so moving meant a rewrite per app. Failures were silent: a topic unsubscribe returned 200 and failed, and devices got every push twice.',
                'approach' => 'The provider is a driver switch in the environment file. One target abstraction maps a device id to a tag filter or a topic. Device tokens are imported in resumable batches of 500, and the OAuth token refreshes five minutes before its one-hour expiry, because an hour-long import once died at minute sixty. Topic sync retries on a queue with backoff, and "not found" on unsubscribe counts as success.',
                'lesson' => 'Any call that can fail quietly should fail loudly, in one place. The silent unsubscribe was found by an exception tracker, not by a user.',
                'tags' => ['FCM', 'token import', 'queued sync', 'Pest'],
                'scale' => 'v1.0 to v1.5 in 15 days, 3 apps live, 12 integrations open',
            ],
            [
                'slug' => 'ai-media',
                'title' => 'AI and media pipelines',
                'summary' => 'Video, music, voice, logos, headshots, interiors: generation that takes longer than a phone can wait.',
                'problem' => 'A generation takes ten seconds to two minutes. A phone cannot hold a connection open that long on a bad network, and provider rate limits punish bursts.',
                'approach' => 'The request creates a job and returns at once. A worker calls the provider, post-processes with libvips or ffmpeg, writes to object storage and notifies the device through the push package. Images are resized and optimised on write, never on read.',
                'lesson' => 'Egress was 3 TB a month and made up most of the storage bill. A CDN in front of the two heaviest buckets cut roughly a hundred dollars a month, with no application change.',
                'tags' => ['queued workers', 'OpenAI', 'libvips', 'ffmpeg', 'CDN'],
                'scale' => 'AI providers in 32 services · media libraries in 28',
            ],
            [
                'slug' => 'analytics',
                'title' => 'Data and analytics',
                'summary' => 'A live mirror of every app database in a column store, so dashboards stop hurting production.',
                'problem' => 'The control plane reads every production database for dashboards, marketing and lifetime value. On the big apps those queries took thirty seconds and competed with real users.',
                'approach' => 'Change data capture streams the binlogs into a column store through an object-storage staging layer. It behaves like a read-only replica built for aggregates: the same queries return in well under a second, and production never sees them.',
                'lesson' => 'The mirror\'s own system log tables grew to 70 GB and filled a disk. They have retention and a memory ceiling now.',
                'tags' => ['MySQL', 'CDC', 'ClickHouse', 'object storage'],
                'scale' => 'heaviest dashboards: 30 s to under 1 s',
            ],
            [
                'slug' => 'control-plane',
                'title' => 'Control plane',
                'summary' => 'One panel for thirteen apps, each with its own database.',
                'problem' => 'Thirteen admin panels, thirteen logins, thirteen ways to rotate a credential or read a number.',
                'approach' => 'A Laravel API switches its default database connection per request, from a middleware that knows which app is being asked about. It reads the fleet through shared databases, not HTTP. A React shell sits in front. Store keys, push credentials and ad-platform tokens are managed per app here and copied into deployments.',
                'lesson' => 'Credentials stored as file paths break the moment the app is containerised. They are fetched from a bucket at boot now, and a missing file fails the boot instead of the first push.',
                'tags' => ['Laravel', 'React', 'Sanctum', 'per-request connections'],
                'scale' => '13 apps, 1 codebase, 0 HTTP calls between panel and fleet',
            ],
            [
                'slug' => 'skeleton',
                'title' => 'Auth and the app skeleton',
                'summary' => 'Most APIs start as a fork of one skeleton, so a new app has a backend on day one.',
                'problem' => 'Consumer apps have devices, not accounts. Users should never see a login screen, yet every request must be attributable and revocable.',
                'approach' => 'A device id is upserted and a token comes back. A shared auth package covers the mobile side, session tokens cover the panels, role permissions sit inside. Transformers give every response the same envelope, and the OpenAPI document is generated from the code, not written by hand.',
                'lesson' => 'A shared auth package is leverage until it drifts. Removing an old one took a coordinated change across 34 services.',
                'tags' => ['device tokens', 'Sanctum', 'transformers', 'OpenAPI'],
                'scale' => 'session tokens in 47 services · generated docs in 35',
            ],
            [
                'slug' => 'realtime',
                'title' => 'Real-time and TV',
                'summary' => 'Socket services beside the APIs: assistants, signalling, messaging, remote control for TV and car.',
                'problem' => 'A remote control cannot poll. An assistant needs a session. A process-per-request runtime is the wrong tool for a connection that stays open.',
                'approach' => 'Node socket services run under a process manager next to the PHP APIs. When one needs application data it calls an internal endpoint protected by a shared key, never the public API, so rate limits and device auth stay untouched.',
                'lesson' => null,
                'tags' => ['socket.io', 'process manager', 'internal endpoints'],
                'scale' => '5 socket services in production',
            ],
            [
                'slug' => 'vpn',
                'title' => 'VPN fleet',
                'summary' => 'An API that provisions VPN peers across a fleet of nodes and expires them with the subscription.',
                'problem' => 'A peer must exist for exactly as long as a subscription does, on whichever node has room, and disappear when payment stops.',
                'approach' => 'Each node is a database row and runs a small HTTP agent. The API leases a peer on a node with room and hands the client its configuration. A scheduled job checks every lease against the payment events from the purchase package.',
                'lesson' => null,
                'tags' => ['WireGuard', 'lease enforcement', 'scheduler'],
                'scale' => null,
            ],
        ];

        foreach ($systems as $i => $system) {
            // A photograph only when the file is really there; the page draws none otherwise.
            $image = "/images/systems/{$system['slug']}.jpg";
            $system['image'] = file_exists(public_path($image)) ? $image : null;

            System::updateOrCreate(['slug' => $system['slug']], $system + ['position' => $i + 1, 'visible' => true]);
        }
    }

    private function seedFlows(): void
    {
        $known = StackItem::query()->pluck('name')->all();

        foreach (require database_path('seeders/data/flows.php') as $i => $flow) {
            foreach ($flow['steps'] as $step) {
                if (! in_array($step['tool'], $known, true)) {
                    throw new \RuntimeException("Flow {$flow['slug']} points at an unknown tool: {$step['tool']}");
                }
            }

            Flow::updateOrCreate(['slug' => $flow['slug']], $flow + ['position' => $i + 1, 'visible' => true]);
        }
    }

    private function seedDecisions(): void
    {
        $decisions = [
            ['ARM by default', 'ARM instances are cheaper for the same work, and every image builds for both. Nothing has needed an exception yet.'],
            ['One entry point, strict TLS', 'Public IPs behind the proxy meant no strict TLS to the origin and no place to move traffic. A load balancer fixes both: encryption end to end, and a switch that is not a DNS change.'],
            ['Backups exist, restores are tested', 'Volume snapshots run on every machine. A snapshot only counts after the drill: restore it into a scratch instance and time it.'],
            ['Debug tooling off in production', 'A request profiler left on by default records every scheduled task run. Production pins it off; an exception tracker does the job instead.'],
            ['One scheduler, one queue, per app', 'Duplicating a server duplicates its scheduler. A copy boots with the process manager and cron disabled, because two schedulers mean two pushes and two charges.'],
            ['Connections are a budget', 'After a CPU incident on the data box, the connection cap came down and three apps moved their cache off the database in the same week.'],
            ['Secrets are files, and files are a trap', 'A credential referenced by path works until the app is containerised. Fetch it at boot, and let a missing one fail the boot, not the first push.'],
            ['Start small, measure, grow', 'Every instance size came from a thirty-day graph. A new cluster starts at one node and grows when a metric asks, not when a plan does.'],
            ['Scale the app, not the server', 'A container has a memory limit, so an out-of-memory kills one task and not its neighbours. An immutable image means configuration cannot drift between copies.'],
            ['Spend on the edge where the bill says so', 'Most buckets do not move enough bytes to matter. The two behind most of the bill got a CDN; nothing else did.'],
        ];

        foreach ($decisions as $i => [$title, $body]) {
            Decision::updateOrCreate(['title' => $title], ['body' => $body, 'position' => $i + 1, 'visible' => true]);
        }
    }
}
