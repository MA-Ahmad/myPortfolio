import useSWR from "swr"

const API_URL = `/api/posts/`

type PostProps = {
  id: string;
  slug: string;
  likes: number;
  views: number;
  createdAt: Date;
}

type PostsPayload = {
  allPosts: PostProps[]
}

async function getPosts(): Promise<PostsPayload> {
  const res = await fetch(API_URL)
  return res.json()
}

export const fetchAllPosts = () => {
  const { data, error, mutate } = useSWR(API_URL, getPosts)

  return {
    allPosts: data?.allPosts,
    isLoading: !error && !data,
    isError: error,
  }
}
