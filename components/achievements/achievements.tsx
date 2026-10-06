import * as React from 'react';
import { FiPackage, FiHome, FiEdit2, FiUsers, FiBarChart2 } from 'react-icons/fi';
import { FaTools } from 'react-icons/fa';
import { TimelineItem } from './Timeline';
import { PageSlideFade } from 'components/shared/animations/page-transitions';
import Header from 'components/shared/header';
import NextLink from 'next/link';

interface ExternalLinkProps {
  url: string;
  text: string;
  target?: string;
}

const ExternalLink: React.FC<ExternalLinkProps> = ({ url, text, target }) => {
  return (
    <NextLink
      href={url}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}>

      {text}

    </NextLink>
  );
};

const InternalLink: React.FC<ExternalLinkProps> = ({ url, text }) => {
  return (
    <NextLink href={url}>
      {text}
    </NextLink>
  );
};

const Achievements = () => {
  return (
    <PageSlideFade>
      <div className="mb-6 text-left">
        <Header className="mb-0 mt-0">Achievements</Header>
      </div>
      <div className="mb-5 flex flex-col items-start text-left">
        <div className="z-[5]">
          <h2 className="my-5 text-2xl font-semibold">2021</h2>
          <div>
            <TimelineItem icon={FaTools}>
              Learnt <ExternalLink url="https://www.typescriptlang.org" text={'Typescript'} target="_blank" /> and{' '}
              <ExternalLink url="https://nextjs.org" text={'Next.js'} target="_blank" />
            </TimelineItem>
            <TimelineItem icon={FiUsers}>Became a dad ❤️</TimelineItem>
            <TimelineItem icon={FiPackage}>
              Published 3 posts on my portfolio website <InternalLink url="/blog" text={'Blog'} />
            </TimelineItem>
            <TimelineItem icon={FiPackage}>
              Published or contributed to <InternalLink url="/open-source" text={'20+ open-source repositories'} />
            </TimelineItem>
            <TimelineItem icon={FiBarChart2}>
              Collected 34k+ posts views and 1.5k+ total reactions on{' '}
              <ExternalLink url="https://dev.to/m_ahmad" text={'Dev.to'} target="_blank" />
            </TimelineItem>
            <TimelineItem icon={FiHome} skipTrail>
              Rebuilt my portfolio website with React, ChakraUI and Framer-motion,{' '}
              <ExternalLink
                url="https://github.com/MA-Ahmad/myPortfolio"
                text={'source on Github'}
                target="_blank"
              />
              .
            </TimelineItem>
          </div>
        </div>
        <div className="z-[5]">
          <h2 className="my-5 text-2xl font-semibold">2020</h2>
          <div>
            <TimelineItem icon={FiEdit2}>Wrote 5 blog posts</TimelineItem>
            <TimelineItem icon={FiPackage}>
              Published or contributed to{' '}
              <ExternalLink
                url="https://github.com/MA-Ahmad?tab=repositories"
                text={'32 open-source repositories'}
                target="_blank"
              />
            </TimelineItem>
            <TimelineItem icon={FiBarChart2}>
              Collected 650+ post views and 15+ total reactions on{' '}
              <ExternalLink url="https://dev.to/m_ahmad" text={'Dev.to'} target="_blank" />
            </TimelineItem>
            <TimelineItem icon={FiHome} skipTrail>
              Built my portfolio website with React and ChakraUI,{' '}
              <ExternalLink
                url="https://github.com/MA-Ahmad/portfolio2"
                text={'source on Github'}
                target="_blank"
              />
              .
            </TimelineItem>
          </div>
        </div>
      </div>
    </PageSlideFade>
  );
};

export default Achievements;
