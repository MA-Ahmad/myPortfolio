import * as React from 'react';
import NextLink from 'next/link';
import { CardTransition } from 'components/shared/animations/page-transitions';
import { MotionBox } from 'components/shared/animations/motion';
import moment from 'moment';
import { Tag } from 'components/shared/Tags';
import { AiFillCheckCircle } from 'react-icons/ai';
import { GoIssueReopened } from 'react-icons/go';
import ReactHtmlParser from 'react-html-parser';
import { motion, AnimatePresence } from 'framer-motion';
import { useLinkColor } from 'components/theme';

const PrList = ({ prList }) => {
  const linkColor = useLinkColor();

  return (
    <AnimatePresence>
      <ul>
        {prList?.map((pr, index) => (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: (i) => ({
                opacity: 0,
                y: -30 * i
              }),
              visible: (i) => ({
                opacity: 1,
                y: 0,
                transition: {
                  delay: i * 0.1
                }
              })
            }}
            custom={index}
            key={pr.html_url}
          >
            <div className="mt-8 flex flex-col items-start gap-4 lg:mx-6">
              <li>
                <MotionBox whileHover={{ x: 10 }} className="text-left">
                  <CardTransition>
                    <h3 className="mb-1 mt-0 text-left text-lg font-semibold">
                      {pr.state === 'closed' && pr.merged_at ? (
                        <AiFillCheckCircle className="mr-2 inline text-green-500" />
                      ) : (
                        <GoIssueReopened className="mr-2 inline text-gray-500" />
                      )}
                      <NextLink
                        href={pr.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: linkColor }}>

                        {pr.title}

                      </NextLink>
                    </h3>
                    <div className="flex items-center gap-2 lg:ml-6">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-200">
                        {moment(pr.created_at).format('Do MMMM YYYY')}
                      </span>
                      <div className="hidden items-center gap-1 lg:flex">
                        <div className="-m-0.5 flex flex-wrap items-center">
                          {pr.labels.map((label) => (
                            <Tag key={label.name} name={label.name} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="article ml-6 mt-2">
                      {pr.body && <ul>{ReactHtmlParser(pr.body_html)}</ul>}
                    </div>
                  </CardTransition>
                </MotionBox>
              </li>
              {prList.length - 1 !== index && <hr className="w-full border-gray-200 dark:border-gray-700" />}
            </div>
          </motion.div>
        ))}
      </ul>
    </AnimatePresence>
  );
};

export default PrList;
