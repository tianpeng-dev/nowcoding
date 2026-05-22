import { buildModelPricingRows } from '@/lib/model-pricing';
import { publicModelPrices } from '@nowcoding/core/cost';
import { PRICE_VERSION } from '@nowcoding/core/schemas';

const PRICING_CORRECTIONS_URL = 'https://github.com/tianpeng-dev/nowcoding';

export default function ModelsPage() {
  const rows = buildModelPricingRows(publicModelPrices());

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Trust reference
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Model pricing</h1>
        <p className="mt-2 max-w-2xl text-neutral-500">
          NowCoding uses these public per-token estimates to label usage costs. This page is a
          supporting reference for transparency, not a promise that provider billing will always
          match every account, region, discount, or request mode.
        </p>
      </header>

      <section className="mt-6 rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 p-5 dark:border-neutral-800">
          <div>
            <h2 className="font-semibold">Current price table</h2>
            <p className="mt-1 text-sm text-neutral-500">Price version {PRICE_VERSION}</p>
          </div>
          <a
            className="text-sm font-medium text-blue-600 hover:underline"
            href={PRICING_CORRECTIONS_URL}
            rel="noreferrer"
            target="_blank"
          >
            Suggest a pricing correction
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-950">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Model
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Input
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Cached input
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Output
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((row) => (
                <tr key={row.model}>
                  <th scope="row" className="whitespace-nowrap px-5 py-3 text-left font-medium">
                    {row.model}
                  </th>
                  <td className="whitespace-nowrap px-5 py-3 text-neutral-600 dark:text-neutral-300">
                    {row.input}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-neutral-600 dark:text-neutral-300">
                    {row.cachedInput}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-neutral-600 dark:text-neutral-300">
                    {row.output}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-sm text-neutral-500">
        The estimator intentionally stays conservative: it publishes the table NowCoding can
        reconstruct from aggregate token buckets and leaves account-specific billing adjustments
        outside the main product story.
      </p>
    </main>
  );
}
