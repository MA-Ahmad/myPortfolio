import React from 'react'
import { useDebounce } from 'react-use'
import useSWR from 'swr'

const API_URL = '/api/posts/'

type LikesPayload = {
  totalPostLikes: number
  totalPostViews: number
  currentUserLikes: number
}

async function getPostData(id: string): Promise<LikesPayload> {
  const res = await fetch(API_URL + id)
  return res.json()
}

async function updatePostLikes(
  id: string,
  count: number,
  type: string,
  title: string
): Promise<LikesPayload> {
  const res = await fetch(API_URL + id, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, type, title }),
  })
  return res.json()
}

async function updatePostViews(
  id: string,
  count: number,
  type: string,
  title: string
): Promise<LikesPayload> {
  const res = await fetch(API_URL + id, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, type, title }),
  })
  return res.json()
}

// A custom hook to abstract away fetching and updating a user's likes
export const usePostData = (id: string, title: string) => {
  const { data, error, mutate } = useSWR(id, getPostData)
  const [batchedLikes, setBatchedLikes] = React.useState(0)
  const viewsCount = 1

  const incrementLikes = () => {
    // Prevent the user from liking more than 3 times
    if (!data || data.currentUserLikes >= 3) {
      return
    }

    // Optimistic ui pattern
    // update the local swr cache so like count updates immediately for the user
    // while we update the database
    mutate(
      {
        totalPostLikes: data.totalPostLikes + 1,
        currentUserLikes: data.currentUserLikes + 1,
        totalPostViews: data.totalPostViews,
      },
      false
    )

    // use local state and debounce to batch updates
    setBatchedLikes(batchedLikes + 1)
  }

  const incrementViews = () => {
    mutate(updatePostViews(id, viewsCount, 'views', title))

    if (!data) {
      return
    }

    // Optimistic ui pattern
    // update the local swr cache so views count updates immediately for the user
    // while we update the database
    mutate(
      {
        totalPostLikes: data.totalPostLikes,
        currentUserLikes: data.currentUserLikes,
        totalPostViews: data.totalPostViews + 1,
      },
      false
    )
  }

  useDebounce(
    () => {
      if (batchedLikes === 0) return

      // update the database and use the data updatePostLikes returns to update
      // the local cache with database data
      mutate(updatePostLikes(id, batchedLikes, 'likes', title))
      setBatchedLikes(0)
    },
    1000,
    [batchedLikes]
  )

  return {
    currentUserLikes: data?.currentUserLikes || 0,
    totalPostViews: data?.totalPostViews || 0,
    totalPostLikes: data?.totalPostLikes || 0,
    isLoading: !error && !data,
    isError: error,
    incrementLikes,
    incrementViews,
  }
}
