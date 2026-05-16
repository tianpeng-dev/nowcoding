import type { LiveStatus } from '@nowcoding/core/schemas';

export interface BadgeData {
  label: string;
  value: string;
  theme: 'light' | 'dark';
}

export function liveBadgeData(
  username: string,
  status: LiveStatus,
  theme: 'light' | 'dark',
): BadgeData {
  return {
    label: `${username} · live`,
    value: status,
    theme,
  };
}
