import * as React from 'react';
import { StoryTimeline } from './story-timeline';
import { FaGraduationCap, FaAward, FaMedal } from 'react-icons/fa';
import { BsFillBriefcaseFill } from 'react-icons/bs';
import Header from '../shared/header';
import Section from '../skills/section';
import { PageSlideFade } from '../shared/animations/page-transitions';

const MyStory = ({ companies, institutes }) => {
  return (
    <div className="flex flex-col">
      <Section className="mb-14">
        <PageSlideFade>
          <div className="flex flex-col items-center">
            <Header className="mb-1 mt-0">Developer Story</Header>
          </div>
        </PageSlideFade>
      </Section>
      <div className="mb-0 flex flex-col items-start text-left">
        <div>
          <StoryTimeline year={'2021'} index={0} />
          {companies.map((company, index) => (
            <StoryTimeline icon={BsFillBriefcaseFill} index={index} key={index}>
              <div className="flex items-center gap-2">
                <img
                  className="h-6 w-6 rounded-full object-cover sm:h-8 sm:w-8"
                  src={company.logo}
                  alt={company.alt}
                  onError={(event) => {
                    event.currentTarget.src = '/assets/images/placeholder.png';
                  }}
                />
                <div className="flex flex-col items-start">
                  <h3 className="text-xs font-bold leading-tight sm:text-[13px] lg:text-[15px]">
                    <div>{company.title}</div>
                    <div className="mt-1">{company.period}</div>
                  </h3>
                </div>
              </div>
              <hr className="my-2 border-gray-200 dark:border-gray-700" />
              <p className="text-xs sm:text-[13px] lg:text-[15px]">{company.role}</p>
            </StoryTimeline>
          ))}
          <StoryTimeline year={'2017'} index={0} />
          {institutes.map((institute, index) => (
            <React.Fragment key={institute.title || index}>
              <StoryTimeline icon={FaGraduationCap} index={index > 0 ? index + 1 : index}>
                <div className="flex items-center gap-2">
                  <img
                    className="h-6 w-6 rounded-full object-cover sm:h-8 sm:w-8"
                    src={institute.logo}
                    alt={institute.alt}
                    onError={(event) => {
                      event.currentTarget.src = '/assets/images/placeholder.png';
                    }}
                  />
                  <div className="flex flex-col items-start">
                    <h3 className="text-xs font-bold leading-tight sm:text-[13px] lg:text-[15px]">
                      <div>{institute.short_title}</div>
                      <div className="mt-1">{institute.period}</div>
                    </h3>
                  </div>
                </div>
                <hr className="my-2 border-gray-200 dark:border-gray-700" />
                <p className="text-xs sm:text-[13px] lg:text-[15px]">{institute.role}</p>
              </StoryTimeline>
              {institute.awards &&
                institute.awards.map((award, index1) => (
                  <StoryTimeline icon={FaAward} index={index1 + index + 1} key={index1}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <FaMedal />
                      </span>
                      <div className="flex flex-col items-start">
                        <h3 className="text-xs font-bold leading-tight sm:text-[13px] lg:text-[15px]">
                          <div>{award.title}</div>
                          <div className="mt-1">{award.date}</div>
                        </h3>
                      </div>
                    </div>
                    <hr className="my-2 border-gray-200 dark:border-gray-700" />
                    <p className="text-xs sm:text-[13px] lg:text-[15px]">{award.description}</p>
                  </StoryTimeline>
                ))}

              <StoryTimeline
                year={institute.startingYear}
                index={0}
                skipTrail={index === institutes.length - 1}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyStory;
