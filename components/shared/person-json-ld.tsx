import Head from 'next/head';
import { SITE_URL } from 'data/constants';
import { EDUCATION, PROFILE } from 'data/profile';

/** schema.org `Person` data for the site's owner, so crawlers and agents can read who this is. */
export function PersonJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/#person`,
    name: PROFILE.displayName,
    url: SITE_URL,
    image: PROFILE.avatar,
    email: `mailto:${PROFILE.email}`,
    jobTitle: PROFILE.jobs[0].title,
    worksFor: { '@type': 'Organization', name: PROFILE.jobs[0].company },
    description: PROFILE.bio[0],
    address: { '@type': 'PostalAddress', addressCountry: 'PK' },
    alumniOf: EDUCATION.map((item) => ({ '@type': 'CollegeOrUniversity', name: item.school })),
    knowsAbout: ['React', 'Next.js', 'TypeScript', 'Ruby on Rails', 'Web development'],
    sameAs: PROFILE.socials.filter((item) => item.name !== 'email').map((item) => item.href)
  };

  return (
    <Head>
      <script
        key="person-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    </Head>
  );
}
