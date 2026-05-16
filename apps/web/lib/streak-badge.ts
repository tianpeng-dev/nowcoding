import type { streakSchema } from '@nowcoding/core/schemas';
import type { z } from 'zod';

type StreakResult = z.infer<typeof streakSchema>;

export interface BadgeData {
  label: string;
  value: string;
  theme: 'light' | 'dark';
}

export function streakBadgeData(
  username: string,
  streak: StreakResult,
  theme: 'light' | 'dark',
): BadgeData {
  return {
    label: `${username} · streak`,
    value: `${streak.current}d`,
    theme,
  };
}
