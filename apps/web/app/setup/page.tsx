import { getEnv, getOwnerProfile } from '@/lib/env';
import { buildSetupStatus } from '@/lib/setup-status';

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  const env = getEnv();
  const owner = getOwnerProfile();
  const setup = buildSetupStatus({
    env,
    vercel: {
      vercelProjectProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
      vercelUrl: process.env.VERCEL_URL,
      vercelEnv: process.env.VERCEL_ENV,
    },
  });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="border-b border-neutral-200 pb-8 dark:border-neutral-800">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Setup wizard</p>
        <h1 className="mt-2 text-3xl font-semibold">Start broadcasting your AI coding presence</h1>
        <p className="mt-3 max-w-2xl text-neutral-500">
          Welcome, {owner.displayName}. NowCoding publishes live status, cards, and badges after the
          CLI syncs, while this setup page checks readiness without displaying secret values.
        </p>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {setup.statusCards.map((card) => (
          <article
            key={card.key}
            className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-medium">{card.label}</h2>
              <span
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  card.ok
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                }`}
              >
                {card.ok ? 'Ready' : 'Needs setup'}
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-500">{card.detail}</p>
          </article>
        ))}
      </section>

      <CommandBlock
        commands={setup.primaryCommands}
        description="Install the global CLI, initialize this deployment endpoint, and start the background daemon that keeps your public presence fresh."
        title={setup.primaryActionLabel}
      />

      <CommandBlock
        commands={setup.sourceCommands}
        description="Review and build the collector from GitHub source before trusting it with your local activity."
        title="Verify the open-source collector"
      />

      <section className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="font-semibold">Privacy gates</h2>
          <dl className="mt-4 divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            {setup.privacyRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-neutral-500">{row.label}</dt>
                <dd className="text-right font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="font-semibold">Parser readiness</h2>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {setup.parsers.map((parser) => (
              <div
                key={parser.source}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
              >
                <span className="font-medium">{parser.source}</span>
                <span className="text-neutral-500">{parser.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Deploy settings</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Manage missing environment variables and storage from Vercel.
            </p>
          </div>
          <a
            className="rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
            href={setup.dashboardUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open Vercel dashboard
          </a>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="font-semibold">After first sync</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SetupLink href="/" label="Public profile" />
          <SetupLink href="/card.svg" label="README card" />
          <SetupLink href="/og/summary" label="Share image" />
        </div>
      </section>
    </main>
  );
}

function CommandBlock({
  commands,
  description,
  title,
}: {
  commands: string[];
  description: string;
  title: string;
}) {
  return (
    <section className="mt-8 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
      <pre className="mt-4 overflow-x-auto rounded bg-neutral-100 p-4 text-xs leading-6 dark:bg-neutral-900">
        {commands.join('\n')}
      </pre>
    </section>
  );
}

function SetupLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
      href={href}
    >
      {label}
    </a>
  );
}
