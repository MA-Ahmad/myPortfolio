const MicrosoftClarity = () => {
  if (!process.env.MICROSOFT_CLARITY) return null;

  // Not inside a frame: a Theme Studio preview isn't a visit.
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `if (window.self === window.top) (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${process.env.MICROSOFT_CLARITY}")`
      }}
    />
  );
};

export default MicrosoftClarity;
