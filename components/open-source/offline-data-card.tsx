import * as React from 'react';
import { useState } from 'react';
import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import { MotionBox } from '../shared/animations/motion';
import { getTagClasses, useLinkColor } from '../theme';
import { AiOutlineStar } from 'react-icons/ai';
import { FiGithub } from 'react-icons/fi';
import { CardTransition } from '../shared/animations/page-transitions';
import LazyImage from '../shared/lazy-image';
import { Tooltip } from 'components/shared/tooltip';

interface RepositoryCardProps {
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
  const { title, cover, blurHash, technologies, url, stars } = props;
  const [isOpen, setIsOpen] = useState(false);
  const linkColor = useLinkColor();

  const handleLinkClick = (e: React.MouseEvent<HTMLParagraphElement, MouseEvent>, link: string) => {
    window.open(link);
    e.stopPropagation();
  };

  const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] as const };

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
      <div onClick={() => setIsOpen(true)} className="cursor-pointer">
        <div className="flex flex-col items-start overflow-hidden rounded-xl border border-gray-100 bg-white hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="relative w-full">
            <MotionBox variants={thumbnailVariants}>
              <MotionBox whileHover="hover" variants={imageVariants} transition={transition}>
                <div className="relative w-full overflow-hidden border-b border-gray-100 aspect-[1.85/1] dark:border-gray-700">
                  <div className="absolute inset-0 [&>*]:h-full [&>*]:w-full">
                    <LazyImage src={cover} blurHash={blurHash} />
                  </div>
                </div>
              </MotionBox>
            </MotionBox>
          </div>

          <div className="flex w-full flex-col items-start gap-1 px-2 py-2 sm:px-4">
            <div className="flex w-full justify-between">
              <Tooltip label="Github link" placement="top">
                <div className="flex items-center gap-2">
                  <FiGithub className="mt-px h-[0.9em] w-[0.9em]" />
                  <p
                    className="truncate text-left text-sm font-semibold"
                    onClick={(e) => handleLinkClick(e, url)}
                    style={{ color: linkColor }}
                  >
                    {title}
                  </p>
                </div>
              </Tooltip>
              <div className="flex items-center">
                <AiOutlineStar className="mt-px h-[0.9em] w-[0.9em]" />
                <span className="ml-1 text-sm">{stars}</span>
              </div>
            </div>
            <div className="flex w-full justify-between">
              <div className="flex flex-wrap gap-1">
                {technologies.map((tech, index) => (
                  <span
                    key={index}
                    className={`${getTagClasses(tech)} rounded-lg px-2 py-0.5 text-[0.55rem] sm:text-sm`}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-[1400]">
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="w-auto max-w-md overflow-hidden rounded-lg bg-transparent p-0">
              <div className="flex justify-center">
                <img src={cover} className="rounded-lg" alt="Repo image" />
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      </div>
    </CardTransition>
  );
};

export default RepositoryCard;
