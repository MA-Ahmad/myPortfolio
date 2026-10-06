import NextLink from 'next/link';
import { CardTransition } from '../shared/animations/page-transitions';
import { BlogPost } from '../../interfaces/interface';
import moment from 'moment';
import { useLinkColor } from 'components/theme';
import { Tags } from 'components/shared/Tags';
import { HeartIcon, CommentIcon } from 'components/shared/icons';
import DisplayText from 'components/shared/icons/DisplayText';
import { Tooltip } from 'components/shared/tooltip';

interface IProps {
  post: BlogPost;
  isLoading: boolean;
  postDbLikes: number;
}

const PostCard = ({ post, isLoading, postDbLikes }: IProps) => {
  const linkColor = useLinkColor();
  const devIcon = '/assets/images/logos/dev.png';

  return (
    <CardTransition>
      <div className="relative flex w-full min-w-0 flex-col items-start gap-2 rounded-md border border-gray-100 bg-white p-4 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
        {post.url ? (
          <Tooltip label="Dev.to" placement="top">
            <img
              src={devIcon}
              width="32"
              height="32"
              alt=""
              className="absolute right-2 top-[-14px] dark:hidden"
            />
          </Tooltip>
        ) : (
          ''
        )}
        {post.url ? (
          <img
            src="/assets/images/logos/dev_white.png"
            width="32"
            height="32"
            alt=""
            className="absolute right-2 top-[-14px] hidden dark:block"
          />
        ) : null}

        <div className="flex w-full min-w-0 items-start justify-between gap-3">
          <h3 className="mt-0 min-w-0 flex-1 text-left text-lg font-semibold leading-snug">
            <NextLink href={`/blog/${post.slug}`} style={{ color: linkColor }}>
              {post.title}
            </NextLink>
          </h3>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {post.public_reactions_count || postDbLikes ? (
              <div className="flex items-center">
                <DisplayText
                  isLoading={isLoading}
                  value={(Number(post.public_reactions_count) || 0) + postDbLikes}
                />
                &nbsp;
                <HeartIcon />
              </div>
            ) : (
              ''
            )}
            {post.comments_count ? (
              <div className="flex items-center">
                <DisplayText isLoading={false} value={post.comments_count} />
                &nbsp;
                <CommentIcon />
              </div>
            ) : (
              ''
            )}
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
          <Tooltip label="Published" placement="top">
            <span className="shrink-0 text-sm font-semibold text-gray-500 dark:text-gray-200">
              {moment(post.published_at).format('Do MMMM YYYY')}
            </span>
          </Tooltip>
          <div className="flex gap-2">
            {post.public_reactions_count || postDbLikes ? (
              <Tooltip label="Reactions" placement="top">
                <div className="flex items-center sm:hidden">
                  <DisplayText
                    isLoading={isLoading}
                    value={(Number(post.public_reactions_count) || 0) + postDbLikes}
                  />
                  &nbsp;
                  <HeartIcon />
                </div>
              </Tooltip>
            ) : (
              ''
            )}
            {post.comments_count ? (
              <Tooltip label="Comments" placement="top">
                <div className="flex items-center sm:hidden">
                  <DisplayText isLoading={false} value={post.comments_count} />
                  &nbsp;
                  <CommentIcon />
                </div>
              </Tooltip>
            ) : (
              ''
            )}
          </div>
          <div className="hidden items-center gap-1 lg:flex">
            <Tags tags={post.tag_list} interactive={false} />
          </div>
        </div>
        <div className="flex items-center gap-1 lg:hidden">
          <Tags tags={post.tag_list} interactive={false} />
        </div>
        <p className="w-full min-w-0 truncate text-left text-base text-gray-500 dark:text-gray-200">
          {post.description}
        </p>
      </div>
    </CardTransition>
  );
};

export default PostCard;
