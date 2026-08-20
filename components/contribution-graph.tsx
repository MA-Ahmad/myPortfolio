"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { getContributionLevel } from "@/lib/github";
import { ContributionDay } from "@/content/site";

interface ContributionGraphProps {
  contributions: ContributionDay[];
  total: number;
  label: string;
  source: string;
  sourceUrl?: string;
  figureNumber: number;
  isEmpty?: boolean;
}

const BLOCK_SIZE = 12;
const BLOCK_MARGIN = 2;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getWeeksData(contributions: ContributionDay[]): {
  weeks: { date: string; count: number }[][];
  startDate: string;
  endDate: string;
} {
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  oneYearAgo.setDate(oneYearAgo.getDate() + 1);

  const contributionMap = new Map<string, number>();
  contributions.forEach((c) => contributionMap.set(c.date, c.count));

  const weeks: { date: string; count: number }[][] = [];
  let currentWeek: { date: string; count: number }[] = [];

  const startDayOfWeek = oneYearAgo.getDay();
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push({ date: "", count: 0 });
  }

  const current = new Date(oneYearAgo);
  const startDate = current.toISOString().split("T")[0];

  while (current <= today) {
    const dateString = current.toISOString().split("T")[0];
    const count = contributionMap.get(dateString) || 0;
    currentWeek.push({ date: dateString, count });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    current.setDate(current.getDate() + 1);
  }

  const endDate = new Date(today).toISOString().split("T")[0];

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: "", count: 0 });
    }
    weeks.push(currentWeek);
  }

  return { weeks, startDate, endDate };
}

function getMonthLabels(
  weeks: { date: string; count: number }[][]
): { month: string; weekIndex: number }[] {
  const labels: { month: string; weekIndex: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    const firstValidDay = week.find((d) => d.date);
    if (firstValidDay && firstValidDay.date) {
      const date = new Date(firstValidDay.date);
      const month = date.getMonth();
      if (month !== lastMonth) {
        labels.push({ month: MONTHS[month], weekIndex });
        lastMonth = month;
      }
    }
  });

  return labels;
}

export function ContributionGraph({
  contributions,
  total,
  label,
  source,
  sourceUrl,
  figureNumber,
  isEmpty = false,
}: ContributionGraphProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const { weeks, startDate, endDate } = useMemo(
    () => getWeeksData(contributions),
    [contributions]
  );
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks]);

  const calendarWidth = weeks.length * (BLOCK_SIZE + BLOCK_MARGIN);
  const calendarHeight = 7 * (BLOCK_SIZE + BLOCK_MARGIN);

  const handleMouseEnter = (
    e: React.MouseEvent,
    dateString: string,
    count: number
  ) => {
    if (!dateString) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const formattedDate = format(parseISO(dateString), "d MMM yyyy");
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text: `${count} contribution${count !== 1 ? "s" : ""} on ${formattedDate}`,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <figure className="space-y-4">
      <div className="overflow-x-auto px-4 py-4">
        <svg
          className="mx-auto"
          width={calendarWidth + 40}
          height={calendarHeight + 24}
          aria-label={`${label} Contributions Graph`}
        >
          {/* Month labels */}
          <g className="text-xs fill-muted-foreground">
            {monthLabels.map((label, i) => (
              <text
                key={i}
                x={label.weekIndex * (BLOCK_SIZE + BLOCK_MARGIN) + 2}
                y={10}
              >
                {label.month}
              </text>
            ))}
          </g>

          {/* Contribution blocks */}
          <g transform="translate(0, 18)">
            {weeks.map((week, weekIndex) =>
              week.map((day, dayIndex) => {
                if (!day.date) return null;
                const level = getContributionLevel(day.count);
                return (
                  <rect
                    key={`${weekIndex}-${dayIndex}`}
                    className={cn("activity-cell transition-opacity")}
                    data-level={level}
                    x={weekIndex * (BLOCK_SIZE + BLOCK_MARGIN)}
                    y={dayIndex * (BLOCK_SIZE + BLOCK_MARGIN)}
                    width={BLOCK_SIZE}
                    height={BLOCK_SIZE}
                    rx={0}
                    onMouseEnter={(e) =>
                      handleMouseEnter(e, day.date, day.count)
                    }
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })
            )}
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-4 pb-4 text-sm">
        <figcaption className="text-pretty tabular-nums text-muted-foreground">
          <span className="mr-2 tracking-wide text-muted-foreground/80">
            Fig. {figureNumber}.
          </span>
          {isEmpty ? (
            "No data available."
          ) : (
            <>
              {total.toLocaleString("en")} contributions,{" "}
              {format(parseISO(startDate), "dd.MM.yyyy")} –{" "}
              {format(parseISO(endDate), "dd.MM.yyyy")}.
            </>
          )}{" "}
          Source:{" "}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              className="link-underline"
              target="_blank"
              rel="noopener"
            >
              {source}
            </a>
          ) : (
            source
          )}
          .
        </figcaption>

        <div
          className="flex items-center gap-1 text-xs text-muted-foreground"
          aria-hidden
        >
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <svg key={level} width={BLOCK_SIZE} height={BLOCK_SIZE}>
              <rect
                className="activity-cell"
                data-level={level}
                width={BLOCK_SIZE}
                height={BLOCK_SIZE}
                rx={0}
              />
            </svg>
          ))}
          <span>More</span>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            backgroundColor: "var(--background)",
            borderColor: "var(--border)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </figure>
  );
}
