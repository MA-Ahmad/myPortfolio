import * as React from 'react';
import { PageSlideFade } from 'components/shared/animations/page-transitions';
import Header from 'components/shared/header';
import { RiSignalTowerLine, RiWifiOffLine } from 'react-icons/ri';
import OfflineData from 'components/open-source/offline-data';
import LiveData from 'components/open-source/live-data';
import { repositories } from 'data/repositories';
import { useSwitchSound } from 'lib/use-switch-sound';
import PageLayout from 'components/layouts/pageLayout';
import { Tooltip } from 'components/shared/tooltip';
import { cn } from 'lib/cn';

const TURQUOISE = '#06b6d4';

const RepositoriesList = ({ repositories }) => {
  const [activeTab, setActiveTab] = React.useState('live');

  const play = useSwitchSound();

  const handleClick = (type) => {
    activeTab === 'live' ? play('on') : play('off');
    setActiveTab(type);
  };

  return (
    <PageLayout title="Open-source" keywords="A list of open source projects">
      <PageSlideFade>
        <div className="flex flex-col items-start gap-3">
          <div className="flex w-full items-center justify-between">
            <Header underlineColor={TURQUOISE} className="mb-0 mt-0">
              Open Source
            </Header>
            <div className="flex items-center gap-2">
              <Tooltip label="Live github repos" placement="top">
                <button
                  type="button"
                  aria-label="live"
                  onClick={() => handleClick('live')}
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-full text-[#0077B5]',
                    activeTab === 'live' && 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <RiSignalTowerLine />
                </button>
              </Tooltip>
              <Tooltip label="Local github repos" placement="top">
                <button
                  type="button"
                  aria-label="offline"
                  onClick={() => handleClick('offline')}
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-full text-[#0077B5]',
                    activeTab === 'offline' && 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <RiWifiOffLine />
                </button>
              </Tooltip>
            </div>
          </div>
          <p className="text-left text-gray-500 dark:text-gray-200">
            This page lists some of the open source repositories I have published or contributed to.
          </p>
        </div>
        {activeTab === 'live' ? <LiveData /> : <OfflineData repositories={repositories} />}
      </PageSlideFade>
    </PageLayout>
  );
};

export function getStaticProps() {
  return {
    props: {
      repositories
    }
  };
}

export default RepositoriesList;
