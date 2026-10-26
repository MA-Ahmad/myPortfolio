import { ReactElement, useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import Meta from 'components/shared/meta';
import { PROFILES } from 'blocks/api-lifecycle/model';
import { DATASETS } from 'blocks/api-lifecycle/fixtures';
import type { NextPageWithLayout } from '../_app';

/**
 * Dev only: the API lifecycle block with its users swapped for a worst-case dataset, chosen by
 * `?data=`. The swap happens before the block's module loads, so every part of it reads the same
 * users; each segment is a full page load.
 */

const STATES = [
  { key: 'demo', label: 'Demo data' },
  { key: 'worst', label: 'Worst case' },
  { key: 'one', label: 'One' },
  { key: 'many', label: 'Five users' },
  { key: 'empty', label: 'Empty' }
];

const chosen =
  typeof window === 'undefined'
    ? 'demo'
    : (new URLSearchParams(window.location.search).get('data') ?? 'demo');
if (DATASETS[chosen]) PROFILES.splice(0, PROFILES.length, ...DATASETS[chosen]);

const Block = dynamic(() => import('blocks/api-lifecycle/api-lifecycle'), { ssr: false });

const DataToggle: NextPageWithLayout = () => {
  // The server always renders Demo; the pill follows the URL once the page is in the browser.
  const [active, setActive] = useState('demo');
  useEffect(() => setActive(chosen), []);

  return (
    <>
      <Meta title="API lifecycle - data toggle" noindex />
      <div className="min-h-screen bg-background pb-20 text-foreground">
        <Block />
      </div>
      <nav
        style={{ fontFamily: 'system-ui, sans-serif' }}
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full bg-neutral-200 p-1 text-xs"
      >
        {STATES.map((state) => (
          <a
            key={state.key}
            href={`?data=${state.key}`}
            className={`rounded-full px-3 py-1 text-neutral-700 no-underline ${active === state.key ? 'bg-white shadow-sm' : ''}`}
          >
            {state.label}
          </a>
        ))}
      </nav>
    </>
  );
};

DataToggle.getLayout = (page: ReactElement) => page;

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} };

export default DataToggle;
