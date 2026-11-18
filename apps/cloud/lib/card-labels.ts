import { formatTokenTotal } from './profile-data';
export function clampLabel(value: string | null | undefined, maxLength: number): string {
  if (maxLength <= 0) {
    return '';
  }

  const normalized = value?.trim() || 'none';
  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 3) {
    return normalized.slice(0, maxLength);
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function formatCompactTokenTotal(value: string): string {
  const total = BigInt(value);
  const thresholds: Array<[bigint, string]> = [
    [1_000_000_000_000_000n, 'P'],
    [1_000_000_000_000n, 'T'],
    [1_000_000_000n, 'B'],
    [1_000_000n, 'M'],
  ];
  const threshold = thresholds.find(([minimum]) => total >= minimum);

  if (!threshold) {
    return formatTokenTotal(value);
  }

  const [divisor, suffix] = threshold;
  const scaledTenths = (total * 10n + divisor / 2n) / divisor;
  const whole = scaledTenths / 10n;
  const tenths = scaledTenths % 10n;
  const formatted =
    tenths === 0n
      ? whole.toLocaleString('en-US')
      : `${whole.toLocaleString('en-US')}.${tenths.toString()}`;

  return `${formatted}${suffix}`;
}
