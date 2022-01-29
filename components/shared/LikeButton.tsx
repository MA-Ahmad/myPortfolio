import { usePostData } from 'lib/usePostData'
import React from 'react'
import { MotionBox, MotionFlex } from './animations/motion'
import { Icon, useColorModeValue, Progress, Spinner } from '@chakra-ui/react'
import { Box, HStack } from '@chakra-ui/layout'
import { BsHeartFill } from 'react-icons/bs'

const emojis = ['👍', '🙏', '🥰']

export const LikeButton = ({
  id,
  devToLikes,
  linkColor,
  title,
}: {
  id: string
  devToLikes: number
  linkColor: string
  title: string
}) => {
  const { currentUserLikes, totalPostLikes, isLoading, incrementLikes } =
    usePostData(id, title)

  return (
    <HStack alignItems="center" spacing={2} mb={2}>
      <button
        className="focus:outline-none"
        onClick={() => {
          if (isLoading) return
          incrementLikes()
        }}
      >
        <Box position="relative">
          <Box
            position="absolute"
            width="full"
            fontSize="2xl"
            textAlign="center"
          >
            {emojis.map((item, index) => {
              return (
                <MotionBox
                  key={index}
                  position="absolute"
                  width="full"
                  animate={currentUserLikes === index + 1 ? 'show' : 'hide'}
                  variants={{
                    hide: { translateY: -80, opacity: 0 },
                    show: {
                      translateY: [0, -40, -60],
                      opacity: [0, 1, 0],
                    },
                  }}
                  initial="hide"
                >
                  {item}
                </MotionBox>
              )
            })}
          </Box>
          <MotionFlex
            position="relative"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
            width="9"
            height="9"
            rounded="md"
            bg={useColorModeValue('#c9c4c4', '#3c3838')}
            shadow="lg"
            whileHover="hover"
            whileTap="active"
            variants={{
              hover: {
                scale: 1.15,
              },
              active: {
                scale: 1.3,
              },
            }}
          >
            <MotionBox
              position="absolute"
              width="full"
              height="full"
              bgGradient="linear(to-t, yellow.300, red.500)"
              animate={String(currentUserLikes)}
              variants={{
                '0': { translateY: 32 },
                '1': { translateY: 20 },
                '2': { translateY: 10 },
                '3': { translateY: 0 },
              }}
              initial="0"
            />
            <Icon
              as={BsHeartFill}
              w={5}
              h={5}
              position="relative"
              color={'white'}
            />
          </MotionFlex>
        </Box>
      </button>
      <Box fontSize="lg" fontWeight="semibold" color={linkColor}>
        {isLoading ? (
          <Spinner
            size="xs"
            speed="0.65s"
            emptyColor="gray.200"
            color={linkColor}
          />
        ) : (
          <span>{totalPostLikes + (Number(devToLikes) || 0)}</span>
        )}
      </Box>
    </HStack>
  )
}
