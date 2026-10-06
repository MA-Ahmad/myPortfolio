import siteConfig from '../../configs/site-config';

const Footer = () => {
  return (
    <footer className="mx-auto w-full max-w-[800px] justify-between p-4 sm:w-[85%] lg:w-[80%]">
      <div className="flex w-full flex-col-reverse items-center justify-center md:flex-row md:justify-between">
        <p className="text-center text-sm text-gray-500 dark:text-gray-200">
          © {new Date().getFullYear()} Muhammad Ahmad{' '}
        </p>
        <div className="text-center">
          {siteConfig.author.accounts.map((sc, index) => (
            <a
              key={index}
              href={sc.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={sc.label}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full text-xl hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {sc.icon}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
