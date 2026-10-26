import type { Profile } from './model';

/**
 * Worst-case users for the dev-only data toggle at /dev/api-lifecycle. Not part of the block's
 * registry files. Limits: X handles are at most 15 characters, GitHub usernames at most 39.
 */

export const DATASETS: Record<string, Profile[]> = {
  worst: [
    {
      id: 42,
      name: 'Aleksandra Wiśniewska-Kowalczyk',
      handle: 'olawisniewskako',
      github: 'aleksandra-wisniewska-kowalczyk',
      role: 'Senior Product Design Engineer, Platform Infrastructure',
      repos: 1284,
      followers: 1_000_000
    },
    { id: 108, name: 'Jo', handle: 'jo', role: 'Intern', repos: 1, followers: 1 }
  ],
  one: [{ id: 42, name: 'Christopher Alexander Montgomery III', handle: 'cmontgomery3', role: 'CTO', repos: 0, followers: 0 }],
  many: [
    { id: 42, name: '🦊 Fox', handle: 'fox', role: 'Engineer', repos: 12, followers: 999 },
    { id: 108, name: '王秀英', handle: 'wangxiuying', role: '工程师', repos: 8, followers: 1_050 },
    { id: 250, name: 'Đặng Thị Ngọc Hân', handle: 'ngochan', role: 'Designer', repos: 3, followers: 40 },
    { id: 305, name: '  Sam   Lee ', handle: 'samlee', role: 'Support', repos: 2, followers: 9 },
    { id: 7, name: 'Seán O\'Brien-Ó Súilleabháin', handle: 'seanob', role: 'PM', repos: 5, followers: 77 }
  ],
  empty: []
};
