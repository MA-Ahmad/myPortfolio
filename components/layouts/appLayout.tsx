import { useRouter } from 'next/router';
import TopNav from '../shared/top-nav';
import Footer from '../shared/footer';
import { cn } from 'lib/cn';

function AppLayout(props: { children: React.ReactNode }) {
  const router = useRouter();
  const isHome = router.pathname === '/';
  const isBlog =
    router.pathname === '/blog' || router.pathname === '/blog/[slug]';
  // Block grids and previews need more room than the reading column.
  const isWide = router.pathname.startsWith('/blocks');

  return (
    // On wide pages the column's side lines run down to the footer, which sits at the bottom of the
    // screen however short the content is.
    <div
      className={cn(
        'group/layout relative isolate min-h-screen bg-background text-foreground',
        isWide && 'flex flex-col'
      )}
    >
      <TopNav wide={isWide} />
      <main className={cn('max-w-[100vw] overflow-x-clip px-2', isWide && 'flex flex-1 flex-col')}>
        {isHome ? (
          props.children
        ) : isWide ? (
          <div className="mx-auto w-full flex-1 border-x border-line md:max-w-6xl">
            {props.children}
          </div>
        ) : isBlog ? (
          <div className="mx-auto border-x border-line md:max-w-3xl">
            {props.children}
          </div>
        ) : (
          <div className="mx-auto border-x border-line pt-4 md:max-w-3xl">
            <div className="px-4 pb-16 pt-8 text-left">{props.children}</div>
          </div>
        )}
      </main>
      <Footer wide={isWide} className={cn(!isHome && 'border-t-0')} />
    </div>
  );
}

export default AppLayout;
