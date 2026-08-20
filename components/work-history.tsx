import Image from "next/image";
import { workHistory } from "@/content/site";
import { Panel, PanelHeader, PanelTitle } from "./panel";
import { Tag } from "./tag";

export function WorkHistory() {
  return (
    <Panel id="experience">
      <PanelHeader>
        <PanelTitle>
          <a href="#experience" className="link">
            Experience
          </a>
        </PanelTitle>
      </PanelHeader>

      <div className="pr-2 pl-4">
        {workHistory.map((job, index) => (
          <div
            key={index}
            className="group/experience screen-line-bottom scroll-mt-14 space-y-4 py-4 last:screen-line-bottom-none"
          >
            <div className="flex items-start gap-3 sm:items-center">
              <div className="flex size-6 shrink-0 items-center justify-center select-none">
                {job.logo ? (
                  <Image
                    src={job.logo}
                    alt={`${job.company} logo`}
                    width={24}
                    height={24}
                    className="rounded-full grayscale transition-[filter] duration-300 ease-[cubic-bezier(0.42,0,0.58,1)] group-hover/experience:grayscale-0"
                    unoptimized
                    aria-hidden
                  />
                ) : (
                  <span className="flex size-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-x-3 gap-y-1 pr-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h3 className="text-xl leading-6 font-medium">{job.company}</h3>

                <dl className="flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground">
                  <dt className="sr-only">Period</dt>
                  <dd className="truncate">{job.period}</dd>
                </dl>
              </div>
            </div>

            <div className="relative space-y-4 pl-9 before:absolute before:left-3 before:h-full before:w-px before:bg-border">
              <div className="relative pl-6">
                <span className="absolute -left-[1.125rem] top-1.5 flex size-2 rounded-full bg-muted-foreground/30" />
                <p className="font-medium">{job.role}</p>
                {job.skills.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {job.skills.map((skill) => (
                      <li key={skill} className="flex">
                        <Tag>{skill}</Tag>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
