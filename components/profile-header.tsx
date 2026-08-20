import Image from "next/image";
import { siteConfig, type Social, type SocialPlatform } from "@/content/site";
import {
  GitHubIcon,
  TwitterIcon,
  LinkedInIcon,
  DevToIcon,
  MailIcon,
  MapPinIcon,
  BriefcaseIcon,
} from "./icons";
import { IconTile } from "./icon-tile";
import { ThemeToggle } from "./theme-toggle";
import { HandwrittenNote, HandwrittenArrow } from "./handwritten-note";

const socialIcons: Record<
  SocialPlatform,
  React.ComponentType<{ className?: string }>
> = {
  github: GitHubIcon,
  twitter: TwitterIcon,
  linkedin: LinkedInIcon,
  devto: DevToIcon,
  email: MailIcon,
};

function SocialButton({ social }: { social: Social }) {
  const Icon = socialIcons[social.platform];
  return (
    <a
      href={social.url}
      target={social.platform === "email" ? undefined : "_blank"}
      rel={social.platform === "email" ? undefined : "noopener noreferrer"}
      aria-label={social.label}
      className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground/80 shadow-sm transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon />
    </a>
  );
}

export function ProfileHeader() {
  return (
    <div className="screen-line-bottom border-x border-line">
      <div className="grid grid-cols-[auto_1fr] grid-rows-[1fr_auto] overflow-y-clip">
        {/* Avatar area */}
        <div className="flex flex-col sm:row-span-2 sm:row-start-1">
          <div className="screen-line-top mt-auto shrink-0 border-r border-line">
            <div className="mx-0.5 my-0.75">
              <Image
                src={siteConfig.avatarUrl}
                alt={siteConfig.name}
                width={80}
                height={80}
                className="rounded-full ring-2 ring-border ring-offset-2 ring-offset-background"
                priority
              />
            </div>
          </div>
        </div>

        {/* Figure area with theme toggle */}
        <figure className="relative col-span-2 flex items-center justify-between p-2 sm:col-span-1 sm:col-start-2 sm:p-4">
          <figcaption className="pointer-events-none text-sm leading-none tracking-wide text-muted-foreground/60 tabular-nums select-none">
            Fig. 1.
          </figcaption>
          <ThemeToggle />
        </figure>

        {/* Name and title area */}
        <div className="flex flex-col">
          <div className="z-10 mt-auto border-t border-line">
            <div className="flex items-center gap-2 pl-4 pt-1">
              <h1 className="-translate-y-px text-[2rem] leading-none font-medium tracking-tight">
                {siteConfig.name}
              </h1>
            </div>

            <div className="h-12 border-t border-line py-1 pl-4 sm:h-9">
              <p className="font-mono text-sm text-muted-foreground">
                {siteConfig.role}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* vCard identity rows */}
      <div className="screen-line-top grid gap-x-4 gap-y-2.5 p-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 font-mono text-sm">
          <IconTile>
            <BriefcaseIcon />
          </IconTile>
          <p className="text-balance">{siteConfig.role}</p>
        </div>

        <div className="flex items-center gap-4 font-mono text-sm">
          <IconTile>
            <MapPinIcon />
          </IconTile>
          <p className="text-balance">{siteConfig.location}</p>
        </div>

        <div className="col-span-full">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {siteConfig.bio}
          </p>
        </div>
      </div>

      {/* Social links */}
      <div className="relative screen-line-top p-4">
        <h2 className="sr-only">Social Links</h2>
        <ul className="flex flex-wrap gap-2">
          {siteConfig.socials.map((social) => (
            <li key={social.platform}>
              <SocialButton social={social} />
            </li>
          ))}
        </ul>

        <HandwrittenNote className="-top-4 right-full mr-4 hidden w-20 flex-col items-end lg:flex">
          <span className="-rotate-6">say hi</span>
          <HandwrittenArrow className="size-7 translate-x-4 -scale-x-100 -rotate-6" />
        </HandwrittenNote>
      </div>
    </div>
  );
}
