import { Activity } from 'lib/github-contributions';
import { Hero } from './components/hero';
import { Contributions } from './components/contributions';
import { Experience } from './components/experience';
import { Projects } from './components/projects';
import { Education } from './components/education';
import { WhyHireMe } from './components/why-hire-me';

export { TerminalLayout } from './components/terminal-layout';

export function TerminalHome({ contributions }: { contributions: Activity[] }) {
  return (
    <>
      <Hero />
      <Contributions contributions={contributions} />
      <Experience />
      <Projects />
      <Education />
      <WhyHireMe />
    </>
  );
}
