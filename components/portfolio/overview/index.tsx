import { PROFILE } from 'data/profile';
import { Panel, PanelContent } from '../panel';
import { EmailItem } from './email-item';
import { JobItem } from './job-item';

export function Overview() {
  return (
    <Panel className="screen-line-bottom-none screen-line-top-none">
      <h2 className="sr-only">Overview</h2>
      <PanelContent className="grid gap-y-2.5">
        {PROFILE.jobs.map((job, index) => (
          <JobItem
            key={index}
            title={job.title}
            company={job.company}
            experienceId={job.experienceId}
          />
        ))}

        <EmailItem email={PROFILE.email} />
      </PanelContent>
    </Panel>
  );
}
