import React from 'react'
import { motion } from 'framer-motion'
import { stagger, fadeInUp } from '../shared/animations/framerAnimations'
import {
  useColorModeValue,
  IconButton,
  Flex,
  Box,
  ListItem,
  AspectRatio,
  Image,
  Skeleton,
} from '@chakra-ui/react'
import { HiOutlineExternalLink } from 'react-icons/hi'
import {
  MotionBox,
  MotionFlex,
  MotionList,
  MotionText,
} from 'components/shared/animations/motion'

const ProjectLayoutMed = ({ project }) => {
  return (
    <Flex
      display={['flex', 'flex', 'none']}
      rounded="xl"
      borderWidth="1px"
      borderColor={useColorModeValue('gray.600', 'gray.700')}
      w="full"
      h="20rem"
      textAlign="left"
      align="start"
      shadow="md"
      _hover={{ border: 'md', shadow: 'lg' }}
      overflow="hidden"
      position="relative"
    >
      <a href={project.site} target="_blank" rel="noopener noreferrer">
        <AspectRatio ratio={1.85 / 1} w="100%" h="100%" rounded="xl">
          <Image
            src={project.imageLight}
            fallback={<Skeleton />}
            size="lg"
            width={'full'}
            height={'full'}
            position="absolute"
            rounded="xl"
            objectFit="cover"
            opacity={0.5}
            _hover={{ opacity: 1 }}
          />
        </AspectRatio>
        <Box
          width={'full'}
          height={'full'}
          position="absolute"
          bg={useColorModeValue('gray.100', 'gray.900')}
          opacity={useColorModeValue('0.5', '1')}
        ></Box>
      </a>
      <MotionBox
        initial="initial"
        animate="animate"
        width={['full', '70%']}
        rounded="lg"
        my="auto"
        px="6"
        py="3"
        position="relative"
        zIndex="10"
      >
        <MotionBox variants={stagger}>
          <a href={project.site} target="_blank" rel="noopener noreferrer">
            <MotionText
              variants={fadeInUp}
              fontSize="2xl"
              fontWeight="bold"
              color={useColorModeValue('gray.900', 'gray.100')}
            >
              {project.title}
            </MotionText>
            <Box width="full">
              <MotionText
                variants={fadeInUp}
                bg={useColorModeValue('gray.200', 'gray.700')}
                rounded="lg"
                align="left"
                p="4"
                fontSize="sm"
              >
                {project.description}
              </MotionText>
              {project.techStack && (
                <MotionList
                  variants={fadeInUp}
                  display="flex"
                  fontSize="xs"
                  justifyContent="start"
                  mt="3"
                  color={useColorModeValue('gray.900', 'gray.100')}
                  fontWeight="bold"
                >
                  {project.techStack.map((s, index) => (
                    <ListItem key={index} mr="2">
                      <i>{s}</i>
                    </ListItem>
                  ))}
                </MotionList>
              )}
            </Box>
          </a>
          <MotionFlex variants={fadeInUp} pt={2} mt={1} justifyContent="start">
            {/* {project.gitHub && (
              <a
                className="mr-5"
                href={project.gitHub}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github />
              </a>
            )} */}
            <a href={project.site} target="_blank" rel="noopener noreferrer">
              <IconButton
                colorScheme="gray"
                rounded="full"
                size="md"
                aria-label="medal"
                icon={<HiOutlineExternalLink />}
              />
            </a>
          </MotionFlex>
        </MotionBox>
      </MotionBox>
    </Flex>
  )
}

