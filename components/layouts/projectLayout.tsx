import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { stagger, fadeInUp } from '../shared/animations/framerAnimations';
import { HiOutlineExternalLink } from 'react-icons/hi';
import { AiOutlineGithub } from 'react-icons/ai';
import { MotionBox, MotionFlex, MotionList, MotionText } from 'components/shared/animations/motion';

const ProjectImage = ({ src, className = '' }: { src: string; className?: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className={`animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700 ${className}`} />;
  }
  return (
    <img
      src={src}
      alt=""
      className={`absolute h-full w-full rounded-xl object-cover opacity-50 hover:opacity-100 ${className}`}
      onError={() => setFailed(true)}
    />
  );
};

const ProjectLayoutMed = ({ project }) => {
  return (
    <div className="relative flex h-80 w-full items-start overflow-hidden rounded-xl border border-gray-600 text-left shadow-md hover:shadow-lg dark:border-gray-700 lg:hidden">
      <a href={project.site} target="_blank" rel="noopener noreferrer" className="absolute inset-0">
        <div className="relative h-full w-full overflow-hidden rounded-xl" style={{ aspectRatio: '1.85 / 1' }}>
          <ProjectImage src={project.imageLight} />
        </div>
        <div className="absolute h-full w-full bg-gray-100 opacity-50 dark:bg-gray-900 dark:opacity-100" />
      </a>
      <MotionBox
        initial="initial"
        animate="animate"
        className="relative z-10 my-auto w-full rounded-lg px-6 py-3 sm:w-[70%]"
      >
        <MotionBox variants={stagger}>
          <a href={project.site} target="_blank" rel="noopener noreferrer">
            <MotionText variants={fadeInUp} className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {project.title}
            </MotionText>
            <div className="w-full">
              <MotionText
                variants={fadeInUp}
                className="rounded-lg bg-gray-200 p-4 text-left text-sm dark:bg-gray-700"
              >
                {project.description}
              </MotionText>
              {project.techStack && (
                <MotionList
                  variants={fadeInUp}
                  className="mt-3 flex justify-start text-xs font-bold text-gray-900 dark:text-gray-100"
                >
                  {project.techStack.map((s, index) => (
                    <li key={index} className="mr-2">
                      <i>{s}</i>
                    </li>
                  ))}
                </MotionList>
              )}
            </div>
          </a>
          <MotionFlex variants={fadeInUp} className="mt-1 flex justify-start pt-2">
            {project.gitHub && (
              <a className="mr-2" href={project.gitHub} target="_blank" rel="noopener noreferrer">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                  <AiOutlineGithub />
                </span>
              </a>
            )}
            <a href={project.site} target="_blank" rel="noopener noreferrer">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <HiOutlineExternalLink />
              </span>
            </a>
          </MotionFlex>
        </MotionBox>
      </MotionBox>
    </div>
  );
};

const LeftProjectLayoutLarge = ({ project }) => {
  return (
    <div className="hidden w-full lg:flex">
      <MotionBox
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ x: 500, opacity: 0 }}
        animate={{
          x: 0,
          opacity: 1,
          transition: {
            duration: 0.5,
            ease: 'easeInOut'
          }
        }}
        className="relative h-96 w-4/5 overflow-hidden rounded-xl border border-gray-600 text-left shadow-md hover:shadow-lg dark:border-gray-700"
      >
        <a href={project.site} target="_blank" rel="noopener noreferrer">
          <div className="relative h-full w-full overflow-hidden rounded-xl" style={{ aspectRatio: '1.85 / 1' }}>
            <ProjectImage src={project.imageLight} />
          </div>
        </a>
      </MotionBox>
      <MotionBox
        initial="initial"
        animate="animate"
        className="z-10 my-auto -ml-24 w-2/5 rounded-lg text-right"
      >
        <motion.div variants={stagger}>
          <a href={project.site} target="_blank" rel="noopener noreferrer" className="text-right">
            <MotionText variants={fadeInUp} className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {project.title}
            </MotionText>
          </a>
          <div className="w-full">
            <MotionText
              variants={fadeInUp}
              className="rounded-lg bg-gray-200 p-4 text-right text-base dark:bg-gray-700"
            >
              {project.description}
            </MotionText>
            {project.techStack && (
              <MotionList
                variants={fadeInUp}
                className="mt-3 flex justify-end text-sm font-bold text-gray-900 dark:text-gray-100"
              >
                {project.techStack.map((s, index) => (
                  <li key={index} className="mr-3">
                    <i>{s}</i>
                  </li>
                ))}
              </MotionList>
            )}
          </div>

          <MotionFlex variants={fadeInUp} className="mt-1 flex justify-end pt-2">
            {project.gitHub && (
              <a className="mr-2" href={project.gitHub} target="_blank" rel="noopener noreferrer">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                  <AiOutlineGithub />
                </span>
              </a>
            )}
            <a href={project.site} target="_blank" rel="noopener noreferrer">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <HiOutlineExternalLink />
              </span>
            </a>
          </MotionFlex>
        </motion.div>
      </MotionBox>
    </div>
  );
};

const RightProjectLayoutLarge = ({ project }) => {
  return (
    <div className="hidden w-full lg:flex">
      <MotionBox
        initial="initial"
        animate="animate"
        className="z-10 my-auto -mr-24 w-2/5 rounded-lg text-left"
      >
        <motion.div variants={stagger}>
          <a href={project.site} target="_blank" rel="noopener noreferrer">
            <MotionText variants={fadeInUp} className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {project.title}
            </MotionText>
          </a>
          <div className="w-full">
            <MotionText
              variants={fadeInUp}
              className="rounded-lg bg-gray-200 p-4 text-left text-base dark:bg-gray-700"
            >
              {project.description}
            </MotionText>
            {project.techStack && (
              <MotionList
                variants={fadeInUp}
                className="mt-3 flex justify-start text-sm font-bold text-gray-900 dark:text-gray-100"
              >
                {project.techStack.map((s, index) => (
                  <li key={index} className="mr-3">
                    <i>{s}</i>
                  </li>
                ))}
              </MotionList>
            )}
          </div>

          <MotionFlex variants={fadeInUp} className="mt-1 flex justify-start pt-2">
            {project.gitHub && (
              <a className="mr-2" href={project.gitHub} target="_blank" rel="noopener noreferrer">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                  <AiOutlineGithub />
                </span>
              </a>
            )}
            <a href={project.site} target="_blank" rel="noopener noreferrer">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <HiOutlineExternalLink />
              </span>
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
            ease: 'easeInOut'
          }
        }}
        className="relative h-96 w-4/5 overflow-hidden rounded-xl border border-gray-600 text-left shadow-md hover:shadow-lg dark:border-gray-700"
      >
        <a href={project.site} target="_blank" rel="noopener noreferrer">
          <div className="relative h-full w-full overflow-hidden rounded-xl" style={{ aspectRatio: '1.85 / 1' }}>
            <ProjectImage src={project.imageLight} />
          </div>
        </a>
      </MotionBox>
    </div>
  );
};

export { LeftProjectLayoutLarge, RightProjectLayoutLarge, ProjectLayoutMed };
