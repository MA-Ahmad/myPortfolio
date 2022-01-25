import {
  VStack,
  HStack,
  Heading,
  Text,
  Link,
  Tooltip,
  useColorModeValue,
  Flex,
  Image,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import { CardTransition } from '../shared/animations/page-transitions'
import { BlogPost } from '../../interfaces/interface'
import moment from 'moment'
import { useLinkColor } from 'components/theme'
import { Tags } from 'components/shared/Tags'
import { HeartIcon, CommentIcon } from 'components/shared/icons'
import DisplayText from 'components/shared/icons/DisplayText'

interface IProps {
  post: BlogPost
  isLoading: boolean
  postDbLikes: number
}

const PostCard: React.SFC<IProps> = ({ post, isLoading, postDbLikes }) => {
  const linkColor = useLinkColor()
  const textColor = useColorModeValue('gray.500', 'gray.200')
  const devIcon = useColorModeValue(
    '/assets/images/logos/dev.png',
    '/assets/images/logos/dev_white.png'
  )

  return (
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
        {post.url ? (
          <Tooltip hasArrow label="Dev.to" placement="top">
            <Image
              src={devIcon}
              width="2rem"
              height="2rem"
              position="absolute"
              color="#cbd5e0"
              right="0.5rem"
              top="-14px"
            />
          </Tooltip>
        ) : (
          ''
        )}

        <HStack justifyContent="space-between" isInline>
          <Heading fontSize="lg" align="left" mt={0}>
            <NextLink href={`/blog/${post.slug}`} passHref>
              <Text as={Link} color={linkColor}>
                {post.title}
              </Text>
            </NextLink>
          </Heading>
          <HStack spacing={2} isInline d={['none', 'flex', 'flex']}>
            {post.public_reactions_count || postDbLikes ? (
              <Flex alignItems="center">
                <DisplayText
                  isLoading={isLoading}
                  value={
                    (Number(post.public_reactions_count) || 0) + postDbLikes
                  }
                />
                &nbsp;
                <HeartIcon />
              </Flex>
            ) : (
              ''
            )}
            {post.comments_count ? (
              <Flex alignItems="center">
                <DisplayText isLoading={false} value={post.comments_count} />
                &nbsp;
                <CommentIcon />
              </Flex>
            ) : (
              ''
            )}
          </HStack>
        </HStack>
        <HStack
          spacing={2}
          isInline
          justifyContent={['space-between', 'flex-start']}
        >
          <Tooltip hasArrow label="Published" placement="top">
            <Text fontSize="sm" fontWeight="600" color={textColor}>
              {moment(post.published_at).format('Do MMMM YYYY')}
            </Text>
          </Tooltip>
          <HStack spacing={2}>
            {post.public_reactions_count || postDbLikes ? (
              <Tooltip hasArrow label="Reactions" placement="top">
                <Flex alignItems="center" d={['flex', 'none', 'none']}>
                  <DisplayText
                    isLoading={isLoading}
                    value={
                      (Number(post.public_reactions_count) || 0) + postDbLikes
                    }
                  />
                  &nbsp;
                  <HeartIcon />
                </Flex>
              </Tooltip>
            ) : (
              ''
            )}
            {post.comments_count ? (
              <Tooltip hasArrow label="Comments" placement="top">
                <Flex alignItems="center" d={['flex', 'none', 'none']}>
                  <DisplayText isLoading={false} value={post.comments_count} />
                  &nbsp;
                  <CommentIcon />
                </Flex>
              </Tooltip>
            ) : (
              ''
            )}
          </HStack>
          <HStack spacing={1} alignItems="center" d={['none', 'none', 'flex']}>
            <Tags
              tags={post.tag_list}
              interactive={false}
              tagProps={{
                padding: '0 3px',
                size: 'sm',
              }}
            />
          </HStack>
        </HStack>
        <HStack spacing={1} alignItems="center" d={['flex', 'flex', 'none']}>
          <Tags
            tags={post.tag_list}
            interactive={false}
            tagProps={{
              padding: '0 3px',
              size: 'sm',
            }}
          />
        </HStack>
        <Text align="left" fontSize="md" noOfLines={1} color={textColor}>
          {post.description}
        </Text>
      </VStack>
    </CardTransition>
  )
}

export default PostCard
