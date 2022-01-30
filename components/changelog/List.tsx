import * as React from 'react'
import {
  Box,
  VStack,
  Heading,
  Flex,
  Text,
  Link,
  HStack,
  ListItem,
  UnorderedList,
  useColorModeValue,
  ListIcon,
  Divider,
  List,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import { CardTransition } from 'components/shared/animations/page-transitions'
import { MotionBox } from 'components/shared/animations/motion'
import moment from 'moment'
import { Tag } from 'components/shared/Tags'
import { AiFillCheckCircle } from 'react-icons/ai'
import { GoIssueReopened } from 'react-icons/go'
import ReactHtmlParser from 'react-html-parser'
import { motion, AnimatePresence } from 'framer-motion'
import { useLinkColor } from 'components/theme'

const PrList = ({ prList }) => {
  const linkColor = useLinkColor()
  const textColor = useColorModeValue('gray.500', 'gray.200')

  return (
    <AnimatePresence>
      <List>
        {prList?.map((pr, index) => (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: (i) => ({
                opacity: 0,
                y: -30 * i,
              }),
              visible: (i) => ({
                opacity: 1,
                y: 0,
                transition: {
                  delay: i * 0.1,
                },
              }),
            }}
            custom={index}
            key={pr.html_url}
          >
            <VStack spacing={4} align="left" mx={[0, 0, 6]} mt={8}>
              <ListItem>
                <MotionBox whileHover={{ x: 10 }} key={index} align="left">
                  <CardTransition>
                    <Heading fontSize="lg" align="left" mt={0} mb={1}>
                      {pr.state === 'closed' && pr.merged_at ? (
                        <ListIcon as={AiFillCheckCircle} color="green.500" />
                      ) : (
                        <ListIcon as={GoIssueReopened} color="gray.500" />
                      )}
                      <NextLink href={pr.html_url} passHref>
                        <Text as={Link} color={linkColor} target="_blank">
                          {pr.title}
                        </Text>
                      </NextLink>
                    </Heading>
                    <HStack spacing={2} isInline ml={[0, 0, 6]}>
                      <Text fontSize="sm" fontWeight="600" color={textColor}>
                        {moment(pr.created_at).format('Do MMMM YYYY')}
                      </Text>
                      <HStack
                        spacing={1}
                        alignItems="center"
                        d={['none', 'none', 'flex']}
                      >
                        <Flex alignItems="center" flexWrap="wrap" m="-2px">
                          {pr.labels.map((label) => (
                            <Tag
                              key={label.name}
                              name={label.name}
                              m="2px"
                              padding="0 3px"
                              size="sm"
                            />
                          ))}
                        </Flex>
                      </HStack>
                    </HStack>
                    <Box ml={6} mt={2}>
                      {pr.body && (
                        <UnorderedList>
                          {ReactHtmlParser(pr.body_html)}
                        </UnorderedList>
                      )}
                    </Box>
                  </CardTransition>
                </MotionBox>
              </ListItem>
              {prList.length - 1 !== index && <Divider />}
            </VStack>
          </motion.div>
        ))}
      </List>
    </AnimatePresence>
  )
}

export default PrList
