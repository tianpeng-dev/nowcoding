import type { HeatmapCell } from '@nowcoding/core/schemas';

const LEVEL_CLASS = {
  0: 'bg-neutral-100 dark:bg-neutral-900',
  1: 'bg-emerald-200 dark:bg-emerald-900',
  2: 'bg-emerald-300 dark:bg-emerald-700',
  3: 'bg-emerald-500 dark:bg-emerald-500',
  4: 'bg-emerald-700 dark:bg-emerald-300',
} satisfies Record<HeatmapCell['level'], string>;

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TOKEN_FORMATTER = new Intl.NumberFormat('en-US');

type HeatmapSlot = { kind: 'cell'; cell: HeatmapCell } | { kind: 'empty'; key: string };

export function ActivityHeatmap({
  cells,
  year,
  timezone,
}: {
  cells: HeatmapCell[];
  year: number;
  timezone: string;
}) {
  const weeks = groupByWeek(cells);
  const rows = groupByDayOfWeek(weeks);
  const titleId = `activity-heatmap-${year}-title`;
  const descriptionId = `activity-heatmap-${year}-description`;

  return (
    <figure className="mt-8 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={titleId} className="text-sm uppercase tracking-wide text-neutral-500">
          {year} activity
        </h2>
        <span className="text-xs text-neutral-500">{timezone}</span>
        <p id={descriptionId} className="sr-only">
          Daily token totals grouped by week, with rows ordered Sunday through Saturday.
        </p>
      </figcaption>
      <div className="mt-4 overflow-x-auto">
        <table
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="border-separate border-spacing-1"
        >
          <tbody>
            {rows.map((row) => (
              <tr key={row.day}>
                {row.slots.map((slot) =>
                  slot.kind === 'cell' ? (
                    <HeatmapDayCell key={slot.cell.date} cell={slot.cell} />
                  ) : (
                    <td key={slot.key} className="p-0" aria-hidden="true">
                      <span className="block size-3" />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function HeatmapDayCell({ cell }: { cell: HeatmapCell }) {
  const label = `${cell.date}: ${TOKEN_FORMATTER.format(cell.tokens)} tokens`;

  return (
    <td aria-label={label} title={label} className="p-0">
      <span className={`block size-3 rounded-sm ${LEVEL_CLASS[cell.level]}`} aria-hidden="true" />
    </td>
  );
}

function groupByDayOfWeek(weeks: HeatmapSlot[][]) {
  return DAY_LABELS.map((day, dayIndex) => ({
    day,
    slots: weeks.map((week) => week[dayIndex]).filter((slot): slot is HeatmapSlot => Boolean(slot)),
  }));
}

function groupByWeek(cells: HeatmapCell[]): HeatmapSlot[][] {
  const weeks: HeatmapSlot[][] = [];
  let current: HeatmapSlot[] = [];
  let lastDate: string | null = null;
  for (const cell of cells) {
    const date = new Date(`${cell.date}T00:00:00.000Z`);
    if (weeks.length === 0 && current.length === 0) {
      for (let i = date.getUTCDay(); i > 0; i--) {
        const emptyDate = addUtcDays(cell.date, -i);
        current.push({ kind: 'empty', key: `empty-${emptyDate}` });
      }
    }
    current.push({ kind: 'cell', cell });
    lastDate = cell.date;
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    let offset = 1;
    while (current.length < 7 && lastDate) {
      const emptyDate = addUtcDays(lastDate, offset);
      current.push({ kind: 'empty', key: `empty-${emptyDate}` });
      offset++;
    }
    weeks.push(current);
  }
  return weeks;
}

function addUtcDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
