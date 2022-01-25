import * as React from 'react'
import { IconButton, Box, Flex } from '@chakra-ui/react'
import { BiLeftArrowAlt, BiRightArrowAlt } from 'react-icons/bi'
import { AnimatePresence } from 'framer-motion'
import { IconType } from 'react-icons/lib/cjs'
import { MotionImage } from '../shared/animations/motion'

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }
  },
}

const swipeConfidenceThreshold = 10000
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity
}

interface BtnProps {
  icon: any
  as: IconType
  isRight: boolean
  right?: string
  left?: string
  handleImageDir: (newDirection: number) => void
}

const Btn = ({ icon, as, left, right, isRight, handleImageDir }: BtnProps) => {
  return (
    <Box
      top={'calc(50% - 20px)'}
      right={right}
      left={left}
      position={'absolute'}
      borderRadius={'30px'}
      width={'40px'}
      height={'40px'}
      display={'flex'}
      justifyContent={'center'}
      alignItems={'center'}
      cursor={'pointer'}
      fontWeight={'bold'}
      fontSize={'18px'}
      zIndex={'2'}
      onClick={() => (isRight ? handleImageDir(1) : handleImageDir(-1))}
    >
      <IconButton
        aria-label="icon button"
        icon={icon}
        cursor="pointer"
        as={as}
        size="md"
        colorScheme="teal"
        borderRadius="full"
        rounded="full"
      />
    </Box>
  )
}

export interface CarouselProps {
  images: string[]
}

const Carousel: React.SFC<CarouselProps> = ({ images }) => {
  const [[page, direction], setPage] = React.useState([0, 0])
  const [imageIndex, setImageIndex] = React.useState<number>(0)

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection])
  }

  // React.useEffect(() => {
  //   setImageIndex(repoId);
  // }, [repoId]);

  const nextImage = (newDirection: number) => {
    paginate(newDirection)
    setImageIndex(imageIndex + 1 < images.length ? imageIndex + 1 : 0)
  }

  const prevImage = (newDirection: number) => {
    paginate(newDirection)
    setImageIndex(0 === imageIndex ? images.length - 1 : imageIndex - 1)
  }

  return (
    <Flex
      width={'100%'}
      height={'100%'}
      position={'relative'}
      justify-content={'center'}
      align-items={'center'}
    >
      <AnimatePresence initial={false} custom={direction}>
        <MotionImage
          position="absolute"
          width="100%"
          height="100%"
          borderRadius="5px"
          key={page}
          src={images[imageIndex]}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x)

            if (swipe < -swipeConfidenceThreshold) {
              paginate(1)
            } else if (swipe > swipeConfidenceThreshold) {
              paginate(-1)
            }
          }}
        />
      </AnimatePresence>
      <Btn
        icon={<BiLeftArrowAlt />}
        as={BiRightArrowAlt}
        right="25px"
        isRight={true}
        handleImageDir={nextImage}
      />
      <Btn
        icon={<BiRightArrowAlt />}
        as={BiLeftArrowAlt}
        left="25px"
        isRight={false}
        handleImageDir={prevImage}
      />
    </Flex>
  )
}

export default Carousel
