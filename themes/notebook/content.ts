import { PROFILE } from 'data/profile';

export const NOTEBOOK_CONTENT = {
  lede: `${PROFILE.jobs[0].title} at ${PROFILE.jobs[0].company}. I build web products end to end, ship fast, and contribute to open source.`,
  clockLabel: `in ${PROFILE.address}`,
  notesCount: 5,
  nav: [
    { label: 'notes', href: '#notes' },
    { label: 'projects', href: '#projects' },
    { label: 'work', href: '#work' }
  ],
  // The backdrop reads this one token at a time.
  passage:
    'I build web products end to end and ship fast. I love open source, clean code and products that feel fast. I write about react, next and rails on my blog every year.'
};
