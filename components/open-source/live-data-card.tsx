import * as React from 'react'
import {
  Box,
  useColorModeValue,
  VStack,
  Text,
  HStack,
  Tag,
  Icon,
  Flex,
  Tooltip,
} from '@chakra-ui/react'
import { MotionBox } from '../shared/animations/motion'
import { getTagColor, useLinkColor } from '../theme'
import { BiGitRepoForked, BiStar } from 'react-icons/bi'
import { FiGithub } from 'react-icons/fi'

interface RepositoryCardProps {
  title: string
  description: string
  url: string
  language: string
  stargazers_count: number
  forks_count: number
}
const RepositoryCard = (props: RepositoryCardProps) => {
  const { title, description, language, url, stargazers_count, forks_count } =
    props
  const linkColor = useLinkColor()

  const handleLinkClick = (
    e: React.MouseEvent<HTMLParagraphElement, MouseEvent>,
    link: string
  ) => {
    window.open(link)
    e.stopPropagation()
  }

  return (
    <MotionBox whileHover={{ y: -5 }}>
      <Box
        size="xl"
        py={2}
        px={[2, 4]}
        mt={2}
        rounded="xl"
        borderWidth="1px"
        bg={useColorModeValue('white', 'gray.800')}
        borderColor={useColorModeValue('gray.100', 'gray.700')}
        _hover={{
          shadow: 'lg',
          textDecoration: 'none',
        }}
      >
        <VStack overflow="hidden" align="start" spacing={1}>
          <VStack spacing={1} align="start" w="100%">
            <Flex
              justifyContent={'space-between'}
              width="100%"
              onClick={(e) => handleLinkClick(e, url)}
            >
              <Tooltip hasArrow label="Github link" placement="top">
                <HStack cursor={'pointer'}>
                  <Icon as={FiGithub} boxSize="0.9em" mt={'1px'} />
                  <Text
                    fontSize="sm"
                    noOfLines={1}
                    fontWeight="600"
                    align="left"
                    // color={"blue.500"}
                    color={linkColor}
                  >
                    {title}
                  </Text>
                </HStack>
              </Tooltip>
              <HStack
                cursor={'pointer'}
                onClick={(e) => handleLinkClick(e, url)}
              >
                {forks_count && (
                  <Box _hover={{ color: 'blue.500' }}>
                    <Icon as={BiGitRepoForked} boxSize="0.9em" mt={'1px'} />
                    <Box as="span" ml="1" fontSize="sm">
                      {forks_count}
                    </Box>
                  </Box>
                )}
                <Box _hover={{ color: 'blue.500' }}>
                  <Icon as={BiStar} boxSize="0.9em" mt={'1px'} />
                  <Box as="span" ml="1" fontSize="sm">
                    {stargazers_count}
                  </Box>
                </Box>
              </HStack>
            </Flex>
            {language && (
              <Flex justifyContent={'space-between'} width="100%">
                <Box>
                  <HStack spacing="1">
                    <Tag size="sm" colorScheme={getTagColor(language)}>
                      <Text fontSize={['0.55rem', 'inherit', 'inherit']}>
                        {language}
                      </Text>
                    </Tag>
                  </HStack>
                </Box>
              </Flex>
            )}
          </VStack>
          <Box>
            <Text color="gray.500" fontSize="sm" noOfLines={2} textAlign="left">
              {description}
            </Text>
          </Box>{' '}
        </VStack>
      </Box>
    </MotionBox>
  )
}

export default RepositoryCard
