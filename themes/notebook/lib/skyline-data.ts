import type { Activity } from 'lib/github-contributions';

export const MAX_VOXELS = 12;

export type SkylineDay = {
  date: string;
  count: number;
  week: number;
  /** 0 = Sunday (back row) .. 6 = Saturday (front row), in UTC. */
  weekday: number;
  /** Stack height in voxels; 0 for a day without activity. */
  height: number;
};

export type SkylineData = {
  days: SkylineDay[];
  weeks: number;
  total: number;
  peak: SkylineDay | null;
  /** Week index of each month's 1st, with its label. */
  months: { week: number; label: string }[];
  /** Contributions per month, oldest first, for the hidden table. */
  monthly: { label: string; count: number }[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86_400_000;

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export function buildSkylineData(activity: Activity[]): SkylineData {
  const sorted = [...activity].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return { days: [], weeks: 0, total: 0, peak: null, months: [], monthly: [] };
  }

  const first = utc(sorted[0].date);
  const offset = first.getUTCDay();
  const max = Math.max(...sorted.map((day) => day.count));

  const days: SkylineDay[] = sorted.map((day) => {
    const index = Math.round((utc(day.date).getTime() - first.getTime()) / DAY_MS) + offset;
    return {
      date: day.date,
      count: day.count,
      week: Math.floor(index / 7),
      weekday: index % 7,
      height: day.count === 0 ? 0 : Math.max(1, Math.round((day.count / max) * MAX_VOXELS))
    };
  });

  const months: SkylineData['months'] = [];
  const monthly: SkylineData['monthly'] = [];
  for (const day of days) {
    const date = utc(day.date);
    const label = `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    if (monthly.at(-1)?.label !== label) monthly.push({ label, count: 0 });
    monthly.at(-1)!.count += day.count;
    if (date.getUTCDate() === 1) months.push({ week: day.week, label: MONTHS[date.getUTCMonth()] });
  }

  const peak = days.reduce<SkylineDay | null>(
    (best, day) => (day.count > (best?.count ?? 0) ? day : best),
    null
  );

  return {
    days,
    weeks: days.at(-1)!.week + 1,
    total: days.reduce((sum, day) => sum + day.count, 0),
    peak,
    months,
    monthly
  };
}

/** Sums days into Sunday-start weeks for the flat bars. */
export function weeklyTotals(data: SkylineData) {
  const weeks = new Array<number>(data.weeks).fill(0);
  for (const day of data.days) weeks[day.week] += day.count;
  return weeks;
}

/** "tue 6 oct", formatted from the ISO date so server and browser agree. */
export function shortDate(date: string) {
  const d = utc(date);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatCount(value: number) {
  return value.toLocaleString('en-US');
}
