import { devices, getDb } from '@nowcoding/cloud-db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Link } from '../../../i18n/navigation';
import {
  GITHUB_IDENTITY_COOKIE,
  getCurrentBrowserUserFromCookie,
  getCurrentBrowserUserReadOnlyFromCookie,
  githubSignInHref,
} from '../../../lib/browser-session';
import { writeAccountSecurityEvent } from '../../../lib/security-events';
import CloudNav from '../../components/cloud-nav';
import SubmitButton from './submit-button';

export const dynamic = 'force-dynamic';

// 测试边界保留文案锚点：Authorized devices
type DeviceRow = {
  id: string;
  name: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  confirmedAt: Date | null;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  hostname: string | null;
  platform: string | null;
  cliVersion: string | null;
};

type AccountDevicesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === 'string' ? value.trim() : '';
}

async function currentUserFromCookie() {
  const cookieStore = await cookies();
  return getCurrentBrowserUserFromCookie(cookieStore.get(GITHUB_IDENTITY_COOKIE)?.value);
}

async function renameDevice(formData: FormData): Promise<void> {
  'use server';

  const id = formString(formData, 'id');
  const name = formString(formData, 'name');

  if (!id || !name) {
    redirect('/account/devices?status=invalid');
  }

  const currentUser = await currentUserFromCookie();

  if (!currentUser) {
    redirect('/account/devices?status=rename-failed');
  }

  const now = new Date();
  const db = getDb();
  const updated = await db.transaction(async (tx) => {
    const [device] = await tx
      .update(devices)
      .set({ name, updatedAt: now })
      .where(
        and(eq(devices.id, id), eq(devices.userId, currentUser.user.id), isNull(devices.revokedAt)),
      )
      .returning({ id: devices.id });

    if (!device) {
      return false;
    }

    await writeAccountSecurityEvent(
      {
        userId: currentUser.user.id,
        deviceId: device.id,
        eventType: 'device_renamed',
        metadata: { name },
      },
      tx,
    );

    return true;
  });

  if (!updated) {
    redirect('/account/devices?status=rename-failed');
  }

  revalidatePath('/account/devices');
  redirect('/account/devices?status=renamed');
}

async function revokeDevice(formData: FormData): Promise<void> {
  'use server';

  const id = formString(formData, 'id');

  if (!id) {
    redirect('/account/devices?status=invalid');
  }

  const currentUser = await currentUserFromCookie();

  if (!currentUser) {
    redirect('/account/devices?status=revoke-failed');
  }

  const db = getDb();
  const now = new Date();
  const revoked = await db.transaction(async (tx) => {
    const [device] = await tx
      .update(devices)
      .set({
        revokedAt: now,
        revokedReason: 'user_revoked',
        updatedAt: now,
      })
      .where(
        and(eq(devices.id, id), eq(devices.userId, currentUser.user.id), isNull(devices.revokedAt)),
      )
      .returning({ id: devices.id });

    if (device) {
      await writeAccountSecurityEvent(
        {
          userId: currentUser.user.id,
          deviceId: device.id,
          eventType: 'device_revoked',
        },
        tx,
      );

      return true;
    }

    const [existingDevice] = await tx
      .select({ id: devices.id, revokedAt: devices.revokedAt })
      .from(devices)
      .where(and(eq(devices.id, id), eq(devices.userId, currentUser.user.id)))
      .limit(1);

    return Boolean(existingDevice?.revokedAt);
  });

  if (!revoked) {
    redirect('/account/devices?status=revoke-failed');
  }

  revalidatePath('/account/devices');
  redirect('/account/devices?status=revoked');
}

