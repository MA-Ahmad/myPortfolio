import { MapPinIcon } from 'lucide-react';
import { PROFILE } from 'data/profile';
import { Panel, PanelContent } from '../panel';
import { CurrentLocalTimeItem } from './current-local-time-item';
import { EmailItem } from './email-item';
import {
  IntroItem,
  IntroItemContent,
  IntroItemIcon,
  IntroItemLink
} from './intro-item';
import { JobItem } from './job-item';

export function Overview() {
  return (
    <Panel className="screen-line-bottom-none screen-line-top-none relative">
      <h2 className="sr-only">Overview</h2>
      <PanelContent className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
        {PROFILE.jobs.map((job, index) => (
          <JobItem
            key={index}
            title={job.title}
            company={job.company}
            experienceId={job.experienceId}
          />
        ))}

        <IntroItem>
          <IntroItemIcon>
            <MapPinIcon />
          </IntroItemIcon>
          <IntroItemContent>
            <IntroItemLink
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(PROFILE.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Location: ${PROFILE.address}`}
            >
              {PROFILE.address}
            </IntroItemLink>
          </IntroItemContent>
        </IntroItem>

        <CurrentLocalTimeItem timeZone={PROFILE.timeZone} />
        <EmailItem email={PROFILE.email} />
      </PanelContent>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -z-[1] hidden w-px -translate-x-2 border-r border-dashed border-line sm:block" />
    </Panel>
  );
}
