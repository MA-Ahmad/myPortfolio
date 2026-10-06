import { Fragment } from 'react';
import { NextPage } from 'next';
import { projectsList } from '../data/projectData';
import PageLayout from 'components/layouts/pageLayout';
import { PageSlideFade } from 'components/shared/animations/page-transitions';
import Header from 'components/shared/header';
import {
  LeftProjectLayoutLarge,
  ProjectLayoutMed,
  RightProjectLayoutLarge
} from 'components/layouts/projectLayout';
import { ProjectProps } from 'interfaces/interface';

const title = 'Projects 📚';
const subtitle =
  "A selection of projects I've worked on, during my career as a software developer.";

const TURQUOISE = '#06b6d4';

const Projects: NextPage<ProjectProps> = (props) => {
  const { projects } = props;

  return (
    <Fragment>
      <PageLayout title={title} description={subtitle}>
        <PageSlideFade>
          <div className="flex flex-col items-start">
            <Header underlineColor={TURQUOISE} className="mb-2 mt-0">
              Projects
            </Header>
            <p className="text-left text-gray-500 dark:text-gray-200">{subtitle}</p>
          </div>
          <div className="mt-7 flex flex-col gap-8 lg:mt-8">
            {projects.map((project, index) => (
              <Fragment key={index}>
                <ProjectLayoutMed project={project} />
                {index % 2 === 0 ? (
                  <LeftProjectLayoutLarge project={project} />
                ) : (
                  <RightProjectLayoutLarge project={project} />
                )}
              </Fragment>
            ))}
          </div>
        </PageSlideFade>
      </PageLayout>
    </Fragment>
  );
};

export function getStaticProps() {
  return {
    props: {
      projects: projectsList
    }
  };
}

export default Projects;
