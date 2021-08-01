import * as React from "react";
import {
  FiPackage,
  FiHome,
  FiEdit2,
  FiUsers,
  FiBarChart2
} from "react-icons/fi";
import { VStack, Heading, Box, Link, LinkProps } from "@chakra-ui/react";
import { TimelineItem } from "./Timeline";
import { PageSlideFade } from "components/ui/page-transitions";
import Header from "components/layout/header";
import NextLink from "next/link";

interface ExternalLinkProps extends LinkProps {
  url: string;
  linkProps?: LinkProps;
  text: string;
}

const ExternalLink: React.FC<ExternalLinkProps> = ({
  url,
  linkProps,
  text,
  ...props
}) => {
  return (
    <NextLink href={url} passHref>
      <Link {...linkProps} {...props}>
        {text}
      </Link>
    </NextLink>
  );
};

const InternalLink: React.FC<ExternalLinkProps> = ({
  url,
  linkProps,
  text,
  ...props
}) => {
  return (
    <NextLink href={url} passHref>
      <Link {...linkProps} {...props}>
        {text}
      </Link>
    </NextLink>
  );
};
const Achievements = () => {
  return (
    <PageSlideFade>
      <Box align="start" mb={6}>
        <Header mt={0} mb={0}>
          Achievements
        </Header>
      </Box>
      <VStack textAlign="start" align="start" mb={5}>
        <Box>
          <Heading fontSize="2xl" fontWeight="600" my={5}>
            2021
          </Heading>
          <Box>
            <TimelineItem icon={FiUsers}>Became a dad ❤️</TimelineItem>
            <TimelineItem icon={FiPackage}>
              Published my first post on this website{" "}
              <InternalLink color={"blue.200"} url="/blog" text={"Blog"} />
            </TimelineItem>
            <TimelineItem icon={FiPackage}>
              Published or contributed to{" "}
              <InternalLink
                color={"blue.200"}
                url="/open-source"
                text={"9 open-source repositories"}
              />
            </TimelineItem>
            <TimelineItem icon={FiBarChart2}>
              Collected 6k+ post views and 350+ total reactions on{" "}
              <ExternalLink
                color={"blue.200"}
                url="https://dev.to/m_ahmad"
                text={"Dev.to"}
                target="_blank"
              />
            </TimelineItem>
            <TimelineItem icon={FiHome} skipTrail>
              Rebuilt my portfolio website with React, ChakraUI and
              Framer-motion,{" "}
              <ExternalLink
                color={"blue.200"}
                url="https://github.com/MA-Ahmad/portfolio"
                text={"source on Github"}
                target="_blank"
              />
              .
            </TimelineItem>
          </Box>
        </Box>
        <Box>
          <Heading fontSize="2xl" fontWeight="600" my={5}>
            2020
          </Heading>
          <Box>
            <TimelineItem icon={FiEdit2}>Wrote 5 blog posts</TimelineItem>
            <TimelineItem icon={FiPackage}>
              Published or contributed to{" "}
              <ExternalLink
                color={"blue.200"}
                url="https://github.com/MA-Ahmad?tab=repositories"
                text={"32 open-source repositories"}
                target="_blank"
              />
            </TimelineItem>
            <TimelineItem icon={FiBarChart2}>
              Collected 650+ post views and 15+ total reactions on{" "}
              <ExternalLink
                color={"blue.200"}
                url="https://dev.to/m_ahmad"
                text={"Dev.to"}
                target="_blank"
              />
            </TimelineItem>
            <TimelineItem icon={FiHome} skipTrail>
              Built my portfolio website with React and ChakraUI,{" "}
              <ExternalLink
                color={"blue.200"}
                url="https://github.com/MA-Ahmad/portfolio2"
                text={"source on Github"}
                target="_blank"
              />
              .
            </TimelineItem>
          </Box>
        </Box>
      </VStack>
    </PageSlideFade>
  );
};

export default Achievements;
