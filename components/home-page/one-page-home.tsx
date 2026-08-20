import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Link,
  SimpleGrid,
  useColorModeValue,
  Icon,
  Tag,
  Divider,
  Avatar,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { FaGithub, FaLinkedin, FaTwitter, FaDev } from 'react-icons/fa';
import { HiOutlineMail, HiExternalLink } from 'react-icons/hi';
import { siteConfig, SocialLink, Experience, Project, SkillGroup, Education } from 'data/site';
import { ColorModeSwitcher } from 'components/theme/ColorModeSwitcher';

const MotionBox = motion(Box);

const socialIcons: Record<string, React.ElementType> = {
  github: FaGithub,
  linkedin: FaLinkedin,
  twitter: FaTwitter,
  devto: FaDev,
  email: HiOutlineMail,
};

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// ============================================================================
// HEADER
// ============================================================================
const Header = () => {
  const bgColor = useColorModeValue('white', 'gray.900');
  const borderColor = useColorModeValue('gray.100', 'gray.800');

  return (
    <Box
      as="header"
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={100}
      bg={bgColor}
      borderBottom="1px solid"
      borderColor={borderColor}
      backdropFilter="blur(10px)"
      backgroundColor={useColorModeValue('rgba(255, 255, 255, 0.9)', 'rgba(17, 24, 39, 0.9)')}
    >
      <Container maxW="container.md" py={4}>
        <Flex justify="space-between" align="center">
          <Link
            href="/"
            _hover={{ textDecoration: 'none' }}
            fontWeight="600"
            fontSize="lg"
            letterSpacing="-0.02em"
          >
            {siteConfig.personal.firstName}
          </Link>
          <ColorModeSwitcher />
        </Flex>
      </Container>
    </Box>
  );
};

// ============================================================================
// HERO SECTION
// ============================================================================
const HeroSection = () => {
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const headingColor = useColorModeValue('gray.900', 'white');
  const linkColor = useColorModeValue('gray.700', 'gray.300');
  const linkHoverColor = useColorModeValue('gray.900', 'white');

  return (
    <MotionBox
      as="section"
      pt={{ base: 28, md: 36 }}
      pb={{ base: 16, md: 24 }}
      {...fadeInUp}
    >
      <VStack spacing={6} align="start">
        <Avatar
          size="xl"
          src={siteConfig.personal.avatar}
          name={siteConfig.personal.name}
          showBorder
          borderColor={useColorModeValue('gray.200', 'gray.700')}
        />
        
        <VStack spacing={3} align="start">
          <Heading
            as="h1"
            fontSize={{ base: '3xl', md: '4xl' }}
            fontWeight="700"
            letterSpacing="-0.03em"
            color={headingColor}
            lineHeight="1.2"
          >
            {siteConfig.personal.name}
          </Heading>
          <Text
            fontSize={{ base: 'lg', md: 'xl' }}
            color={textColor}
            fontWeight="400"
          >
            {siteConfig.personal.role} · {siteConfig.personal.location}{' '}
            {siteConfig.personal.locationEmoji}
          </Text>
        </VStack>

        <Text
          fontSize={{ base: 'md', md: 'lg' }}
          color={textColor}
          lineHeight="1.7"
          maxW="600px"
        >
          {siteConfig.personal.bio}
        </Text>

        <HStack spacing={4} pt={2}>
          {siteConfig.socials.map((social: SocialLink) => (
            <Link
              key={social.platform}
              href={social.url}
              isExternal
              color={linkColor}
              _hover={{ color: linkHoverColor }}
              aria-label={social.label}
            >
              <Icon
                as={socialIcons[social.platform] || HiExternalLink}
                boxSize={5}
              />
            </Link>
          ))}
        </HStack>
      </VStack>
    </MotionBox>
  );
};

// ============================================================================
// SECTION HEADING
// ============================================================================
interface SectionHeadingProps {
  title: string;
}

const SectionHeading = ({ title }: SectionHeadingProps) => {
  const headingColor = useColorModeValue('gray.900', 'white');
  
  return (
    <Heading
      as="h2"
      fontSize={{ base: 'xl', md: '2xl' }}
      fontWeight="600"
      letterSpacing="-0.02em"
      color={headingColor}
      mb={8}
    >
      {title}
    </Heading>
  );
};

