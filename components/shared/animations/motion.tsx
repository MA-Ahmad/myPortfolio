import { Box, Flex, Image, forwardRef, Text, List } from '@chakra-ui/react'
import { motion, isValidMotionProp } from 'framer-motion'

export const MotionBox = motion(
  forwardRef((props, ref) => {
    const chakraProps = Object.fromEntries(
      // do not pass framer props to DOM element
      Object.entries(props).filter(([key]) => !isValidMotionProp(key))
    )
    return <Box ref={ref} {...chakraProps} />
  })
)

export const MotionFlex = motion(
  forwardRef((props, ref) => {
    const chakraProps = Object.fromEntries(
      // do not pass framer props to DOM element
      Object.entries(props).filter(([key]) => !isValidMotionProp(key))
    )
    return <Flex ref={ref} {...chakraProps} />
  })
)

export const MotionText = motion(
  forwardRef((props, ref) => {
    const chakraProps = Object.fromEntries(
      // do not pass framer props to DOM element
      Object.entries(props).filter(([key]) => !isValidMotionProp(key))
    )
    return <Text ref={ref} {...chakraProps} />
  })
)

export const MotionList = motion(
  forwardRef((props, ref) => {
    const chakraProps = Object.fromEntries(
      // do not pass framer props to DOM element
      Object.entries(props).filter(([key]) => !isValidMotionProp(key))
    )
    return <List ref={ref} {...chakraProps} />
  })
)

export const MotionImage = motion(
  forwardRef((props, ref) => {
    const chakraProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !isValidMotionProp(key))
    )
    return (
      <Image
        ref={ref}
        fallbackSrc={'/assets/images/placeholder.png'}
        {...chakraProps}
      />
    )
  })
)
