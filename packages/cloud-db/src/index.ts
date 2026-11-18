export { getDb, schema } from './client';
export type { Database } from './client';
export * from './schema';

export type DatabaseStatus = {
  ready: boolean;
  service: 'cloud-db';
};

export function getDatabaseStatus(): DatabaseStatus {
  return {
    ready: true,
    service: 'cloud-db',
  };
}
