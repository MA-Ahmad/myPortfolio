import * as React from 'react';
import { useState, useEffect } from 'react';
import useFetch from 'use-http';
import { PageSlideFade } from '../shared/animations/page-transitions';
import RepositoryCard from './live-data-card';
import CardSkeleton from './card-skeleton';
import { GITHUB_API_URL } from 'data/constants';

const LiveData = () => {
  const { get, loading } = useFetch(GITHUB_API_URL);
  const [repos, setRepos] = useState([]);

  useEffect(() => {
    get('/users/MA-Ahmad/repos').then((res) => {
      setRepos(res?.sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 8));
    });
  }, []);

  return (
    <PageSlideFade>
      {loading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardSkeleton />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {repos?.map((repo, index) => (
            <RepositoryCard
              key={index}
              title={repo.name}
              description={repo.description}
              language={repo.language}
              url={repo.svn_url}
              stargazers_count={repo.stargazers_count}
              forks_count={repo.forks_count}
            />
          ))}
        </div>
      )}
    </PageSlideFade>
  );
};

export default LiveData;
