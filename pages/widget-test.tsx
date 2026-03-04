import { Fragment } from 'react';
import { NextPage } from 'next';
import { VStack, Text, useColorModeValue, Divider } from '@chakra-ui/react';
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
import { useLinkColor } from 'components/theme';
import SwitchboardOnboardingWidget from 'components/Switchboard/SwitchboardOnboardingWidget';

const title = 'Projects 📚';
const subtitle =
  "A selection of projects I've worked on, during my career as a software developer.";

const TURQUOISE = '#06b6d4';

const Projects: NextPage<ProjectProps> = (props) => {
  const { projects } = props;
  const linkcolor = useLinkColor();

  return (
    <Fragment>
      <PageLayout title={title} description={subtitle}>
        <PageSlideFade>
          <VStack align="start">
            <Header underlineColor={TURQUOISE} mt={0} mb={2} color={linkcolor}>
              Projects
            </Header>

            <Text color={useColorModeValue('gray.500', 'gray.200')} textAlign="left">
              {subtitle}
            </Text>
          </VStack>

          <Divider my={8} />

          <SwitchboardOnboardingWidget />
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