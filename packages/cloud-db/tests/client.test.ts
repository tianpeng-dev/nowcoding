import { describe, expect, it } from 'vitest';
import { getDatabaseMaxConnections, getDb } from '../src/client';

describe('cloud database client', () => {
  it('throws a clear error when DATABASE_URL is missing', () => {
    expect(() => getDb('')).toThrow('DATABASE_URL is required to create a cloud database client');
  });

  it('defaults max connections to 1 when env/input is missing', () => {
    expect(getDatabaseMaxConnections(undefined)).toBe(1);
  });

  it('parses a valid positive integer max connections string', () => {
    expect(getDatabaseMaxConnections('5')).toBe(5);
  });

  it('falls back to 1 for invalid, zero, and negative max connection values', () => {
    expect(getDatabaseMaxConnections('invalid')).toBe(1);
    expect(getDatabaseMaxConnections('2abc')).toBe(1);
    expect(getDatabaseMaxConnections('1.5')).toBe(1);
    expect(getDatabaseMaxConnections('0')).toBe(1);
    expect(getDatabaseMaxConnections('-3')).toBe(1);
  });

  it('accepts an explicit URL and optional max connections', () => {
    expect(() => getDb('postgres://user:pass@localhost:5432/nowcoding', '2')).not.toThrow();
  });

  it('reuses the database instance for the same explicit URL and max connections', () => {
    const databaseUrl = 'postgres://user:pass@localhost:5432/nowcoding';

    expect(getDb(databaseUrl, '2')).toBe(getDb(databaseUrl, '2'));
  });

  it('creates distinct database instances for different URLs or max connections', () => {
    const databaseUrl = 'postgres://user:pass@localhost:5432/nowcoding';

    expect(getDb(databaseUrl, '2')).not.toBe(getDb(databaseUrl, '3'));
    expect(getDb(databaseUrl, '2')).not.toBe(
      getDb('postgres://user:pass@localhost:5432/nowcoding_test', '2'),
    );
  });
});
