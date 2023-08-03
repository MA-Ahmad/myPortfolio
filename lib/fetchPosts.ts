import useSWR from 'swr';
import { DEVTO_API_URL } from 'data/constants';

const API_URL = '/api/posts/';

type PostProps = {
  id: string;
  slug: string;
  title: string;
  likes: number;
  views: number;
  createdAt: Date;
};

type PostsPayload = {
  dbPosts: PostProps[];
};

async function getPosts(): Promise<PostsPayload> {
  const res = await fetch(API_URL);
  return res.json();
}

export const getDbPosts = () => {
  const { data, error } = useSWR(API_URL, getPosts);

  return {
    dbPosts: data?.dbPosts,
    isLoading: !error && !data,
    isError: error
  };
};

export const getDevtoPosts = async () => {
  const res = await fetch(`${DEVTO_API_URL}/articles?username=${process.env.DEVTO_USERNAME}`);

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Error fetching... Status code: ${res.status}, ${res.statusText}`);
  }
  const dev_posts = await res.json();
  return dev_posts;
};

// export const getDevtoPosts = async () => {
//   const params = { username: process.env.DEVTO_USERNAME, per_page: 1000 };
//   const headers = { "api-key": process.env.DEVTO_APIKEY };

//   const { data }: AxiosResponse = await axios.get(
//     `${DEVTO_APIURL}/articles/me`,
//     {
//       params,
//       headers
//     }
//   );
//   return data;
// };
