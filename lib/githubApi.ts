import useSWR from 'swr'
import { GITHUB_API_URL, GITHUB_USERNAME, GITHUB_REPO } from 'data/constants'

const API_URL = `${GITHUB_API_URL}/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/pulls?state=all`

const getData = async () => {
  const res = await fetch(API_URL)
  return res.json()
}

export const fetchPRsData = () => {
  const { data, error, mutate } = useSWR(API_URL, getData)
  return {
    prData: data,
    isLoading: !error && !data,
    isError: error,
  }
}
