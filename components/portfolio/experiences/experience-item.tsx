import { ExperienceItemData } from 'data/profile';
import { ExperiencePositionItem } from './experience-position-item';

export function ExperienceItem({ experience }: { experience: ExperienceItemData }) {
  return (
    <div
      id={`experience-${experience.id}`}
      className="group/experience screen-line-bottom scroll-mt-14 space-y-4 py-4"
    >
      <div className="flex items-start gap-3 sm:items-center">
        <div className="flex size-6 shrink-0 items-center justify-center select-none">
          {experience.companyLogo ? (
            <img
              src={experience.companyLogo}
              alt={`${experience.companyName} logo`}
              width={24}
              height={24}
              className="rounded-full object-cover grayscale transition-[filter] duration-300 group-hover/experience:grayscale-0"
            />
          ) : (
            <span className="flex size-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-1">
          <h3 className="text-xl leading-6 font-medium">{experience.companyName}</h3>
          {experience.isCurrentEmployer ? (
            <span className="relative flex size-2.5 items-center justify-center">
              <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-info opacity-50" />
              <span className="relative inline-flex size-1.5 rounded-full bg-info" />
              <span className="sr-only">Current</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative space-y-4 before:absolute before:left-3 before:h-full before:w-px before:bg-border">
        {experience.positions.map((position) => (
          <ExperiencePositionItem key={position.id} position={position} />
        ))}
      </div>
    </div>
  );
}
