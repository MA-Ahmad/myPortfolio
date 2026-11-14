import { IBM_Plex_Mono, Newsreader } from 'next/font/google';

/** The paragraph's serif, shared by the page and its Theme Studio preview. */
export const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--mg-font-serif',
  display: 'swap'
});

/** The notes' mono. */
export const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--mg-font-mono',
  display: 'swap'
});
