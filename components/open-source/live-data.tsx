import * as React from 'react'
import { useState, useEffect } from 'react'
import useFetch from 'use-http'
import { SimpleGrid, Box, useMediaQuery } from '@chakra-ui/react'
import { PageSlideFade } from '../shared/animations/page-transitions'
import RepositoryCard from './live-data-card'
import StackGrid from 'react-stack-grid'
import CardSkeleton from './card-skeleton'
import { GITHUB_API_URL } from 'data/constants'

const LiveData = () => {
  const { get, loading, error, data } = useFetch(GITHUB_API_URL)
  const [repos, setRepos] = useState([])
  const [isLargerThan720] = useMediaQuery('(min-width: 720px)')
  const [isLargerThan982] = useMediaQuery('(min-width: 982px)')

  let columnWidth = 390
  if (isLargerThan982) {
    columnWidth = 390
  } else {
    if (isLargerThan720) {
      columnWidth = 300
    } else {
      // columnWidth = "100%";
    }
  }

  useEffect(() => {
    get('/users/MA-Ahmad/repos').then((res) => {
      setRepos(
        res?.sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 8)
      )
    })
  }, [])

  return (
    <PageSlideFade>
      {loading ? (
        <SimpleGrid columns={[1, 1, 2]} spacing={4} mt={4}>
          <CardSkeleton />
        </SimpleGrid>
      ) : (
        <Box mt={4}>
          <StackGrid
            columnWidth={
              !isLargerThan982 && !isLargerThan720 ? '100%' : columnWidth
            }
          >
            {repos?.map((repo, index) => (
              <RepositoryCard
                key={index}
                title={repo.name}
                description={repo.description}
                language={repo.language}
                url={repo.svn_url}
                // created_at={repo.created_at}
                stargazers_count={repo.stargazers_count}
                forks_count={repo.forks_count}
              />
            ))}
          </StackGrid>
        </Box>
      )}
    </PageSlideFade>
  )
}

export default LiveData
