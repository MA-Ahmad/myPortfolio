import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LazyImage from 'components/shared/lazy-image';
import { useLinkColor } from 'components/theme';
import { Tag } from 'components/shared/Tags';

interface ProjectCardProps {
  title: string;
  description: string;
  logo: string;
  blurHash: string;
  link: string;
  technologies: string[];
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  title,
  description,
  logo,
  blurHash,
  link,
  technologies
}) => {
  const linkColor = useLinkColor();
  const [isOpen, setIsOpen] = React.useState(false);
  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <motion.div layout onClick={toggleOpen}>
      <div className="flex h-full w-full cursor-pointer items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 text-left hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <LazyImage
          src={logo}
          blurHash={blurHash}
          size="sm"
          width={33}
          height={33}
          layout="fixed"
          rounded="md"
        />
        <div className="flex flex-col items-start justify-start">
          <div className="flex flex-col items-start gap-0">
            <motion.div layout>
              <div className="flex items-center gap-2">
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-base font-bold"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: linkColor }}
                >
                  {title}
                </a>
                <div className="flex gap-1">
                  {technologies.map((tech, index) => (
                    <Tag key={index} name={tech} interactive={false} />
                  ))}
                </div>
              </div>
            </motion.div>
            <AnimatePresence>
              <motion.div
                layout
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
              >
                {!isOpen && (
                  <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-200">{description}</p>
                )}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                variants={{ exit: { transition: { staggerChildren: 0.1 } } }}
              >
                {isOpen && <p className="text-sm text-gray-500 dark:text-gray-200">{description}</p>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectCard;
