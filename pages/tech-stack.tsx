import * as React from 'react';
import { useState } from 'react';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { GetStaticProps, NextPage } from 'next';
import Section from 'components/skills/section';
import { AiTwotoneThunderbolt, AiOutlineCloudServer } from 'react-icons/ai';
import { BiDesktop } from 'react-icons/bi';
import { GiSpiderWeb } from 'react-icons/gi';
import SkillCard from 'components/skills/skill-card';
import { skillsArray } from 'data/data';
import Header from 'components/shared/header';
import { MotionBox } from 'components/shared/animations/motion';
import { container, PageSlideFade } from 'components/shared/animations/page-transitions';
import PageLayout from '../components/layouts/pageLayout';
import { SkillProps } from 'interfaces/interface';
import { cn } from 'lib/cn';

const tabList = [
  {
    name: 'All',
    filterName: '',
    icon: AiTwotoneThunderbolt
  },
  {
    name: 'Web Development',
    filterName: 'development',
    icon: BiDesktop
  },
  {
    name: 'Web Design',
    filterName: 'design',
    icon: GiSpiderWeb
  },
  {
    name: 'Devops',
    filterName: 'devops',
    icon: AiOutlineCloudServer
  }
];

const TechStack: NextPage<SkillProps> = ({ skills }) => {
  const [skillsList, setSkillsList] = useState([]);

  React.useEffect(() => {
    setSkillsList(skills);
  }, []);

  const filterSkills = (tab) => {
    if (tab.length) setSkillsList(skills.filter((skill) => skill.type === tab));
    else setSkillsList(skills);
  };

  return (
    <PageLayout title="Skills" keywords="rails, ruby, react, javascript, typescript">
      <PageSlideFade>
        <div className="flex flex-col gap-8">
          <Section>
            <div className="flex flex-col items-center">
              <Header className="mb-1 mt-0">Tech Stack</Header>
              <p className="max-w-lg text-center text-xl text-gray-500 dark:text-gray-200">
                A list of my favorite tools and technologies that I use on a regular basis.
              </p>
            </div>
          </Section>
          <Section className="z-[5]">
            <TabGroup>
              <TabList className="flex flex-wrap justify-center">
                {tabList.map((tab, index) => (
                  <Tab
                    key={index}
                    onClick={() => filterSkills(tab.filterName)}
                    className={({ selected }) =>
                      cn(
                        'mr-2 mt-2 rounded-full px-4 py-2 outline-none',
                        selected
                          ? 'bg-[var(--link-color)] text-white'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500'
                      )
                    }
                  >
                    <span className="flex items-center gap-1">
                      <tab.icon />
                      <span>{tab.name}</span>
                    </span>
                  </Tab>
                ))}
              </TabList>
              <TabPanels className="min-h-[45vh]">
                {tabList.map((tab) => (
                  <TabPanel key={tab.name} className="px-0">
                    <MotionBox variants={container} initial="hidden" animate="visible">
                      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {skillsList.map((tool, index) => (
                          <SkillCard
                            key={index}
                            name={tool.name}
                            description={tool.description}
                            image={tool.image}
                            link={tool.link}
                          />
                        ))}
                      </div>
                    </MotionBox>
                  </TabPanel>
                ))}
              </TabPanels>
            </TabGroup>
          </Section>
        </div>
      </PageSlideFade>
    </PageLayout>
  );
};

export const getStaticProps: GetStaticProps<SkillProps> = () => {
  return {
    props: {
      skills: skillsArray
    }
  };
};

export default TechStack;
