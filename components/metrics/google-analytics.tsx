import { GA_TRACKING_ID } from 'lib/gtag';

const GoogleAnalytics = () => {
  if (!GA_TRACKING_ID) return null;

  // Global Site Tag (gtag.js). Theme Studio previews a page in a frame before opening it; that
  // isn't a visit, so a framed page neither loads the tag nor reports a view.
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            if (window.self === window.top) {
              var s = document.createElement('script');
              s.async = true;
              s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}';
              document.head.appendChild(s);
              gtag('js', new Date());
              gtag('config', '${GA_TRACKING_ID}', {
                page_path: window.location.pathname,
              });
            }
          `
      }}
    />
  );
};

export default GoogleAnalytics;
