import NextLink from 'next/link';
import { format } from 'date-fns';

export type BlogListPost = {
  slug: string;
  title: string;
  description?: string;
  published_at: string;
  cover_image?: string;
};

type HeadingTypes = 'h2' | 'h3';

export function PostItem({
  post,
  headingAs,
  imageLoading = 'lazy'
}: {
  post: BlogListPost;
  headingAs?: HeadingTypes;
  imageLoading?: 'lazy' | 'eager';
}) {
  const Heading = headingAs ?? 'h2';
  const published = new Date(post.published_at);

  return (
    <div className="group/post relative flex h-full flex-col gap-2 p-2 transition-[background-color] ease-out hover:bg-accent-muted">
      {post.cover_image ? (
        <div className="relative select-none">
          <img
            className="aspect-[1200/630] rounded-xl grayscale transition-[filter] duration-300 ease-[cubic-bezier(0.42,0,0.58,1)] group-hover/post:grayscale-0"
            src={post.cover_image}
            alt={post.title}
            width={1200}
            height={630}
            loading={imageLoading}
          />
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/15 dark:ring-white/15" />
        </div>
      ) : null}

      <div className="flex flex-col gap-1 p-2">
        <Heading className="text-lg leading-snug font-medium text-balance">
          <NextLink
            href={`/blog/${post.slug}`}
            className="text-foreground no-underline hover:text-foreground"
          >
            <span className="absolute inset-0" aria-hidden />
            {post.title}
          </NextLink>
        </Heading>

        <dl>
          <dt className="sr-only">Published on</dt>
          <dd className="text-sm text-muted-foreground">
            <time dateTime={published.toISOString()}>
              {format(published, 'd MMM yyyy')}
            </time>
          </dd>
        </dl>
      </div>
    </div>
  );
}
