import { useLinkColor } from 'components/theme';

interface DisplayTextProps {
  isLoading: boolean;
  value: number;
}

const DisplayText = ({ isLoading, value }: DisplayTextProps) => {
  const linkColor = useLinkColor();

  return (
    <>
      {isLoading ? (
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-200 border-t-current"
          style={{ borderTopColor: linkColor }}
        />
      ) : (
        <span className="truncate text-left text-sm font-normal text-gray-500 dark:text-gray-200">
          {value}
        </span>
      )}
    </>
  );
};

export default DisplayText;
