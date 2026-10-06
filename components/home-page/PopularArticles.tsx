import React from 'react';
import { BlogPostProps } from 'interfaces/interface';
import NextLink from 'next/link';
import moment from 'moment';
import { useLinkColor } from 'components/theme';
import Header from '../shared/header';
import { CardTransition } from 'components/shared/animations/page-transitions';
import { MotionBox } from 'components/shared/animations/motion';
import { getDbPosts } from 'lib/fetchPosts';
import { CommentIcon, HeartIcon } from 'components/shared/icons';
import DisplayText from 'components/shared/icons/DisplayText';
import { Tooltip } from 'components/shared/tooltip';

const ORANGE = '#ff9400';

const PopularArticles: React.FC<BlogPostProps> = (props) => {
  const { posts } = props;
  const { dbPosts, isLoading } = getDbPosts();
  const linkColor = useLinkColor();

  const compare = (
    a: { public_reactions_count: number },
    b: { public_reactions_count: number }
  ) => {
    const countA = a.public_reactions_count;
    const countB = b.public_reactions_count;

    let comparison = 0;
    if (countA < countB) {
      comparison = 1;
    } else if (countA > countB) {
      comparison = -1;
    }
    return comparison;
  };

  const getPostLikes = (slug) => {
    const p = dbPosts?.filter((p) => p.slug === slug)[0];
    return p?.likes || 0;
  };

  return (
    <div className="flex w-full flex-col items-start gap-8">
      <Header underlineColor={ORANGE} className="mb-0 mt-0">
        Popular Articles
      </Header>
      <div className="mt-5 grid w-full grid-cols-1 gap-4">
        {posts &&
          posts
            ?.sort(compare)
            .slice(0, 3)
            .map(
              (
                {
                  description,
                  title,
                  slug,
                  positive_reactions_count,
                  comments_count,
                  published_at
                },
                i
              ) => (
                <MotionBox whileHover={{ y: -5 }} key={i}>
                  <CardTransition>
                    <div className="relative flex flex-col items-start gap-1 rounded-md border border-gray-100 bg-white p-4 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex w-full justify-between">
                        <h3 className="mt-0 text-left text-lg font-semibold">
                          <NextLink href={`/blog/${slug}`} style={{ color: linkColor }}>
                            {title}
                          </NextLink>
                        </h3>
                        <div className="hidden items-center gap-2 sm:flex">
                          {positive_reactions_count ? (
                            <div className="flex items-center">
                              <DisplayText
                                isLoading={isLoading}
                                value={Number(positive_reactions_count) + getPostLikes(slug)}
                              />
                              &nbsp;
                              <HeartIcon />
                            </div>
                          ) : (
                            ''
                          )}
                          {comments_count ? (
                            <div className="flex items-center">
                              <DisplayText isLoading={false} value={comments_count} />
                              &nbsp;
                              <CommentIcon />
                            </div>
                          ) : (
                            ''
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip label="Published" placement="top">
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-200">
                            {moment(published_at).format('Do MMMM YYYY')}
                          </span>
                        </Tooltip>
                        {positive_reactions_count ? (
                          <Tooltip label="Reactions" placement="top">
                            <div className="flex items-center sm:hidden">
                              <DisplayText
                                isLoading={isLoading}
                                value={Number(positive_reactions_count) + getPostLikes(slug)}
                              />
                              &nbsp;
                              <HeartIcon />
                            </div>
                          </Tooltip>
                        ) : (
                          ''
                        )}
                        {comments_count ? (
                          <Tooltip label="Comments" placement="top">
                            <div className="flex items-center sm:hidden">
                              <DisplayText isLoading={false} value={comments_count} />
                              &nbsp;
                              <CommentIcon />
                            </div>
                          </Tooltip>
                        ) : (
                          ''
                        )}
                      </div>
                      <p className="truncate text-left text-base text-gray-500 dark:text-gray-200">
                        {description}
                      </p>
                    </div>
                  </CardTransition>
                </MotionBox>
              )
            )}
      </div>
      <div className="flex w-full justify-center">
        <NextLink
          href="/blog"
          className="flex items-center gap-2"
          style={{ color: linkColor }}>

          <span className="text-sm">More Articles</span>
          <span className="h-[1.2rem] w-[1.2rem]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z"
                clipRule="evenodd"
              />
            </svg>
          </span>

        </NextLink>
      </div>
    </div>
  );
};

export default PopularArticles;
