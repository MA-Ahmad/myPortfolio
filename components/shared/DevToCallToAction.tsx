import { FaDev } from 'react-icons/fa';

interface IProps {
  href: string;
}

const DevToCallToAction = ({ href }: IProps): JSX.Element => (
  <div className="mt-7 flex justify-center">
    <div>
      <p className="mb-2 text-2xl font-normal">React, comment and follow on</p>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <FaDev className="h-12 w-12" />
      </a>
    </div>
  </div>
);

export default DevToCallToAction;
