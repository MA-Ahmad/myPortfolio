import { FaDev, FaGithub, FaLinkedin, FaTwitter } from 'react-icons/fa';
import { FiMail } from 'react-icons/fi';
import { PROFILE } from 'data/profile';
import { Tooltip } from 'components/shared/tooltip';
import { Panel, PanelContent } from './panel';
import { HandwrittenArrow, HandwrittenNote } from './handwritten-note';

const ICONS = {
  github: <FaGithub />,
  twitter: <FaTwitter />,
  linkedin: <FaLinkedin />,
  devto: <FaDev />,
  email: <FiMail />
};

export function SocialLinks() {
  return (
    <Panel>
      <h2 className="sr-only">Social links</h2>
      <PanelContent>
        <ul className="flex flex-wrap gap-2">
          {PROFILE.socials.map((item) => (
            <li key={item.name}>
              <Tooltip label={`${item.title} (${item.handle})`}>
                <a
                  href={item.href}
                  target={item.name === 'email' ? undefined : '_blank'}
                  rel={item.name === 'email' ? undefined : 'noopener noreferrer'}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-line text-foreground/80 no-underline hover:bg-muted hover:text-foreground"
                  aria-label={item.title}
                >
                  <span className="text-lg">{ICONS[item.name]}</span>
                </a>
              </Tooltip>
            </li>
          ))}
        </ul>
      </PanelContent>

      {/* <HandwrittenNote className="-top-4 right-full mr-4 hidden w-20 flex-col items-end lg:flex">
        <span className="-rotate-6">follow me</span>
        <HandwrittenArrow className="size-7 translate-x-3 -scale-x-100 -rotate-6" />
      </HandwrittenNote> */}
    </Panel>
  );
}
