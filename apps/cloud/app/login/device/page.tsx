import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import CloudNav from '../../components/cloud-nav';
import DeviceStatusClient from './device-status-client';

type DeviceLoginPageProps = {
  searchParams?: Promise<{
    mode?: string;
    status?: string;
  }>;
};

type DeviceLoginTranslator = Awaited<ReturnType<typeof getTranslations>>;

function getStatusMessage(t: DeviceLoginTranslator, status?: string) {
  if (status === 'invalid') {
    return t('deviceCodeMissing');
  }

  if (status === 'expired') {
    return t('githubExpired');
  }

  return null;
}

function DeviceCodeForm({
  statusMessage,
  t,
}: {
  statusMessage?: string | null;
  t: DeviceLoginTranslator;
}) {
  return (
    <div className="form-panel">
      <form action="/api/auth/cli/confirm" method="post">
        <div className="field">
          <label htmlFor="userCode">{t('deviceCode')}</label>
          <input
            autoComplete="one-time-code"
            id="userCode"
            name="userCode"
            placeholder="NC-ABCD-2345"
            required
          />
        </div>
        <label className="check-row" htmlFor="joinArena">
          <input defaultChecked id="joinArena" name="joinArena" type="checkbox" value="true" />
          <span>{t('joinLeaderboard')}</span>
        </label>
        <p className="help">{t('joinLeaderboardHelp')}</p>
        <button className="button primary" type="submit">
          {t('confirmDevice')}
        </button>
      </form>
      {statusMessage ? <p className="notice">{statusMessage}</p> : null}
    </div>
  );
}

export default async function DeviceLoginPage({ searchParams }: DeviceLoginPageProps) {
  const params = await searchParams;
  const t = await getTranslations('deviceLogin');
  const statusMessage = getStatusMessage(t, params?.status);
  const showManualForm =
    params?.mode === 'manual' || params?.status === 'invalid' || params?.status === 'expired';
  const confirmed = params?.status === 'confirmed';
  const manualSuccess = params?.status === 'success';

  return (
    <main className="shell account-layout">
      <CloudNav active="account" note={t('navNote')} signInReturnTo="/login/device" />

      {confirmed ? (
        <section className="device-confirmation">
          <p className="eyebrow">{t('deviceLogin')}</p>
          <h1>{t('deviceAdded')}</h1>
          <p className="lead">{t('authorizedTerminal')}</p>
          <p className="help">{t('reviewSetup')}</p>
          <DeviceStatusClient />
          <div className="device-actions">
            <Link className="button primary" href="/onboarding">
              {t('continueOnboarding')}
            </Link>
            <Link className="button secondary" href="/account/devices">
              {t('manageDevices')}
            </Link>
          </div>
        </section>
      ) : null}

      {manualSuccess ? (
        <section className="device-confirmation">
          <p className="eyebrow">{t('deviceLogin')}</p>
          <h1>{t('deviceConfirmed')}</h1>
          <p className="lead">{t('authorizedReturn')}</p>
          <Link className="button secondary" href="/account/devices">
            {t('manageDevices')}
          </Link>
        </section>
      ) : null}

      {showManualForm ? (
        <section className="form-shell">
          <p className="eyebrow">{t('deviceLogin')}</p>
          <h1>{t('confirmCliLogin')}</h1>
          <p className="lead">{t('enterDeviceCode')}</p>
          <DeviceCodeForm statusMessage={statusMessage} t={t} />
        </section>
      ) : null}

      {!confirmed && !manualSuccess && !showManualForm ? (
        <section className="device-confirmation">
          <p className="eyebrow">{t('deviceLogin')}</p>
          <h1>{t('connectCli')}</h1>
          <p className="lead">{t('startFromTerminal')}</p>
          <Link className="button primary" href="/login/device?mode=manual">
            {t('enterDeviceCodeAction')}
          </Link>
        </section>
      ) : null}
    </main>
  );
}