// ============================================================================
// EXPERIENCE SECTION
// ============================================================================
const ExperienceSection = () => {
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const periodColor = useColorModeValue('gray.500', 'gray.500');
  const borderColor = useColorModeValue('gray.100', 'gray.800');

  return (
    <MotionBox as="section" py={{ base: 12, md: 16 }} {...fadeInUp}>
      <SectionHeading title="Experience" />
      <VStack spacing={0} align="stretch">
        {siteConfig.experience.map((exp: Experience, index: number) => (
          <Box
            key={exp.company}
            py={6}
            borderTop={index === 0 ? '1px solid' : 'none'}
            borderBottom="1px solid"
            borderColor={borderColor}
          >
            <Flex
              direction={{ base: 'column', md: 'row' }}
              justify="space-between"
              align={{ base: 'start', md: 'start' }}
              gap={2}
            >
              <VStack align="start" spacing={1}>
                <Text fontWeight="500" fontSize="md">
                  {exp.role}
                </Text>
                <Text color={textColor} fontSize="sm">
                  {exp.company}
                </Text>
              </VStack>
              <Text
                color={periodColor}
                fontSize="sm"
                fontFamily="mono"
                flexShrink={0}
              >
                {exp.period}
              </Text>
            </Flex>
            {exp.description && (
              <Text color={textColor} fontSize="sm" mt={3} lineHeight="1.6">
                {exp.description}
              </Text>
            )}
          </Box>
        ))}
      </VStack>
    </MotionBox>
  );
};

// ============================================================================
// PROJECT CARD
// ============================================================================
interface ProjectCardProps {
  project: Project;
  cardBg: string;
  cardHoverBg: string;
  textColor: string;
  linkColor: string;
}

const ProjectCard = ({ project, cardBg, cardHoverBg, textColor, linkColor }: ProjectCardProps) => {
  const cardContent = (
    <VStack align="start" spacing={3}>
      <Flex justify="space-between" align="center" w="full">
        <Text fontWeight="500" fontSize="md">
          {project.title}
        </Text>
        {project.url && (
          <Icon as={HiExternalLink} color={linkColor} boxSize={4} />
        )}
      </Flex>
      <Text color={textColor} fontSize="sm" lineHeight="1.6" noOfLines={3}>
        {project.description}
      </Text>
      <HStack spacing={2} flexWrap="wrap">
        {project.techStack.map((tech) => (
          <Tag
            key={tech}
            size="sm"
            variant="subtle"
            colorScheme="gray"
            fontWeight="400"
            fontSize="xs"
          >
            {tech}
          </Tag>
        ))}
      </HStack>
    </VStack>
  );

  const sharedStyles = {
    p: 5,
    bg: cardBg,
    borderRadius: 'lg',
    transition: 'all 0.2s',
    _hover: {
      bg: cardHoverBg,
      transform: 'translateY(-2px)',
    },
  };

  if (project.url) {
    return (
      <Link
        href={project.url}
        isExternal
        _hover={{ textDecoration: 'none' }}
        {...sharedStyles}
      >
        {cardContent}
      </Link>
    );
  }

  return <Box {...sharedStyles}>{cardContent}</Box>;
};

// ============================================================================
// PROJECTS SECTION
// ============================================================================
const ProjectsSection = () => {
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const cardBg = useColorModeValue('gray.50', 'gray.800');
  const cardHoverBg = useColorModeValue('gray.100', 'gray.750');
  const linkColor = useColorModeValue('gray.700', 'gray.300');

  return (
    <MotionBox as="section" py={{ base: 12, md: 16 }} {...fadeInUp}>
      <SectionHeading title="Selected Projects" />
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {siteConfig.featuredProjects.map((project: Project) => (
          <ProjectCard
            key={project.title}
            project={project}
            cardBg={cardBg}
            cardHoverBg={cardHoverBg}
            textColor={textColor}
            linkColor={linkColor}
          />
        ))}
      </SimpleGrid>
    </MotionBox>
  );
};

