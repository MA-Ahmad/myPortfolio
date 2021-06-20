import * as React from "react";
import {
  Box,
  Image,
  useColorModeValue,
  VStack,
  Text,
  AspectRatio,
  HStack,
  Tag,
  Icon,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Center,
  Flex,
  Tooltip
} from "@chakra-ui/react";
import { MotionBox } from "../ui/motion";
import { getTagColor } from "../ui/theme";
import { AiOutlineStar, AiOutlineShareAlt } from "react-icons/ai";
import { FiGithub } from "react-icons/fi";
import { CardTransition } from "../ui/page-transitions";
import LazyImage from "../ui/lazy-image";
interface RepositoryCardProps {
  key: number;
  title: string;
  description: string;
  cover: string;
  blurHash: string;
  technologies: string[];
  url: string;
  live: string;
  stars: string;
  fork: string;
  created?: string;
}
const RepositoryCard = (props: RepositoryCardProps) => {
  const {
    key,
    title,
    description,
    cover,
    blurHash,
    technologies,
    url,
    live,
    stars,
    fork,
  } = props;
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleClick = () => {
    onOpen();
    // window.open(link);
    // if (type == "link" || type == "article") {
    //   window.open(link);
    // } else {
    //   onOpen();
    // }
  };

  const handleLinkClick = (
    e: React.MouseEvent<HTMLParagraphElement, MouseEvent>,
    link: string
  ) => {
    window.open(link);
    e.stopPropagation();
  };

  const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] };

  const thumbnailVariants = {
    initial: { scale: 0.9, opacity: 0 },
    enter: { scale: 1, opacity: 1, transition },
    exit: {
      scale: 0.5,
      opacity: 0,
      transition: { duration: 1.5, ...transition }
    }
  };

  const imageVariants = {
    hover: { scale: 1.1 }
  };

  return (
    <CardTransition>
      <Box onClick={handleClick} cursor="pointer" size="xl">
        <VStack
          //   w="100%"
          rounded="xl"
          borderWidth="1px"
          bg={useColorModeValue("white", "gray.800")}
          borderColor={useColorModeValue("gray.100", "gray.700")}
          _hover={{
            shadow: "lg",
            textDecoration: "none"
          }}
          overflow="hidden"
          align="start"
          spacing={0}
        >
          <Box position="relative" w="100%">
            <MotionBox variants={thumbnailVariants}>
              <MotionBox
                whileHover="hover"
                variants={imageVariants}
                transition={transition}
              >
                <AspectRatio
                  ratio={1.85 / 1}
                  maxW="400px"
                  w="100%"
                  borderBottomWidth="1px"
                  borderColor={useColorModeValue("gray.100", "gray.700")}
                >
                  {/* <Image
                    src={cover}
                    fallback={<Skeleton />}
                    objectFit="cover"
                  /> */}
                  <LazyImage
                    src={cover}
                    blurHash={blurHash}
                  />
                </AspectRatio>
              </MotionBox>
            </MotionBox>
          </Box>

          <VStack py={2} px={[2, 4]} spacing={1} align="start" w="100%">
            <Flex justifyContent={"space-between"} width="100%">
              <Tooltip hasArrow label="Github link" placement="top">
                <HStack>
                  <Icon as={FiGithub} boxSize="0.9em" mt={"1px"} />
                  {/* <Link href={url} isExternal> */}
                  <Text
                    fontSize="sm"
                    noOfLines={1}
                    fontWeight="600"
                    align="left"
                    onClick={e => handleLinkClick(e, url)}
                  >
                    {title}
                  </Text>
                </HStack>
              </Tooltip>
              {/* </Link> */}
              <Flex>
                <Icon as={AiOutlineStar} boxSize="0.9em" mt={"1px"} />
                <Box as="span" ml="1" fontSize="sm">
                  {stars}
                </Box>
              </Flex>
            </Flex>
            <Flex justifyContent={"space-between"} width="100%">
              <Box>
                <HStack spacing="1">
                  {technologies.map((tech, index) => (
                    <Tag key={index} size="sm" colorScheme={getTagColor(tech)}>
                      <Text fontSize={["0.55rem", "inherit", "inherit"]}>
                        {tech}
                      </Text>
                    </Tag>
                  ))}
                </HStack>
              </Box>
            </Flex>
            {/* <Flex justifyContent={"space-between"} width="100%">
              <Flex>
                <AiOutlineStar color="teal.300" />
                <Box as="span" ml="1" fontSize="sm">
                  {stars}
                </Box>
              </Flex>
              <Box >
              <Text
                fontSize="xs"
                fontWeight="400"
                color={useColorModeValue("gray.400", "gray.500")}
              >
                {created}
              </Text>
            </Box>
            </Flex> */}
          </VStack>
        </VStack>
        <Modal isOpen={isOpen} onClose={onClose} isCentered allowPinchZoom>
          <ModalOverlay />
          <ModalContent bg="none" maxW={"28rem"} w="auto">
            <ModalBody p={0} rounded="lg" overflow="hidden" bg="none">
              <Center>
                <Image src={cover} rounded="lg" />
                {/* {type == "image" ? (
                <Image src={cover} rounded="lg" />
              ) : (
                <ReactPlayer url={link} controls playing />
              )} */}
              </Center>
            </ModalBody>
          </ModalContent>
        </Modal>
      </Box>
    </CardTransition>
  );
};

export default RepositoryCard;
