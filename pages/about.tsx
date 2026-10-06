import { FaGraduationCap } from 'react-icons/fa';
import { BsFillBriefcaseFill } from 'react-icons/bs';
import {
  PageSlideFade,
  StaggerChildren,
  CardTransition
} from 'components/shared/animations/page-transitions';
import { MotionBox } from 'components/shared/animations/motion';
import { companies, institutes } from 'data/data';
import Header from 'components/shared/header';
import PageLayout from 'components/layouts/pageLayout';
import { Tags } from 'components/shared/Tags';

interface CardProps {
  title: string;
  role: string;
  skills: string[];
  period: string;
  logo: string;
  alt?: string;
}

const TURQUOISE = '#06b6d4';

const Card = (props: CardProps) => {
  const { title, role, skills, period, logo, alt } = props;
  return (
    <CardTransition className="w-full">
      <div className="relative w-full rounded-md border border-gray-100 bg-white px-4 py-5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <div className="flex w-full justify-between">
          <div className="flex">
            <img
              className="h-16 w-16 rounded-full object-cover"
              src={logo}
              alt={alt}
              onError={(event) => {
                event.currentTarget.src = '/assets/images/placeholder.png';
              }}
            />
            <div className="flex flex-col items-start gap-2 pl-3">
              <h3 className="text-left text-xl font-semibold">{title}</h3>
              <h4 className="text-left text-sm font-semibold text-gray-500 dark:text-gray-300">{role}</h4>
              <div className="mt-3 hidden items-center gap-1 lg:flex">
                <Tags tags={skills} interactive={false} />
              </div>
            </div>
          </div>
          <div className="hidden lg:flex">
            <p className="text-sm text-gray-500 dark:text-gray-300">{period}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1 lg:hidden">
          <Tags tags={skills} interactive={false} />
        </div>
      </div>
    </CardTransition>
  );
};

const About = ({ companies, institutes }) => {
  return (
    <PageLayout title="About" description="My educational and professional journey so far">
      <PageSlideFade>
        <StaggerChildren>
          <MotionBox>
            <div className="flex items-center">
              <Header underlineColor={TURQUOISE} className="mb-0 mt-0">
                Career
              </Header>
              <div className="pl-3">
                <BsFillBriefcaseFill size="25px" />
              </div>
            </div>
          </MotionBox>
          <div className="mb-6 mt-12 flex w-full flex-col gap-4 lg:mx-6">
            {companies.map((company, index) => (
              <MotionBox whileHover={{ y: -5 }} key={index} className="w-full">
                <Card
                  title={company.title}
                  role={company.role}
                  skills={company.skills}
                  period={company.period}
                  logo={company.logo}
                />
              </MotionBox>
            ))}
          </div>
          <div className="flex items-center">
            <Header underlineColor={TURQUOISE} className="mb-0 mt-0">
              Education
            </Header>
            <div className="pl-3">
              <FaGraduationCap size="25px" />
            </div>
          </div>
          <div className="mb-6 mt-12 flex w-full flex-col gap-4 lg:mx-6">
            {institutes.map((institute, index) => (
              <MotionBox whileHover={{ y: -5 }} key={index} className="w-full">
                <Card
                  title={institute.title}
                  role={institute.role}
                  skills={institute.skills}
                  period={institute.period}
                  logo={institute.logo}
                />
              </MotionBox>
            ))}
          </div>
        </StaggerChildren>
      </PageSlideFade>
    </PageLayout>
  );
};

export function getStaticProps() {
  return {
    props: {
      companies,
      institutes
    }
  };
}

export default About;
