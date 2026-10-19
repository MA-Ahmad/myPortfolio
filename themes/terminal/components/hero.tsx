import { FaDev, FaXTwitter } from 'react-icons/fa6';
import { FiGithub, FiLinkedin, FiMail } from 'react-icons/fi';
import { FileText } from 'lucide-react';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';
import { TERMINAL_CONTENT } from '../content';
import styles from '../terminal.module.css';
import { AsciiPortrait } from './ascii-portrait';

const SOCIAL_ICONS = {
  github: FiGithub,
  twitter: FaXTwitter,
  linkedin: FiLinkedin,
  devto: FaDev,
  email: FiMail
};

export function Hero() {
  const { handle, bio, currently, openToWork, stack } = TERMINAL_CONTENT;

  return (
    <section className="relative flex min-h-[100dvh] w-full flex-col justify-center px-4 pb-16 pt-20 sm:px-6 md:block md:min-h-0 md:pt-24">
      {openToWork && <Stamp className="absolute right-8 top-24 text-[9px] md:hidden" />}

      <div className="mx-auto -mt-10 grid w-full max-w-4xl grid-cols-1 items-center gap-10 md:mt-0 md:grid-cols-[auto_1fr] md:gap-14">
        <div className={cn(styles.fadeIn, 'flex flex-col items-center gap-4')}>
          <div className="relative w-[200px] sm:w-[240px] md:w-[280px]">
            <AsciiPortrait src={`${PROFILE.avatar}&s=480`} alt={PROFILE.displayName} />
          </div>
        </div>

        <div className={cn(styles.fadeIn, 'relative min-w-0')} style={{ animationDelay: '0.12s' }}>
          {openToWork && (
            <Stamp className="absolute right-12 top-0 hidden text-[10px] hover:rotate-0 md:block" />
          )}

          <p className="mb-1.5 flex items-center pt-1 text-xs tracking-wide text-term-muted sm:pt-0">
            <span className="mr-2 text-term-accent">~</span>whoami
          </p>
          <h1 className="text-2xl font-bold leading-none tracking-tight text-term-fg md:text-3xl">
            {handle}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-term-muted">{bio}</p>

          <div className="mt-4 flex flex-col gap-1.5">
            <p className="text-sm text-term-muted">
              <span className="mr-2 text-term-accent">▸</span>
              {currently.label}{' '}
              <span className="font-semibold text-term-yellow">{currently.highlight}</span>{' '}
              {currently.suffix}
            </p>
          </div>

          <ul className="mt-5 flex flex-wrap gap-1.5">
            {stack.map((tech) => (
              <li
                key={tech.name}
                className={cn(
                  'rounded-sm border border-term-border px-2 py-0.5 text-[11px] transition-colors duration-150',
                  tech.color
                )}
              >
                {tech.name}
              </li>
            ))}
          </ul>

          <ul className="mt-5 flex items-center gap-1">
            {PROFILE.socials.map((social) => {
              const Icon = SOCIAL_ICONS[social.name];
              const isEmail = social.name === 'email';
              return (
                <li key={social.name}>
                  <a
                    href={social.href}
                    target={isEmail ? undefined : '_blank'}
                    rel={isEmail ? undefined : 'noopener noreferrer'}
                    aria-label={social.title}
                    title={social.title.toLowerCase()}
                    className="block p-2.5 !text-term-muted transition-colors duration-150 hover:!text-term-accent"
                  >
                    <Icon className="size-[18px]" />
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <a
              href={PROFILE.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm border border-term-border px-3 py-1.5 text-xs !text-term-muted transition-colors duration-150 hover:border-term-fg/20 hover:!text-term-fg"
            >
              <FileText className="size-3" /> resume
            </a>
            <a
              href={`mailto:${PROFILE.email}`}
              className="inline-flex items-center gap-1.5 rounded-sm border border-term-aqua/30 px-3 py-1.5 text-xs !text-term-aqua transition-colors duration-150 hover:bg-term-aqua/10"
            >
              say hello
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stamp({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'z-20 -rotate-[16deg] select-none rounded-sm border border-term-accent/50 bg-term-bg px-1 py-0.5 transition-transform duration-300',
        className
      )}
    >
      <div className="whitespace-nowrap border border-term-accent/30 px-1.5 py-px">
        <span className="font-bold uppercase tracking-widest text-term-accent">open to work</span>
      </div>
    </div>
  );
}
