import * as React from 'react'
import { SimpleGrid } from '@chakra-ui/react'
import {
  PageSlideFade,
  StaggerChildren,
} from '../shared/animations/page-transitions'
import RepositoryCard from './offline-data-card'
import { MotionBox } from '../shared/animations/motion'

const OfflineData = ({ repositories }) => {
  return (
    <PageSlideFade>
      <StaggerChildren>
        <SimpleGrid columns={[2, 2, 3]} spacing={4} mt={12}>
          {repositories.map((repo, index) => (
            <MotionBox whileHover={{ y: -5 }} key={index}>
              <RepositoryCard
                title={repo.title}
                description={repo.description}
                cover={repo.cover}
                blurHash={repo.blurHash}
                technologies={repo.technologies}
                url={repo.url}
                live={repo.live}
                stars={repo.stars}
                fork={repo.fork}
              />
            </MotionBox>
          ))}
        </SimpleGrid>
      </StaggerChildren>
    </PageSlideFade>
  )
}

export default OfflineData