// ============================================================================
// SKILLS SECTION
// ============================================================================
const SkillsSection = () => {
  const textColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <MotionBox as="section" py={{ base: 12, md: 16 }} {...fadeInUp}>
      <SectionHeading title="Skills" />
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={6}>
        {siteConfig.skills.map((group: SkillGroup) => (
          <VStack key={group.category} align="start" spacing={3}>
            <Text fontWeight="500" fontSize="sm">
              {group.category}
            </Text>
            <VStack align="start" spacing={1}>
              {group.skills.map((skill) => (
                <Text key={skill} color={textColor} fontSize="sm">
                  {skill}
                </Text>
              ))}
            </VStack>
          </VStack>
        ))}
      </SimpleGrid>
    </MotionBox>
  );
};

// ============================================================================
// EDUCATION SECTION
// ============================================================================
const EducationSection = () => {
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const periodColor = useColorModeValue('gray.500', 'gray.500');
  const borderColor = useColorModeValue('gray.100', 'gray.800');

  return (
    <MotionBox as="section" py={{ base: 12, md: 16 }} {...fadeInUp}>
      <SectionHeading title="Education" />
      <VStack spacing={0} align="stretch">
        {siteConfig.education.map((edu: Education, index: number) => (
          <Box
            key={edu.institution}
            py={6}
            borderTop={index === 0 ? '1px solid' : 'none'}
            borderBottom="1px solid"
            borderColor={borderColor}
          >
            <Flex
              direction={{ base: 'column', md: 'row' }}
              justify="space-between"
              align={{ base: 'start', md: 'start' }}
              gap={2}
            >
              <VStack align="start" spacing={1}>
                <Text fontWeight="500" fontSize="md">
                  {edu.degree}
                </Text>
                <Text color={textColor} fontSize="sm">
                  {edu.institution}
                </Text>
              </VStack>
              <Text
                color={periodColor}
                fontSize="sm"
                fontFamily="mono"
                flexShrink={0}
              >
                {edu.period}
              </Text>
            </Flex>
          </Box>
        ))}
      </VStack>
    </MotionBox>
  );
};

// ============================================================================
// CONTACT SECTION
// ============================================================================
const ContactSection = () => {
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const linkColor = useColorModeValue('gray.900', 'white');

  const emailLink = siteConfig.socials.find((s) => s.platform === 'email');

  return (
    <MotionBox as="section" py={{ base: 12, md: 16 }} {...fadeInUp}>
      <SectionHeading title="Get in Touch" />
      <Text color={textColor} fontSize="md" lineHeight="1.7" maxW="500px">
        I'm always open to discussing new projects, creative ideas, or opportunities to be part of your vision.
      </Text>
      {emailLink && (
        <Link
          href={emailLink.url}
          color={linkColor}
          fontWeight="500"
          fontSize="md"
          mt={4}
          display="inline-block"
          _hover={{ textDecoration: 'underline' }}
        >
          {emailLink.url.replace('mailto:', '')} →
        </Link>
      )}
    </MotionBox>
  );
};

// ============================================================================
// FOOTER
// ============================================================================
const Footer = () => {
  const textColor = useColorModeValue('gray.500', 'gray.500');

  return (
    <Box as="footer" py={{ base: 12, md: 16 }}>
      <Divider mb={8} />
      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'start', md: 'center' }}
        gap={4}
      >
        <Text color={textColor} fontSize="sm">
          {siteConfig.footer.copyright}
        </Text>
        <HStack spacing={4}>
          {siteConfig.socials.slice(0, 4).map((social: SocialLink) => (
            <Link
              key={social.platform}
              href={social.url}
              isExternal
              color={textColor}
              _hover={{ color: useColorModeValue('gray.900', 'white') }}
              fontSize="sm"
            >
              {social.label}
            </Link>
          ))}
        </HStack>
      </Flex>
    </Box>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const OnePageHome = () => {
  const bgColor = useColorModeValue('white', 'gray.900');

  return (
    <Box bg={bgColor} minH="100vh">
      <Header />
      <Container maxW="container.md" px={{ base: 6, md: 8 }}>
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <HeroSection />
          <ExperienceSection />
          <ProjectsSection />
          <SkillsSection />
          <EducationSection />
          <ContactSection />
          <Footer />
        </motion.div>
      </Container>
    </Box>
  );
};

export default OnePageHome;
