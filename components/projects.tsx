import Image from "next/image";
import { projects } from "@/content/site";
import { Panel, PanelHeader, PanelTitle } from "./panel";
import { IconTile } from "./icon-tile";
import { Tag } from "./tag";
import { ExternalLinkIcon, BoxIcon } from "./icons";

export function Projects() {
  return (
    <Panel id="projects">
      <PanelHeader>
        <PanelTitle count={projects.length}>
          <a href="#projects" className="link">
            Projects
          </a>
        </PanelTitle>
      </PanelHeader>

      <div>
        {projects.map((project, index) => (
          <div
            key={project.title}
            className="group/project flex items-center hover:bg-accent-muted"
          >
            {project.image ? (
              <div className="mx-4 flex size-6 shrink-0 overflow-hidden rounded select-none">
                <Image
                  src={project.image}
                  alt={project.title}
                  width={24}
                  height={24}
                  className="size-full object-cover grayscale group-hover/project:grayscale-0 transition-[filter] duration-300"
                  unoptimized
                  aria-hidden
                />
              </div>
            ) : (
              <IconTile className="mx-4">
                <BoxIcon />
              </IconTile>
            )}

            <div className="flex-1 border-l border-dashed border-line">
              <a
                href={project.site}
                target="_blank"
                rel="noopener"
                className="flex w-full items-center gap-2 p-4 pr-2 text-left"
              >
                <div className="flex-1">
                  <h3 className="mb-1 leading-snug font-medium text-balance">
                    {project.title}
                  </h3>

                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {project.description}
                  </p>
                </div>

                <div className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLinkIcon />
                </div>
              </a>

              {(project.techStack.length > 0 || index === 0) && (
                <div className="border-t border-line p-4 pt-3">
                  <ul className="flex flex-wrap gap-1.5">
                    {project.techStack.map((skill) => (
                      <li key={skill} className="flex">
                        <Tag>{skill}</Tag>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
