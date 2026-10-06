import { useRouter } from 'next/router';
import TopNav from '../shared/top-nav';
import Footer from '../shared/footer';
import { cn } from 'lib/cn';

function AppLayout(props: { children: React.ReactNode }) {
  const router = useRouter();
  const isHome = router.pathname === '/';

  return (
    <div className="group/layout relative isolate min-h-screen bg-background text-foreground">
      <TopNav />
      <main className="max-w-[100vw] overflow-x-clip px-2">
        {isHome ? (
          props.children
        ) : (
          <div className="mx-auto border-x border-line pt-4 md:max-w-3xl">
            <div className="px-4 pb-16 pt-8 text-left">{props.children}</div>
          </div>
        )}
      </main>
      <Footer className={cn(!isHome && 'border-t-0')} />
    </div>
  );
}

export default AppLayout;
