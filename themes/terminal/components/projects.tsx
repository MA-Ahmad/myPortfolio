import { useState } from 'react';
import { ChevronDown, ExternalLink, Folder } from 'lucide-react';
import { PROJECTS, ProjectItemData } from 'data/profile';
import { cn } from 'lib/cn';
import { Section } from './section';

const VISIBLE_COUNT = 4;

export function Projects() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? PROJECTS : PROJECTS.slice(0, VISIBLE_COUNT);
  const hiddenCount = PROJECTS.length - VISIBLE_COUNT;

  return (
    <Section id="projects" command="ls ~/projects" headingClassName="mb-5">
      <div className="space-y-1">
        {visible.map((project) => (
          <ProjectRow key={project.id} project={project} />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-term-muted transition-colors duration-150 hover:text-term-accent"
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform duration-200', showAll && 'rotate-180')}
          />
          {showAll ? 'show less' : `${hiddenCount} more projects`}
        </button>
      )}
    </Section>
  );
}

function ProjectRow({ project }: { project: ProjectItemData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 last:mb-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 py-1.5 text-left"
      >
        <ChevronDown
          className={cn(
            'size-4 text-term-muted transition-transform duration-200',
            !open && '-rotate-90'
          )}
        />
        <Folder className="size-4 shrink-0 text-term-muted transition-colors group-hover:text-term-accent" />
        <span className="truncate text-sm font-medium text-term-fg transition-colors group-hover:text-term-accent">
          {project.title.toLowerCase()}
        </span>
      </button>

      {open && (
        <div className="relative ml-6 mt-2 sm:ml-[34px]">
          {project.description && (
            <p className="mb-2 text-xs leading-relaxed text-term-muted sm:text-sm">
              {project.description.toLowerCase()}
            </p>
          )}
          <p className="mb-1 text-[11px] text-term-dim">
            {project.skills.map((skill) => skill.toLowerCase()).join(' · ')}
          </p>
          {project.link && (
            <div className="relative flex gap-2 sm:gap-3">
              <div
                aria-hidden
                className="relative z-10 mt-[8px] size-[9px] shrink-0 rounded-full border-2 border-term-bg bg-term-accent sm:mt-[10px] sm:size-[11px]"
              />
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group/link flex min-w-0 flex-1 items-center gap-2 py-1 sm:px-1.5 sm:py-1.5"
              >
                <span className="truncate text-xs text-term-fg transition-colors duration-150 group-hover/link:text-term-accent sm:text-sm">
                  {new URL(project.link).hostname.replace(/^www\./, '')}
                </span>
                <ExternalLink className="size-3 shrink-0 text-term-muted opacity-0 transition-opacity duration-150 group-hover/link:opacity-100" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
