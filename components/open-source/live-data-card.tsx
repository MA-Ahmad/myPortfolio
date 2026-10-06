import * as React from 'react';
import { MotionBox } from '../shared/animations/motion';
import { getTagClasses, useLinkColor } from '../theme';
import { BiGitRepoForked, BiStar } from 'react-icons/bi';
import { FiGithub } from 'react-icons/fi';
import { Tooltip } from 'components/shared/tooltip';

interface RepositoryCardProps {
  title: string;
  description: string;
  url: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
}
const RepositoryCard = (props: RepositoryCardProps) => {
  const { title, description, language, url, stargazers_count, forks_count } = props;
  const linkColor = useLinkColor();

  const handleLinkClick = (e: React.MouseEvent<HTMLParagraphElement, MouseEvent>, link: string) => {
    window.open(link);
    e.stopPropagation();
  };

  return (
    <MotionBox whileHover={{ y: -5 }}>
      <div className="mt-2 rounded-xl border border-gray-100 bg-white px-2 py-2 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:px-4">
        <div className="flex flex-col items-start gap-1 overflow-hidden">
          <div className="flex w-full flex-col items-start gap-1">
            <div className="flex w-full justify-between" onClick={(e) => handleLinkClick(e, url)}>
              <Tooltip label="Github link" placement="top">
                <div className="flex cursor-pointer items-center gap-2">
                  <FiGithub className="mt-px h-[0.9em] w-[0.9em]" />
                  <p className="truncate text-left text-sm font-semibold" style={{ color: linkColor }}>
                    {title}
                  </p>
                </div>
              </Tooltip>
              <div className="flex cursor-pointer items-center gap-2" onClick={(e) => handleLinkClick(e, url)}>
                {forks_count ? (
                  <div className="hover:text-blue-500">
                    <BiGitRepoForked className="mt-px inline h-[0.9em] w-[0.9em]" />
                    <span className="ml-1 text-sm">{forks_count}</span>
                  </div>
                ) : null}
                <div className="hover:text-blue-500">
                  <BiStar className="mt-px inline h-[0.9em] w-[0.9em]" />
                  <span className="ml-1 text-sm">{stargazers_count}</span>
                </div>
              </div>
            </div>
            {language && (
              <div className="flex w-full justify-between">
                <span className={`${getTagClasses(language)} rounded-lg px-2 py-0.5 text-[0.55rem] sm:text-sm`}>
                  {language}
                </span>
              </div>
            )}
          </div>
          <p className="line-clamp-2 text-left text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </MotionBox>
  );
};

export default RepositoryCard;
