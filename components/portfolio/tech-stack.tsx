import { skillsArray } from 'data/data';
import { Panel, PanelHeader, PanelTitle } from './panel';

const ID = 'stack';

export function TechStack() {
  return (
    <Panel id={ID}>
      <PanelHeader>
        <PanelTitle>
          <a href={`#${ID}`} className="text-foreground no-underline">
            Stack
          </a>
        </PanelTitle>
      </PanelHeader>

      <div className="relative [--badge-height:1.5rem] [--col-left-width:12rem]">
        <div
          className="pointer-events-none absolute inset-y-0 left-[var(--col-left-width)] -z-[1] hidden w-px border-r border-dashed border-line sm:block"
          aria-hidden
        />

        {Object.entries(groupByCategory(skillsArray)).map(
          ([category, items], index) => {
            const categoryId = `${ID}-${category}`;

            return (
              <div
                key={category}
                className="grid items-start gap-y-2 border-b border-line py-4 last:border-none sm:grid-cols-[var(--col-left-width)_1fr]"
              >
                <div id={categoryId} className="pl-4 text-sm leading-[var(--badge-height)]">
                  <span
                    className="mr-1.5 font-mono text-muted-foreground/80 select-none"
                    aria-hidden
                  >
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  {category}
                </div>

                <ul
                  aria-labelledby={categoryId}
                  className="flex flex-wrap gap-1.5 px-4"
                >
                  {items.map((item) => (
                    <li key={item.name} className="flex">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener"
                        className="flex h-[var(--badge-height)] items-center justify-center gap-[0.3125rem] rounded-full bg-zinc-50/80 px-2 font-mono text-xs text-foreground ring-1 ring-inset ring-border dark:bg-zinc-900/80"
                      >
                        <img
                          src={item.image}
                          alt=""
                          className="pointer-events-none size-3.5 shrink-0 object-contain"
                        />
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
        )}
      </div>
    </Panel>
  );
}

function groupByCategory(items: typeof skillsArray) {
  return items.reduce<Record<string, typeof skillsArray>>((acc, item) => {
    (acc[item.type] ??= []).push(item);
    return acc;
  }, {});
}
