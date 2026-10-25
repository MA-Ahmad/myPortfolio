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
    <div className="group/layout relative isolate min-h-screen bg-background text-foreground">
      <TopNav wide={isWide} />
      <main className="max-w-[100vw] overflow-x-clip px-2">
        {isHome ? (
          props.children
        ) : isWide ? (
          <div className="mx-auto border-x border-line md:max-w-6xl">
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
