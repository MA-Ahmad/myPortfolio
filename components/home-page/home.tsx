import { Activity } from 'lib/github-contributions';
import { ProfileHeader } from 'components/portfolio/profile-header';
import { SocialLinks } from 'components/portfolio/social-links';
import { Overview } from 'components/portfolio/overview';
import { GitHubContributions } from 'components/portfolio/github-contributions';
import { Experiences } from 'components/portfolio/experiences';
import { Education } from 'components/portfolio/education';
import { Projects } from 'components/portfolio/projects';
import { TechStack } from 'components/portfolio/tech-stack';
import { Blocks } from 'components/portfolio/blocks';
import { StripeSeparator } from 'components/portfolio/separator';
import { Spider } from 'components/portfolio/spider';

export default function Home({
  contributions
}: {
  contributions: Activity[];
}) {
  return (
    <div className="relative [--separator-height:2rem]">
      {/* The redraw keeps the rails up for the whole run and puts its rulers in them. */}
      <div className="guide-rails" data-redraw-rails data-redraw-ignore aria-hidden />
      <div className="site-frame mx-auto md:max-w-3xl">
        <ProfileHeader />
        <StripeSeparator />
        <SocialLinks />
        <Overview />
        <GitHubContributions contributions={contributions} />
        <StripeSeparator />
        <Blocks />
        <StripeSeparator />
        <TechStack />
        <StripeSeparator />
        <Experiences />
        <StripeSeparator />
        <Education />
        <StripeSeparator />
        <Projects />
        <StripeSeparator />
      </div>
      <Spider />
    </div>
  );
}
