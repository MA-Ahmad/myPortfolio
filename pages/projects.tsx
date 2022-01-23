import { Fragment } from "react";
import { NextPage } from "next";
import {
  VStack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { projectsList } from "../data/projectData";
import PageLayout from "components/layout/pageLayout";
import { PageSlideFade } from "components/ui/page-transitions";
import Header from "components/layout/header";
import { LeftProjectLayoutLarge, ProjectLayoutMed, RightProjectLayoutLarge } from "components/layout/projectLayout";

const title = "Projects 📚";
const subtitle =
  "A selection of projects I've worked on, during my career as a software developer.";

const TURQUOISE = "#06b6d4";

const Projects: NextPage = () => {

  return (
    <Fragment>
      <PageLayout title={title} description={subtitle}>
        <PageSlideFade>
          <VStack align="start">
            <Header underlineColor={TURQUOISE} mt={0} mb={2}>
              Projects
            </Header>
            <Text
              color={useColorModeValue("gray.500", "gray.200")}
              textAlign="left"
            >
              {subtitle}
            </Text>
          </VStack>
          <VStack spacing={8} mt={["7", "7", "0"]}>
            {projectsList.map((project, index) => (
              <Fragment key={index}>
                <ProjectLayoutMed project={project} />
                {index % 2 === 0 ? (
                  <LeftProjectLayoutLarge project={project} />
                ) : (
                  <RightProjectLayoutLarge project={project} />
                )}
              </Fragment>
            ))}
          </VStack>
        </PageSlideFade>
      </PageLayout>
    </Fragment>
  );
};

export default Projects;
