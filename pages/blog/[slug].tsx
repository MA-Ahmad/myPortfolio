import * as React from 'react';
import { useState, useEffect } from 'react';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import html from 'remark-html';
import { remark } from 'remark';
import prism from 'remark-prism';
import { getTagClasses } from '../../components/theme';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { BlogPost } from '../../interfaces/interface';
import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import PageLayout from 'components/layouts/pageLayout';
import { MotionBox } from 'components/shared/animations/motion';
import DevToCallToAction from 'components/shared/DevToCallToAction';
import { fadeInUp, stagger } from 'components/shared/animations/page-transitions';
import { motion, AnimatePresence } from 'framer-motion';
import { usePostData } from 'lib/usePostData';
import { LikeButton } from 'components/shared/LikeButton';
import { useLinkColor } from 'components/theme';
import { getDevtoPosts } from 'lib/fetchPosts';
import { HeartIcon, CommentIcon, EyeIcon } from 'components/shared/icons';
import DisplayText from 'components/shared/icons/DisplayText';

dayjs.extend(localizedFormat);

export interface AllBlogProps {
  blogDetails: BlogPost;
  articleContent: string;
}

const POST_VIEW_LIMIT = 100;

const ArticlePage: NextPage<AllBlogProps> = ({ articleContent, blogDetails }) => {
  const { totalPostLikes, totalPostViews, isLoading, incrementViews } = usePostData(
    blogDetails?.slug,
    blogDetails?.title
  );
  const [showLikeButton, setShowLikeButton] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const linkColor = useLinkColor();

  useEffect(() => {
    incrementViews();
    window.addEventListener('scroll', listenToScroll);
    return () => window.removeEventListener('scroll', listenToScroll);
  }, []);

  const listenToScroll = () => {
    if (window.scrollY > 150) setShowLikeButton(true);
    else setShowLikeButton(false);
  };

  return (
    <PageLayout
      title={blogDetails?.title}
      description={blogDetails?.description}
      image={blogDetails?.cover_image}
      keywords={blogDetails?.tags.join(', ')}
    >
      <AnimatePresence>
        {showLikeButton && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed right-[10%] top-1/2 hidden xl:block"
          >
            <LikeButton
              id={blogDetails?.slug}
              title={blogDetails?.title}
              devToLikes={blogDetails?.public_reactions_count}
              linkColor={linkColor}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div initial="initial" animate="animate" variants={stagger}>
        <div className="mb-5 flex flex-col items-start text-left">
          {blogDetails?.cover_image && (
            <MotionBox whileHover={{ scale: 1.02 }}>
              <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: '1.85 / 1' }}>
                {coverFailed ? (
                  <div className="h-full w-full animate-pulse bg-gray-200 dark:bg-gray-700" />
                ) : (
                  <img
                    src={blogDetails?.cover_image}
                    alt=""
                    className="absolute h-full w-full rounded-xl border-2 border-transparent object-cover dark:border-gray-700"
                    onError={() => setCoverFailed(true)}
                  />
                )}
              </div>
            </MotionBox>
          )}
          <motion.div variants={fadeInUp}>
            <h1 className="mb-2 mt-2 text-3xl font-bold">{blogDetails?.title}</h1>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <div className="flex flex-col justify-between sm:flex-row">
              <div className="flex flex-wrap items-center gap-1">
                {blogDetails?.tags.map((tag) => (
                  <span key={tag} className={`${getTagClasses(tag)} rounded-lg px-1 py-0.5 text-sm`}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 sm:pt-0">
                {blogDetails?.public_reactions_count || totalPostLikes ? (
                  <div className="flex items-center">
                    <DisplayText
                      isLoading={isLoading}
                      value={(Number(blogDetails.public_reactions_count) || 0) + totalPostLikes}
                    />
                    &nbsp;
                    <HeartIcon />
                  </div>
                ) : (
                  ''
                )}
                {blogDetails?.comments_count ? (
                  <div className="flex items-center">
                    <DisplayText isLoading={false} value={blogDetails.comments_count} />
                    &nbsp;
                    <CommentIcon />
                  </div>
                ) : (
                  ''
                )}
                {blogDetails && totalPostViews > POST_VIEW_LIMIT ? (
                  <div className="flex items-center">
                    <DisplayText isLoading={isLoading} value={totalPostViews} />
                    &nbsp;
                    <EyeIcon />
                  </div>
                ) : (
                  ''
                )}
              </div>
            </div>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <span className="text-xs">Published on</span>
              <span className="text-xs font-bold">{dayjs(blogDetails?.published_at).format('LL')}</span>
            </div>
          </motion.div>
        </div>
        <motion.div variants={fadeInUp}>
          <div className="article">
            <div dangerouslySetInnerHTML={{ __html: articleContent }} />
          </div>
        </motion.div>
        {blogDetails?.url ? <DevToCallToAction href={blogDetails.url} /> : ''}
      </motion.div>
    </PageLayout>
  );
};

const root = process.cwd();
export const getStaticPaths: GetStaticPaths = async () => {
  let devData: BlogPost[] = await getDevtoPosts();
  devData = devData.filter((data) => data.canonical_url.includes('dev.to'));
  const devtoPaths = devData.map((data) => ({
    params: { slug: data?.slug }
  }));

  const localPaths = fs.readdirSync(path.join(root, 'data', 'posts')).map((p) => ({
    params: {
      slug: p.replace(/\.mdx/, '')
    }
  }));

  return {
    paths: [...devtoPaths, ...localPaths],
    fallback: true
  };
};

const markdownToHtml = async (markdown: string) => {
  const result = await remark().use(html).use(prism).process(markdown);
  return result.toString();
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const devData: BlogPost[] = await getDevtoPosts();

  const selectedBlog = devData.filter(
    (data) => data?.slug === params?.slug && data.canonical_url.includes('dev.to')
  );
  let blogObj = null,
    remarkContent = null;

  if (selectedBlog.length) {
    const res = await fetch(`https://dev.to/api/articles/${selectedBlog[0]?.id}`);
    blogObj = await res.json();
    remarkContent = await markdownToHtml(blogObj.body_markdown);
  } else {
    const markdownWithMeta = fs.readFileSync(
      path.join(root, 'data', 'posts', `${params?.slug}.mdx`),
      'utf-8'
    );
    const { data: frontmatter, content } = matter(markdownWithMeta);
    const devtoPost = devData.filter(
      (data) =>
        !data.canonical_url.includes('dev.to') &&
        data.canonical_url.split('/blog/')[1] === params?.slug
    )[0];
    if (devtoPost) {
      frontmatter['comments_count'] = devtoPost?.comments_count;
      frontmatter['public_reactions_count'] = devtoPost?.public_reactions_count;
      frontmatter['url'] = devtoPost?.url;
    }
    blogObj = frontmatter;

    if (params?.slug) {
      blogObj.slug = params?.slug;
    }
    remarkContent = await markdownToHtml(content);
  }

  if (!devData) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      articleContent: remarkContent,
      blogDetails: blogObj
    },
    revalidate: 1
  };
};

export default ArticlePage;
