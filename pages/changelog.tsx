import { PageSlideFade, StaggerChildren } from 'components/shared/animations/page-transitions';
import { MotionBox } from 'components/shared/animations/motion';
import Header from 'components/shared/header';
import PageLayout from 'components/layouts/pageLayout';
import { fetchPRsData } from 'lib/githubApi';
import { remark } from 'remark';
import html from 'remark-html';
import { Fragment, useEffect, useState } from 'react';
import ListSkeleton from 'components/changelog/list-skeleton';
import PrList from 'components/changelog/List';

const TURQUOISE = '#06b6d4';
const title = 'Changelog';
const subtitle =
  "The Changelog gives an overview of the meaningful changes I've made to my portfolio website.";

const ChangeLog = () => {
  const { prData } = fetchPRsData();
  const [prDataState, setPrDataState] = useState(null);

  const processPrBody = async () => {
    await prData?.map(async (obj) => {
      if (obj.body) {
        const htmlBody = await remark().use(html).process(obj.body);
        obj['body_html'] = String(htmlBody);
      }
    });
    setPrDataState(prData);
  };

  useEffect(() => {
    processPrBody();
  }, [prData]);

  return (
    <Fragment>
      <PageLayout title={title} description={subtitle}>
        <PageSlideFade>
          <StaggerChildren>
            <MotionBox>
              <div className="flex flex-col items-start">
                <Header underlineColor={TURQUOISE} className="mb-2 mt-0">
                  {title}
                </Header>
                <p className="text-left text-gray-500 dark:text-gray-200">{subtitle}</p>
              </div>
            </MotionBox>
            {prDataState ? <PrList prList={prDataState} /> : <ListSkeleton />}
          </StaggerChildren>
        </PageSlideFade>
      </PageLayout>
    </Fragment>
  );
};

export default ChangeLog;
