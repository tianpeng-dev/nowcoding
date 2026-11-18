import { describe, expect, it } from 'vitest';
import { getDatabaseStatus } from '../src';
import {
  accountSecurityEvents,
  arenaConsents,
  cliAuthFlows,
  devices,
  leaderboardEntries,
  usageBuckets,
  usageSessions,
  users,
} from '../src/schema';

function getExtraConfigKeys(table: object) {
  const symbols = Object.getOwnPropertySymbols(table);
  const columnsSymbol = symbols.find((symbol) => String(symbol).includes('ExtraConfigColumns'));
  const builderSymbol = symbols.find((symbol) => String(symbol).includes('ExtraConfigBuilder'));

  if (!columnsSymbol || !builderSymbol) {
    return [];
  }

  const typedTable = table as Record<symbol, unknown>;
  const buildExtraConfig = typedTable[builderSymbol] as (
    columns: unknown,
  ) => Record<string, unknown>;

  return Object.keys(buildExtraConfig(typedTable[columnsSymbol]));
}

function expectColumnsNotNull(columns: Record<string, { notNull: boolean }>, names: string[]) {
  for (const name of names) {
    expect(columns[name]?.notNull, `${name} should be not null`).toBe(true);
  }
}

function sqlText(value: unknown) {
  const chunks = (value as { queryChunks?: { value?: string[] }[] }).queryChunks;

  return chunks?.flatMap((chunk) => chunk.value ?? []).join('');
}

describe('cloud schema contract', () => {
  it('keeps the legacy database status export', () => {
    expect(getDatabaseStatus()).toEqual({
      ready: true,
      service: 'cloud-db',
    });
  });

  it('defines account, device, usage, consent, and leaderboard tables', () => {
    expect(users._.name).toBe('users');
    expect(devices._.name).toBe('devices');
    expect(usageSessions._.name).toBe('usage_sessions');
    expect(arenaConsents._.name).toBe('arena_consents');
    expect(leaderboardEntries._.name).toBe('leaderboard_entries');
  });

  it('stores CLI device tokens transiently for one-time polling', () => {
    expect(cliAuthFlows.userCodeHash.name).toBe('user_code_hash');
    expect(cliAuthFlows.userCodeHash.notNull).toBe(false);
    expect(cliAuthFlows.deviceToken.name).toBe('device_token');
    expect(cliAuthFlows.deviceToken.notNull).toBe(false);
  });

  it('tracks production device metadata and lifecycle fields', () => {
    expect(devices.updatedAt.name).toBe('updated_at');
    expect(devices.confirmedAt.name).toBe('confirmed_at');
    expect(devices.hostname.name).toBe('hostname');
    expect(devices.platform.name).toBe('platform');
    expect(devices.cliVersion.name).toBe('cli_version');
    expect(devices.clientInfo.name).toBe('client_info');
    expect(devices.lastIpHash.name).toBe('last_ip_hash');
    expect(devices.revokedReason.name).toBe('revoked_reason');
  });

  it('tracks non-secret CLI auth flow status for the browser confirmation page', () => {
    expect(cliAuthFlows.claimedAt.name).toBe('claimed_at');
    expect(cliAuthFlows.statusNonceHash.name).toBe('status_nonce_hash');
    expect(cliAuthFlows.statusExpiresAt.name).toBe('status_expires_at');
  });

  it('defines private account security events', () => {
    expect(accountSecurityEvents._.name).toBe('account_security_events');
    expect(accountSecurityEvents.userId.name).toBe('user_id');
    expect(accountSecurityEvents.deviceId.name).toBe('device_id');
    expect(accountSecurityEvents.eventType.name).toBe('event_type');
    expect(accountSecurityEvents.eventType.notNull).toBe(true);
    expect(accountSecurityEvents.metadata.name).toBe('metadata');
    expect(accountSecurityEvents.metadata.notNull).toBe(true);
    expect(sqlText(accountSecurityEvents.metadata.default)).toBe("'{}'::jsonb");
    expect(accountSecurityEvents.ipHash.name).toBe('ip_hash');
    expect(accountSecurityEvents.createdAt.name).toBe('created_at');
  });

  it('uses planned index key names', () => {
    expect(getExtraConfigKeys(devices)).toEqual(['userIdx']);
    expect(getExtraConfigKeys(cliAuthFlows)).toEqual(['userIdx', 'deviceIdx']);
    expect(getExtraConfigKeys(usageBuckets)).toEqual(['uniq', 'userTimeIdx', 'deviceIdx']);
    expect(getExtraConfigKeys(usageSessions)).toEqual(['uniq', 'userTimeIdx', 'deviceIdx']);
    expect(getExtraConfigKeys(leaderboardEntries)).toEqual(['uniq', 'userIdx']);
    expect(getExtraConfigKeys(accountSecurityEvents)).toEqual(['userIdx', 'deviceIdx']);
  });

  it('marks unique identity columns as not null', () => {
    expectColumnsNotNull(usageBuckets, [
      'userId',
      'deviceId',
      'source',
      'model',
      'project',
      'bucketStart',
      'hostname',
    ]);
    expectColumnsNotNull(usageSessions, [
      'userId',
      'deviceId',
      'source',
      'project',
      'sessionHash',
      'firstMessageAt',
      'lastMessageAt',
      'durationSeconds',
      'activeSeconds',
      'messageCount',
      'userMessageCount',
      'userPromptHours',
      'hostname',
    ]);
    expectColumnsNotNull(leaderboardEntries, ['range', 'scope', 'metric', 'userId', 'generatedAt']);
  });

  it('uses a not-null jsonb array default for public arena fields', () => {
    expect(arenaConsents.publicFields.notNull).toBe(true);
    expect(sqlText(arenaConsents.publicFields.default)).toBe("'[]'::jsonb");
  });
});
