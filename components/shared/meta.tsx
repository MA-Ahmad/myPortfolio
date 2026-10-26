import Head from 'next/head';
import { useRouter } from 'next/router';
import { SEO_IMAGE, SITE_URL } from 'data/constants';

type Props = {
  title: string;
  description?: string;
  keywords?: string;
  image?: string;
  /** Describes `image`, for screen readers and when it can't load. */
  imageAlt?: string;
  /** Absolute URL of the page's original copy; defaults to this page without its query or hash. */
  canonical?: string;
  noindex?: boolean;
};

const Meta = ({
  title = 'Muhammad Ahmad - Full Stack Developer',
  keywords = 'web development, programming, web design, react js, chakra ui',
  description = 'Software Engineer. Lover of web and opensource.',
  image = SEO_IMAGE,
  imageAlt = 'Muhammad Ahmad, drawn as an isometric MA monogram',
  canonical,
  noindex = false
}: Props): JSX.Element => {
  const { asPath } = useRouter();
  const url = canonical ?? `${SITE_URL}${asPath.split(/[?#]/)[0]}`;

  return (
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="utf-8" />
      <meta name="keywords" content={keywords} />
      <meta name="description" content={description} />
      {/* A noindexed page must not also name a canonical; Google reads the pair as conflicting. */}
      {noindex ? <meta name="robots" content="noindex" /> : <link rel="canonical" href={url} />}
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={title} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={imageAlt} />
      <meta name="twitter:card" content="summary_large_image" />
      <title>{title.includes('Ahmad') ? title : title.concat(' | Muhammad Ahmad')}</title>
    </Head>
  );
};

export default Meta;
