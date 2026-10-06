import * as React from 'react';
import { PageSlideFade, StaggerChildren } from '../shared/animations/page-transitions';
import RepositoryCard from './offline-data-card';
import { MotionBox } from '../shared/animations/motion';

const OfflineData = ({ repositories }) => {
  return (
    <PageSlideFade>
      <StaggerChildren>
        <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-3">
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
        </div>
      </StaggerChildren>
    </PageSlideFade>
  );
};

export default OfflineData;
