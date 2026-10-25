export type CoverArt = 'sun' | 'beam' | 'rings' | 'grid' | 'type';

export type Movie = {
  id: string;
  title: string;
  year: number;
  genre: string;
  runtime: string;
  director: string;
  /** Cover and backdrop colors: deep, mid, highlight. */
  palette: [string, string, string];
  art: CoverArt;
};

export const MOVIES: Movie[] = [
  { id: 'spider-verse', title: 'Spider-Man: Into the Spider-Verse', year: 2018, genre: 'Animation', runtime: '1h 57m', director: 'Persichetti, Ramsey, Rothman', palette: ['#0b1f3a', '#2b6cb0', '#e53e3e'], art: 'beam' },
  { id: 'inception', title: 'Inception', year: 2010, genre: 'Sci-Fi', runtime: '2h 28m', director: 'Christopher Nolan', palette: ['#0f1c24', '#3f5f6e', '#c9d6dc'], art: 'grid' },
  { id: 'mulholland', title: 'Mulholland Drive', year: 2001, genre: 'Mystery', runtime: '2h 27m', director: 'David Lynch', palette: ['#14102a', '#2f5fd0', '#f0a04b'], art: 'sun' },
  { id: 'mononoke', title: 'Princess Mononoke', year: 1997, genre: 'Animation', runtime: '2h 14m', director: 'Hayao Miyazaki', palette: ['#1c2a1a', '#5f7f4a', '#e8dcc0'], art: 'rings' },
  { id: 'lebowski', title: 'The Big Lebowski', year: 1998, genre: 'Comedy', runtime: '1h 57m', director: 'Joel Coen', palette: ['#1a1410', '#b8862b', '#f2e3b3'], art: 'rings' },
  { id: 'prisoners', title: 'Prisoners', year: 2013, genre: 'Thriller', runtime: '2h 33m', director: 'Denis Villeneuve', palette: ['#121416', '#4a5560', '#c2c8cc'], art: 'type' },
  { id: 'drive', title: 'Drive', year: 2011, genre: 'Crime', runtime: '1h 40m', director: 'Nicolas Winding Refn', palette: ['#100a14', '#3a1a4a', '#ff4fa3'], art: 'type' },
  { id: 'pulp-fiction', title: 'Pulp Fiction', year: 1994, genre: 'Crime', runtime: '2h 34m', director: 'Quentin Tarantino', palette: ['#1a0d08', '#b5361f', '#f4c542'], art: 'type' },
  { id: 'dark-knight', title: 'The Dark Knight', year: 2008, genre: 'Action', runtime: '2h 32m', director: 'Christopher Nolan', palette: ['#0a0c10', '#24313f', '#f08a24'], art: 'beam' },
  { id: 'prestige', title: 'The Prestige', year: 2006, genre: 'Mystery', runtime: '2h 10m', director: 'Christopher Nolan', palette: ['#10141c', '#2f4b6b', '#d8e4f0'], art: 'rings' },
  { id: 'star-wars', title: 'Star Wars', year: 1977, genre: 'Sci-Fi', runtime: '2h 1m', director: 'George Lucas', palette: ['#090b14', '#273a73', '#f5d76e'], art: 'sun' },
  { id: 'her', title: 'Her', year: 2013, genre: 'Romance', runtime: '2h 6m', director: 'Spike Jonze', palette: ['#3a0e12', '#d43a3a', '#ffd9c7'], art: 'type' },
  { id: 'lost-in-translation', title: 'Lost in Translation', year: 2003, genre: 'Drama', runtime: '1h 42m', director: 'Sofia Coppola', palette: ['#1b1622', '#8a6f9e', '#f7c6d3'], art: 'grid' },
  { id: 'jaws', title: 'Jaws', year: 1975, genre: 'Thriller', runtime: '2h 4m', director: 'Steven Spielberg', palette: ['#06223a', '#1f7bb6', '#e8423f'], art: 'beam' },
  { id: 'alien', title: 'Alien', year: 1979, genre: 'Sci-Fi', runtime: '1h 57m', director: 'Ridley Scott', palette: ['#050806', '#1d3324', '#9fe870'], art: 'rings' },
  { id: 'nope', title: 'Nope', year: 2022, genre: 'Horror', runtime: '2h 10m', director: 'Jordan Peele', palette: ['#0a1020', '#2a4b8f', '#e9e3d0'], art: 'sun' },
  { id: 'fellowship', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, genre: 'Fantasy', runtime: '2h 58m', director: 'Peter Jackson', palette: ['#1a1a0e', '#6b6a2e', '#e6cf7a'], art: 'rings' },
  { id: 'truman', title: 'The Truman Show', year: 1998, genre: 'Comedy', runtime: '1h 43m', director: 'Peter Weir', palette: ['#0c2a4a', '#4aa3df', '#f5f0e1'], art: 'grid' },
  { id: 'blade-runner', title: 'Blade Runner 2049', year: 2017, genre: 'Sci-Fi', runtime: '2h 44m', director: 'Denis Villeneuve', palette: ['#1f0e06', '#c2571a', '#f7b267'], art: 'sun' },
  { id: 'parasite', title: 'Parasite', year: 2019, genre: 'Thriller', runtime: '2h 12m', director: 'Bong Joon-ho', palette: ['#14181a', '#4d6b5a', '#e7e1d2'], art: 'type' },
  { id: 'spirited-away', title: 'Spirited Away', year: 2001, genre: 'Animation', runtime: '2h 5m', director: 'Hayao Miyazaki', palette: ['#1a1030', '#c2402e', '#f7d9a0'], art: 'beam' },
  { id: 'mood-for-love', title: 'In the Mood for Love', year: 2000, genre: 'Romance', runtime: '1h 38m', director: 'Wong Kar-wai', palette: ['#2a0608', '#9e1b1f', '#f2b134'], art: 'type' },
  { id: 'fight-club', title: 'Fight Club', year: 1999, genre: 'Drama', runtime: '2h 19m', director: 'David Fincher', palette: ['#1a0a12', '#e0427a', '#f2e6c9'], art: 'type' },
  { id: 'vertigo', title: 'Vertigo', year: 1958, genre: 'Thriller', runtime: '2h 8m', director: 'Alfred Hitchcock', palette: ['#2a0a06', '#e2481f', '#f6f0e4'], art: 'rings' },
  { id: 'dune', title: 'Dune', year: 2021, genre: 'Sci-Fi', runtime: '2h 35m', director: 'Denis Villeneuve', palette: ['#2a170c', '#b77a45', '#f1d6a8'], art: 'sun' },
  { id: 'whiplash', title: 'Whiplash', year: 2014, genre: 'Drama', runtime: '1h 47m', director: 'Damien Chazelle', palette: ['#0c0a08', '#a3741f', '#f5c84c'], art: 'beam' },
  { id: 'la-la-land', title: 'La La Land', year: 2016, genre: 'Musical', runtime: '2h 8m', director: 'Damien Chazelle', palette: ['#14123a', '#6b4fc7', '#f7d36b'], art: 'sun' },
  { id: 'fury-road', title: 'Mad Max: Fury Road', year: 2015, genre: 'Action', runtime: '2h', director: 'George Miller', palette: ['#2a1206', '#e0731f', '#f8d27a'], art: 'sun' },
  { id: 'arrival', title: 'Arrival', year: 2016, genre: 'Sci-Fi', runtime: '1h 56m', director: 'Denis Villeneuve', palette: ['#141a1e', '#5f7480', '#e4e9ea'], art: 'rings' },
  { id: 'social-network', title: 'The Social Network', year: 2010, genre: 'Drama', runtime: '2h', director: 'David Fincher', palette: ['#0b1220', '#2a4c7a', '#f0f3f7'], art: 'grid' },
  { id: 'moonlight', title: 'Moonlight', year: 2016, genre: 'Drama', runtime: '1h 51m', director: 'Barry Jenkins', palette: ['#0a1430', '#3a5fcf', '#c96bd6'], art: 'beam' },
  { id: 'interstellar', title: 'Interstellar', year: 2014, genre: 'Sci-Fi', runtime: '2h 49m', director: 'Christopher Nolan', palette: ['#07080c', '#3a3f4f', '#f2d9a6'], art: 'rings' },
  { id: 'seven-samurai', title: 'Seven Samurai', year: 1954, genre: 'Action', runtime: '3h 27m', director: 'Akira Kurosawa', palette: ['#121212', '#5a5a5a', '#e9e4d8'], art: 'grid' },
  { id: 'amelie', title: 'Amélie', year: 2001, genre: 'Romance', runtime: '2h 2m', director: 'Jean-Pierre Jeunet', palette: ['#1e0d06', '#2e7d4f', '#e8b04a'], art: 'beam' },
  { id: 'no-country', title: 'No Country for Old Men', year: 2007, genre: 'Crime', runtime: '2h 2m', director: 'Joel and Ethan Coen', palette: ['#1f150c', '#9a6a3a', '#ecd9b6'], art: 'grid' },
  { id: 'everything-everywhere', title: 'Everything Everywhere All at Once', year: 2022, genre: 'Sci-Fi', runtime: '2h 19m', director: 'Daniel Kwan and Daniel Scheinert', palette: ['#160a24', '#d03c8e', '#7ee0c8'], art: 'rings' }
];