const LeftProjectLayoutLarge = ({ project }) => {
  return (
    <Flex width="full" display={['none', 'none', 'flex']}>
      <MotionBox
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ x: 500, opacity: 0 }}
        animate={{
          x: 0,
          opacity: 1,
          transition: {
            duration: 0.5,
            ease: 'easeInOut',
          },
        }}
        rounded="xl"
        borderWidth="1px"
        borderColor={useColorModeValue('gray.600', 'gray.700')}
        w="80%"
        h="24rem"
        textAlign="left"
        align="start"
        spacing={4}
        shadow="md"
        _hover={{ border: 'md', shadow: 'lg' }}
        overflow="hidden"
        position="relative"
      >
        <a href={project.site} target="_blank" rel="noopener noreferrer">
          <AspectRatio ratio={1.85 / 1} w="100%" h="100%" rounded="xl">
            <Image
              src={project.imageLight}
              fallback={<Skeleton />}
              size="lg"
              width={'full'}
              height={'full'}
              position="absolute"
              rounded="xl"
              objectFit="cover"
              opacity={0.5}
              _hover={{ opacity: 1 }}
            />
          </AspectRatio>
        </a>
      </MotionBox>
      <MotionBox
        initial="initial"
        animate="animate"
        width="40%"
        rounded="lg"
        my="auto"
        zIndex="10"
        ml="-6rem"
        align="right"
      >
        <motion.div variants={stagger}>
          <a
            href={project.site}
            target="_blank"
            rel="noopener noreferrer"
            className="text-right"
          >
            <MotionText
              variants={fadeInUp}
              fontSize="3xl"
              fontWeight="bold"
              color={useColorModeValue('gray.900', 'gray.100')}
            >
              {project.title}
            </MotionText>
          </a>
          <Box width="full">
            <MotionText
              variants={fadeInUp}
              bg={useColorModeValue('gray.200', 'gray.700')}
              rounded="lg"
              align="right"
              p="4"
              fontSize="md"
            >
              {project.description}
            </MotionText>
            {project.techStack && (
              <MotionList
                variants={fadeInUp}
                display="flex"
                fontSize="sm"
                justifyContent="end"
                mt="3"
                color={useColorModeValue('gray.900', 'gray.100')}
                fontWeight="bold"
              >
                {project.techStack.map((s, index) => (
                  <ListItem key={index} mr="3">
                    <i>{s}</i>
                  </ListItem>
                ))}
              </MotionList>
            )}
          </Box>

          <MotionFlex variants={fadeInUp} pt={2} mt={1} justifyContent="end">
            {/* {project.gitHub && (
              <a
                className="mr-5"
                href={project.gitHub}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github />
              </a>
            )} */}
            <a href={project.site} target="_blank" rel="noopener noreferrer">
              <IconButton
                colorScheme="gray"
                rounded="full"
                size="md"
                aria-label="medal"
                icon={<HiOutlineExternalLink />}
              />
            </a>
          </MotionFlex>
        </motion.div>
      </MotionBox>
    </Flex>
  )
}

const RightProjectLayoutLarge = ({ project }) => {
  return (
    <Flex width="full" display={['none', 'none', 'flex']}>
      <MotionBox
        initial="initial"
        animate="animate"
        width="40%"
        rounded="lg"
        my="auto"
        zIndex="10"
        mr="-6rem"
        align="left"
      >
        <motion.div variants={stagger}>
          <a href={project.site} target="_blank" rel="noopener noreferrer">
            <MotionText
              variants={fadeInUp}
              fontSize="3xl"
              fontWeight="bold"
              color={useColorModeValue('gray.900', 'gray.100')}
            >
              {project.title}
            </MotionText>
          </a>
          <Box width="full">
            <MotionText
              variants={fadeInUp}
              bg={useColorModeValue('gray.200', 'gray.700')}
              rounded="lg"
              align="left"
              p="4"
              fontSize="md"
            >
              {project.description}
            </MotionText>
            {project.techStack && (
              <MotionList
                variants={fadeInUp}
                display="flex"
                fontSize="sm"
                justifyContent="start"
                mt="3"
                color={useColorModeValue('gray.900', 'gray.100')}
                fontWeight="bold"
              >
                {project.techStack.map((s, index) => (
                  <ListItem key={index} mr="3">
                    <i>{s}</i>
                  </ListItem>
                ))}
              </MotionList>
            )}
          </Box>

          <MotionFlex variants={fadeInUp} pt={2} mt={1} justifyContent="start">
            {/* {project.gitHub && (
              <a
                className="mr-5"
                href={project.gitHub}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github />
              </a>
            )} */}
            <a href={project.site} target="_blank" rel="noopener noreferrer">
              <IconButton
                colorScheme="gray"
                rounded="full"
                size="md"
                aria-label="medal"
                icon={<HiOutlineExternalLink />}
              />
            </a>
          </MotionFlex>
        </motion.div>
      </MotionBox>
      <MotionBox
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ x: 500, opacity: 0 }}
        animate={{
          x: 0,
          opacity: 1,
          transition: {
            duration: 0.5,
            ease: 'easeInOut',
          },
        }}
        rounded="xl"
        borderWidth="1px"
        borderColor={useColorModeValue('gray.600', 'gray.700')}
        w="80%"
        h="24rem"
        textAlign="left"
        align="start"
        spacing={4}
        shadow="md"
        _hover={{ border: 'md', shadow: 'lg' }}
        overflow="hidden"
        position="relative"
      >
        <a href={project.site} target="_blank" rel="noopener noreferrer">
          <AspectRatio ratio={1.85 / 1} w="100%" h="100%" rounded="xl">
            <Image
              src={project.imageLight}
              fallback={<Skeleton />}
              size="lg"
              width={'full'}
              height={'full'}
              position="absolute"
              rounded="xl"
              objectFit="cover"
              opacity={0.5}
              _hover={{ opacity: 1 }}
            />
          </AspectRatio>
        </a>
      </MotionBox>
    </Flex>
  )
}

export { LeftProjectLayoutLarge, RightProjectLayoutLarge, ProjectLayoutMed }
