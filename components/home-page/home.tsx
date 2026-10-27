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

export default function Home({
  contributions
}: {
  contributions: Activity[];
}) {
  return (
    <div className="[--separator-height:2rem]">
      <div className="guide-rails" aria-hidden />
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
    </div>
  );
}
