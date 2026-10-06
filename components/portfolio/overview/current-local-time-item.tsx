import { useEffect, useState } from 'react';
import { IntroItem, IntroItemContent, IntroItemIcon } from './intro-item';

export function CurrentLocalTimeItem({ timeZone }: { timeZone: string }) {
  const [timeString, setTimeString] = useState('');
  const [diffText, setDiffText] = useState('');
  const [handsPath, setHandsPath] = useState(() => clockHandsPath(12, 0));

  useEffect(() => {
    const updateTime = () => {
      const { time, hour, minute, diff } = computeClock(timeZone);
      setTimeString(time);
      setHandsPath(clockHandsPath(hour, minute));
      setDiffText(diff);
    };

    updateTime();
    const interval = window.setInterval(updateTime, 60000);
    return () => window.clearInterval(interval);
  }, [timeZone]);

  return (
    <IntroItem>
      <IntroItemIcon>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d={handsPath} />
        </svg>
      </IntroItemIcon>
      <IntroItemContent>
        <span suppressHydrationWarning>{timeString}</span>
        <span className="text-muted-foreground" aria-hidden suppressHydrationWarning>
          {diffText}
        </span>
      </IntroItemContent>
    </IntroItem>
  );
}

function clockHandsPath(hour: number, minute: number) {
  const h = hour % 12;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const minuteAngle = (minute / 60) * 2 * Math.PI;
  const hourAngle = ((h + minute / 60) / 12) * 2 * Math.PI;
  const hx = round(12 + 3.6 * Math.sin(hourAngle));
  const hy = round(12 - 3.6 * Math.cos(hourAngle));
  const mx = round(12 + 6 * Math.sin(minuteAngle));
  const my = round(12 - 6 * Math.cos(minuteAngle));
  return `M12 12 L${hx} ${hy} M12 12 L${mx} ${my}`;
}

function computeClock(timeZone: string) {
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(now);
  const hour = parseInt(time, 10);
  const minute = parseInt(time.slice(3), 10);
  const viewerOffset = -now.getTimezoneOffset();
  const targetOffset =
    (new Date(now.toLocaleString('en-US', { timeZone })).getTime() -
      new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) /
    60000;
  const hoursDiff = Math.abs(targetOffset - viewerOffset) / 60;
  const diff =
    hoursDiff < 1
      ? ' // same time'
      : ` // ${Math.floor(hoursDiff)}h ${targetOffset > viewerOffset ? 'ahead' : 'behind'}`;

  return { time, hour, minute, diff };
}
