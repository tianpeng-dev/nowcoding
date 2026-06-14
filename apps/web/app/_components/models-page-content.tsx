import type { AppLocale } from '@/i18n/routing';
import { buildModelPricingRows } from '@/lib/model-pricing';
import { publicModelPrices } from '@nowcoding/core/cost';
import { PRICE_VERSION } from '@nowcoding/core/schemas';
import { getTranslations } from 'next-intl/server';

const PRICING_CORRECTIONS_URL = 'https://github.com/tianpeng-dev/nowcoding';

export async function ModelsPageContent({ locale }: { locale: AppLocale }) {
  const [t, modelPricingT] = await Promise.all([
    getTranslations({ locale, namespace: 'models' }),
    getTranslations({ locale, namespace: 'modelPricing' }),
  ]);
  const rows = buildModelPricingRows(publicModelPrices(), {
    perMillionTokens: modelPricingT('perMillionTokens'),
  });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{t('pageHeadline')}</h1>
        <p className="mt-2 max-w-2xl text-neutral-500">{t('pageDescription')}</p>
      </header>

      <section className="mt-6 rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 p-5 dark:border-neutral-800">
          <div>
            <h2 className="font-semibold">{t('currentPriceTable')}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {t('priceVersion', { version: PRICE_VERSION })}
            </p>
          </div>
          <a
            className="text-sm font-medium text-blue-600 hover:underline"
            href={PRICING_CORRECTIONS_URL}
            rel="noreferrer"
            target="_blank"
          >
            {t('suggestCorrection')}
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-950">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  {t('columns.model')}
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  {t('columns.input')}
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  {t('columns.cachedInput')}
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  {t('columns.output')}
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

      <p className="mt-4 text-sm text-neutral-500">{t('estimatorNote')}</p>
    </main>
  );
}
