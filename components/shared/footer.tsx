import siteConfig from '../../configs/site-config';
import { cn } from 'lib/cn';

const Footer = ({ className }: { className?: string }) => {
  return (
    <footer className={cn('max-w-[100vw] overflow-x-clip px-2', className)}>
      <div className="screen-line-top mx-auto border-x border-line px-4 py-4 md:max-w-3xl">
        <div className="flex w-full flex-col-reverse items-center justify-center gap-3 md:flex-row md:justify-between">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Muhammad Ahmad
          </p>
          <div className="text-center">
            {siteConfig.author.accounts.map((sc, index) => (
              <a
                key={index}
                href={sc.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={sc.label}
                className="inline-flex size-10 items-center justify-center rounded-full text-lg text-muted-foreground no-underline hover:bg-muted hover:text-foreground"
              >
                {sc.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
