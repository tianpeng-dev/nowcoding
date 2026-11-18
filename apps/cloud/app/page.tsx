import { getCloudStatus } from '@nowcoding/cloud-core';
import { getDatabaseStatus } from '@nowcoding/cloud-db';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '../i18n/navigation';
import { loadLiveBuilderRows } from '../lib/now-feed';
import { PRIVACY_PROMISES, SOCIAL_PROOF_SIGNALS } from '../lib/social-positioning';
import CloudNav from './components/cloud-nav';

export const dynamic = 'force-dynamic';

async function safeLiveBuilders() {
  try {
    return await loadLiveBuilderRows(new Date(), 4);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('DATABASE_URL')) {
      console.error('[home] live builders failed:', error);
    }
    return [];
  }
}

export default async function CloudHomePage() {
  const cloudStatus = getCloudStatus();
  const databaseStatus = getDatabaseStatus();
  const liveBuilders = await safeLiveBuilders();
  const t = await getTranslations('home');

  return (
    <main className="nc-page">
      <CloudNav active="home" signInReturnTo="/" />

      <section className="nc-shell nc-hero" aria-labelledby="hero-title">
        <div>
          <p className="nc-kicker">{t('eyebrow')}</p>
          <h1 className="nc-title" id="hero-title">
            {t('headline')}
          </h1>
          <p className="nc-lead">{t('description')}</p>
          <div className="nc-cta">
            <a className="btn btn-primary" href="/api/auth/github/start">
              {t('cta.startBroadcasting')}
            </a>
            <Link className="btn btn-text" href="/leaderboard">
              {t('cta.viewArena')}
            </Link>
          </div>
          <div className="nc-status-strip" aria-label={t('status.serviceStatus')}>
            <span className="nc-pill">
              <span className="nc-dot" />
              {t('status.cloudCore')}: {cloudStatus.ready ? t('status.ready') : t('status.pending')}
            </span>
            <span className="nc-pill">
              <span className="nc-dot" />
              {t('status.database')}:{' '}
              {databaseStatus.ready ? t('status.ready') : t('status.pending')}
            </span>
          </div>
        </div>

        <aside className="nc-preview" aria-label={t('preview.cardPreview')}>
          <div className="nc-preview-top">
            <span className="nc-preview-kicker">NOWCODING · NOW</span>
            <span className="nc-live">
              <span className="nc-dot live" />
              {t(SOCIAL_PROOF_SIGNALS[0])}
            </span>
          </div>
          <div className="nc-metric">591.0M</div>
          <p className="nc-caption">{t('preview.tokensProcessed')}</p>
          <div className="nc-chart" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <span key={`preview-bar-${index + 1}`} />
            ))}
          </div>
          <div className="nc-stats">
            <div className="nc-stat">
              <div className="nc-label">{t('preview.model')}</div>
              <div className="nc-value">gpt-5.5</div>
            </div>
            <div className="nc-stat">
              <div className="nc-label">{t('preview.streak')}</div>
              <div className="nc-value">{t('preview.days', { count: 14 })}</div>
            </div>
            <div className="nc-stat">
              <div className="nc-label">{t(SOCIAL_PROOF_SIGNALS[3])}</div>
              <div className="nc-value">{t('preview.hours', { count: 124 })}</div>
            </div>
            <div className="nc-stat">
              <div className="nc-label">{t('preview.peak')}</div>
              <div className="nc-value">23:00-02:00</div>
            </div>
          </div>
        </aside>
      </section>

      <section
        className="nc-shell nc-section"
        aria-label={t('liveBuilders.label')}
        aria-labelledby="now-title"
        id="now"
      >
        <div className="nc-section-head">
          <div>
            <p className="nc-kicker">Now</p>
            <h2 id="now-title">{t('liveBuilders.headline')}</h2>
          </div>
        </div>
        <div className="nc-feed">
          {liveBuilders.length > 0 ? (
            <div className="nc-live-list">
              {liveBuilders.map((builder) => (
                <Link
                  className="nc-live-row"
                  href={builder.profileHref as Route}
                  key={builder.username}
                >
                  <span className={`nc-dot ${builder.state === 'live' ? 'live' : ''}`} />
                  <strong>@{builder.username}</strong>
                  <span>{builder.source ?? t('liveBuilders.defaultSource')}</span>
                  <span>
                    {t('liveBuilders.streak', {
                      count: builder.streak.toLocaleString('en-US'),
                    })}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <article className="nc-empty">
              <h3>{t('liveBuilders.emptyTitle')}</h3>
              <p>{t('liveBuilders.emptyDescription')}</p>
              <div className="nc-status-strip">
                <span className="nc-pill">
                  <span className="nc-dot" />
                  {t('liveBuilders.profileReady')}
                </span>
                <span className="nc-pill">
                  <span className="nc-dot live" />
                  {t('liveBuilders.awaitingOptIn')}
                </span>
              </div>
            </article>
          )}
          <aside className="nc-terminal" aria-label={t('liveBuilders.cliPreview')}>
            <div className="muted-line">$ nowcoding connect --provider github</div>
            <div className="ok-line">[READY] identity verified</div>
            <div className="muted-line">$ nowcoding broadcast --privacy safe</div>
            <div className="ok-line">[READY] profile card generated</div>
            <div className="signal-line">[LIVE] coding session detected</div>
            <div className="muted-line">prompts: not uploaded</div>
            <div className="muted-line">code: not uploaded</div>
          </aside>
        </div>
      </section>

      <section className="nc-shell nc-section" aria-labelledby="arena-title" id="arena">
        <div className="nc-section-head">
          <div>
            <p className="nc-kicker">{t('capabilities.label')}</p>
            <h2 id="arena-title">{t('capabilities.headline')}</h2>
          </div>
          <p>{t('capabilities.description')}</p>
        </div>
        <div className="nc-capabilities">
          <article className="nc-capability">
            <div>
              <h3>{t(SOCIAL_PROOF_SIGNALS[1])}</h3>
              <p>{t('capabilities.currentProject')}</p>
            </div>
            <div className="big">SVG</div>
          </article>
          <article className="nc-capability">
            <div>
              <h3>{t('capabilities.leaderboard')}</h3>
              <p>{t('capabilities.arena')}</p>
            </div>
            <div className="big">01</div>
          </article>
          <article className="nc-capability">
            <div>
              <h3>{t('capabilities.privacy')}</h3>
              <p>
                {t(PRIVACY_PROMISES[0])} {t(PRIVACY_PROMISES[3])}
              </p>
            </div>
            <div className="big">NO</div>
          </article>
        </div>
      </section>
    </main>
  );
}
