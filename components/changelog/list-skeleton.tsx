import * as React from 'react';

const ListSkeleton = () => {
  const list: number[] = [1, 2, 3, 4, 5];

  return (
    <>
      {list.map((id) => {
        return (
          <div className="mt-8 flex flex-col items-start gap-4 lg:mx-6" key={id}>
            <div className="flex justify-between px-2 py-2 sm:px-3">
              <div className="w-full">
                <div className="flex justify-between">
                  <div className="h-3.5 w-[55%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="mt-2 flex flex-col items-start">
                  <div className="h-2 w-[35%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="ml-7 mt-2 flex flex-col items-start gap-2">
                  <div className="h-2 w-[40%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-2 w-[40%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-2 w-[40%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
            <hr className="w-full border-gray-200 dark:border-gray-700" />
          </div>
        );
      })}
    </>
  );
};

export default ListSkeleton;
