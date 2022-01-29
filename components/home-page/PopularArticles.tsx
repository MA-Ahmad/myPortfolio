import React from 'react'
import { BlogPostProps } from 'interfaces/interface'
import {
  VStack,
  HStack,
  Heading,
  Text,
  Link,
  Tooltip,
  useColorModeValue,
  Flex,
  SimpleGrid,
  Box,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import moment from 'moment'
import { useLinkColor } from 'components/theme'
import Header from '../shared/header'
import { CardTransition } from 'components/shared/animations/page-transitions'
import { MotionBox } from 'components/shared/animations/motion'
import { getDbPosts } from 'lib/fetchPosts'
import { CommentIcon, HeartIcon } from 'components/shared/icons'
import DisplayText from 'components/shared/icons/DisplayText'

const ORANGE = '#ff9400'

const PopularArticles: React.FC<BlogPostProps> = (props) => {
  const { posts } = props
  const { dbPosts, isLoading } = getDbPosts()
  const linkColor = useLinkColor()
  const textColor = useColorModeValue('gray.500', 'gray.200')

  const compare = (
    a: { public_reactions_count: number },
    b: { public_reactions_count: number }
  ) => {
    const countA = a.public_reactions_count
    const countB = b.public_reactions_count

    let comparison = 0
    if (countA < countB) {
      comparison = 1
    } else if (countA > countB) {
      comparison = -1
    }
    return comparison
  }

  const getPostLikes = (slug) => {
    const p = dbPosts?.filter((p) => p.slug === slug)[0]
    return p?.likes || 0
  }

  return (
    <VStack align="start" spacing={8} width="100%">
      <Header underlineColor={ORANGE} mt={0} mb={0}>
        Popular Articles
      </Header>
      <SimpleGrid columns={1} spacing={4} mt={5} w="100%">
        {posts &&
          posts
            ?.sort(compare)
            .slice(0, 3)
            .map(
              (
                {
                  description,
                  title,
                  slug,
                  positive_reactions_count,
                  comments_count,
                  published_at,
                },
                i
              ) => (
                <MotionBox whileHover={{ y: -5 }} key={i}>
                  <CardTransition>
                    <VStack
                      spacing={1}
                      p={4}
                      _hover={{ shadow: 'md', textDecoration: 'none' }}
                      borderWidth="1px"
                      position="relative"
                      rounded="md"
                      bg={useColorModeValue('white', 'gray.800')}
                      align="left"
                    >
                      <HStack justifyContent="space-between" isInline>
                        <Heading fontSize="lg" align="left" mt={0}>
                          <NextLink href={`/blog/${slug}`} passHref>
                            <Text as={Link} color={linkColor}>
                              {title}
                            </Text>
                          </NextLink>
                        </Heading>
                        <HStack
                          spacing={2}
                          isInline
                          d={['none', 'flex', 'flex']}
                        >
                          {positive_reactions_count ? (
                            <Flex alignItems="center">
                              <DisplayText
                                isLoading={isLoading}
                                value={
                                  Number(positive_reactions_count) +
                                  getPostLikes(slug)
                                }
                              />
                              &nbsp;
                              <HeartIcon />
                            </Flex>
                          ) : (
                            ''
                          )}
                          {comments_count ? (
                            <Flex alignItems="center">
                              <DisplayText
                                isLoading={false}
                                value={comments_count}
                              />
                              &nbsp;
                              <CommentIcon />
                            </Flex>
                          ) : (
                            ''
                          )}
                        </HStack>
                      </HStack>
                      <HStack spacing={2} isInline>
                        <Tooltip hasArrow label="Published" placement="top">
                          <Text
                            fontSize="sm"
                            fontWeight="600"
                            color={textColor}
                          >
                            {moment(published_at).format('Do MMMM YYYY')}
                          </Text>
                        </Tooltip>
                        {positive_reactions_count ? (
                          <Tooltip hasArrow label="Reactions" placement="top">
                            <Flex
                              alignItems="center"
                              d={['flex', 'none', 'none']}
                            >
                              <DisplayText
                                isLoading={isLoading}
                                value={
                                  Number(positive_reactions_count) +
                                  getPostLikes(slug)
                                }
                              />
                              &nbsp;
                              <HeartIcon />
                            </Flex>
                          </Tooltip>
                        ) : (
                          ''
                        )}
                        {comments_count ? (
                          <Tooltip hasArrow label="Comments" placement="top">
                            <Flex
                              alignItems="center"
                              d={['flex', 'none', 'none']}
                            >
                              <DisplayText
                                isLoading={false}
                                value={comments_count}
                              />
                              &nbsp;
                              <CommentIcon />
                            </Flex>
                          </Tooltip>
                        ) : (
                          ''
                        )}
                      </HStack>
                      <Text
                        align="left"
                        fontSize="md"
                        noOfLines={1}
                        color={textColor}
                      >
                        {description}
                      </Text>
                    </VStack>
                  </CardTransition>
                </MotionBox>
              )
            )}
      </SimpleGrid>
      <HStack justifyContent="center" width="100%">
        <NextLink href="/blog" passHref>
          <HStack spacing={2} as={Link} color={linkColor}>
            <Text fontSize="sm">More Articles</Text>
            <Box height="1.2rem" width="1.2rem">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z"
                  clipRule="evenodd"
                />
              </svg>
            </Box>
          </HStack>
        </NextLink>
      </HStack>
    </VStack>
  )
}

export default PopularArticles