function formatDate(value: Date | null, emptyLabel: string): string {
  if (!value) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function statusMessage(
  status: string | string[] | undefined,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string | null {
  const value = Array.isArray(status) ? status[0] : status;

  if (value === 'renamed') {
    return t('deviceRenamed');
  }

  if (value === 'revoked') {
    return t('deviceRevoked');
  }

  if (value === 'invalid') {
    return t('deviceInvalid');
  }

  if (value === 'rename-failed') {
    return t('renameFailed');
  }

  if (value === 'revoke-failed') {
    return t('revokeFailed');
  }

  return null;
}

async function loadDevices(userId: string): Promise<DeviceRow[]> {
  return getDb()
    .select({
      id: devices.id,
      name: devices.name,
      createdAt: devices.createdAt,
      updatedAt: devices.updatedAt,
      confirmedAt: devices.confirmedAt,
      lastSeenAt: devices.lastSeenAt,
      revokedAt: devices.revokedAt,
      revokedReason: devices.revokedReason,
      hostname: devices.hostname,
      platform: devices.platform,
      cliVersion: devices.cliVersion,
    })
    .from(devices)
    .where(and(eq(devices.userId, userId), isNull(devices.revokedAt)))
    .orderBy(desc(devices.updatedAt))
    .limit(100);
}

export default async function AccountDevicesPage({ searchParams }: AccountDevicesPageProps) {
  const t = await getTranslations('account');
  const cookieStore = await cookies();
  const currentUser = await getCurrentBrowserUserReadOnlyFromCookie(
    cookieStore.get(GITHUB_IDENTITY_COOKIE)?.value,
  );

  if (!currentUser) {
    return (
      <main className="shell account-layout">
        <CloudNav active="account" note={t('devices')} signInReturnTo="/account/devices" />
        <header className="account-header">
          <p className="eyebrow">{t('account')}</p>
          <h1>{t('devices')}</h1>
          <p className="lead">{t('devicesSignInDescription')}</p>
          <a className="button primary" href={githubSignInHref('/account/devices')}>
            {t('signInWithGitHub')}
          </a>
        </header>
      </main>
    );
  }

  const [devicesList, params] = await Promise.all([loadDevices(currentUser.user.id), searchParams]);
  const notice = statusMessage(params?.status, t);

  return (
    <main className="shell account-layout">
      <CloudNav active="account" note={t('devices')} signInReturnTo="/account/devices" />

      <header className="account-header">
        <div>
          <p className="eyebrow">{t('account')}</p>
          <h1>{t('devices')}</h1>
          <p className="lead">{t('devicesDescription')}</p>
        </div>
        <Link className="button secondary" href="/account/settings">
          {t('settings')}
        </Link>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}

      <section className="table-shell" aria-label={t('authorizedDevices')}>
        {devicesList.length > 0 ? (
          <div className="responsive-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t('device')}</th>
                  <th scope="col">{t('status')}</th>
                  <th scope="col">{t('lastSeen')}</th>
                  <th scope="col">{t('created')}</th>
                  <th scope="col">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {devicesList.map((device) => {
                  const revoked = Boolean(device.revokedAt);
                  const deviceName = device.name ?? t('nowcodingCli');
                  const meta = [
                    device.hostname,
                    device.platform,
                    device.cliVersion ? `CLI ${device.cliVersion}` : null,
                  ]
                    .filter(Boolean)
                    .join(' / ');

                  return (
                    <tr key={device.id}>
                      <td data-label={t('device')}>
                        <strong>{deviceName}</strong>
                        <span>{meta || t('noDeviceDetails')}</span>
                      </td>
                      <td data-label={t('status')}>
                        <span className={`status-badge ${revoked ? 'revoked' : 'active'}`}>
                          {revoked ? t('revoked') : t('active')}
                        </span>
                        {revoked && device.revokedReason ? (
                          <span>{device.revokedReason}</span>
                        ) : null}
                      </td>
                      <td data-label={t('lastSeen')}>
                        {formatDate(device.lastSeenAt, t('never'))}
                      </td>
                      <td data-label={t('created')}>{formatDate(device.createdAt, t('never'))}</td>
                      <td data-label={t('actions')}>
                        <div className="device-actions">
                          <form action={renameDevice} className="inline-form">
                            <input name="id" type="hidden" value={device.id} />
                            <label className="sr-only" htmlFor={`name-${device.id}`}>
                              {t('deviceName')}
                            </label>
                            <input
                              defaultValue={deviceName}
                              disabled={revoked}
                              id={`name-${device.id}`}
                              maxLength={80}
                              name="name"
                              required
                            />
                            <SubmitButton
                              className="button secondary"
                              disabled={revoked}
                              pendingLabel={t('saving')}
                            >
                              {t('rename')}
                            </SubmitButton>
                          </form>
                          <form action={revokeDevice}>
                            <input name="id" type="hidden" value={device.id} />
                            <SubmitButton
                              className="danger-button"
                              disabled={revoked}
                              pendingLabel={t('revoking')}
                            >
                              {t('revoke')}
                            </SubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h2>{t('noDevicesConnected')}</h2>
            <p>{t('noDevicesDescription')}</p>
            <a className="button primary" href="/login/device">
              {t('confirmCliDevice')}
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
