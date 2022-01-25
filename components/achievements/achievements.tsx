import * as React from 'react'
import {
  FiPackage,
  FiHome,
  FiEdit2,
  FiUsers,
  FiBarChart2,
} from 'react-icons/fi'
import { FaTools } from 'react-icons/fa'
import { VStack, Heading, Box, Link, LinkProps } from '@chakra-ui/react'
import { TimelineItem } from './Timeline'
import { PageSlideFade } from 'components/shared/animations/page-transitions'
import Header from 'components/shared/header'
import NextLink from 'next/link'
import { useLinkColor } from 'components/theme'

interface ExternalLinkProps extends LinkProps {
  url: string
  linkProps?: LinkProps
  text: string
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
  )
}

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
  )
}
const Achievements = () => {
  const linkColor = useLinkColor()

  return (
    <PageSlideFade>
      <Box align="start" mb={6}>
        <Header mt={0} mb={0}>
          Achievements
        </Header>
      </Box>
      <VStack textAlign="start" align="start" mb={5}>
        <Box zIndex={5}>
          <Heading fontSize="2xl" fontWeight="600" my={5}>
            2021
          </Heading>
          <Box>
            <TimelineItem icon={FaTools}>
              Learnt{' '}
              <ExternalLink
                color={linkColor}
                url="https://www.typescriptlang.org"
                text={'Typescript'}
                target="_blank"
              />{' '}
              and{' '}
              <ExternalLink
                color={linkColor}
                url="https://nextjs.org"
                text={'Next.js'}
                target="_blank"
              />
            </TimelineItem>
            <TimelineItem icon={FiUsers}>Became a dad ❤️</TimelineItem>
            <TimelineItem icon={FiPackage}>
              Published 3 posts on my portfolio website{' '}
              <InternalLink color={linkColor} url="/blog" text={'Blog'} />
            </TimelineItem>
            <TimelineItem icon={FiPackage}>
              Published or contributed to{' '}
              <InternalLink
                color={linkColor}
                url="/open-source"
                text={'20+ open-source repositories'}
              />
            </TimelineItem>
            <TimelineItem icon={FiBarChart2}>
              Collected 34k+ posts views and 1.5k+ total reactions on{' '}
              <ExternalLink
                color={linkColor}
                url="https://dev.to/m_ahmad"
                text={'Dev.to'}
                target="_blank"
              />
            </TimelineItem>
            <TimelineItem icon={FiHome} skipTrail>
              Rebuilt my portfolio website with React, ChakraUI and
              Framer-motion,{' '}
              <ExternalLink
                color={linkColor}
                url="https://github.com/MA-Ahmad/myPortfolio"
                text={'source on Github'}
                target="_blank"
              />
              .
            </TimelineItem>
          </Box>
        </Box>
        <Box zIndex={5}>
          <Heading fontSize="2xl" fontWeight="600" my={5}>
            2020
          </Heading>
          <Box>
            <TimelineItem icon={FiEdit2}>Wrote 5 blog posts</TimelineItem>
            <TimelineItem icon={FiPackage}>
              Published or contributed to{' '}
              <ExternalLink
                color={linkColor}
                url="https://github.com/MA-Ahmad?tab=repositories"
                text={'32 open-source repositories'}
                target="_blank"
              />
            </TimelineItem>
            <TimelineItem icon={FiBarChart2}>
              Collected 650+ post views and 15+ total reactions on{' '}
              <ExternalLink
                color={linkColor}
                url="https://dev.to/m_ahmad"
                text={'Dev.to'}
                target="_blank"
              />
            </TimelineItem>
            <TimelineItem icon={FiHome} skipTrail>
              Built my portfolio website with React and ChakraUI,{' '}
              <ExternalLink
                color={linkColor}
                url="https://github.com/MA-Ahmad/portfolio2"
                text={'source on Github'}
                target="_blank"
              />
              .
            </TimelineItem>
          </Box>
        </Box>
      </VStack>
    </PageSlideFade>
  )
}

export default Achievements
