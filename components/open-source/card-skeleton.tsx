import * as React from 'react';

const CardSkeleton = () => {
  const cards: number[] = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <>
      {cards.map((id) => {
        return (
          <div key={id} className="rounded-xl border border-gray-100 bg-white py-2 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex justify-between px-2 py-2 sm:px-3">
              <div className="w-full">
                <div className="flex justify-between">
                  <div className="h-3.5 w-[40%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3.5 w-[20%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="mt-2 flex flex-col items-start">
                  <div className="h-2 w-[30%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="mt-2">
                  <div className="h-2 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mt-1 flex items-center">
                    <div className="h-2 w-[80%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

export default CardSkeleton;
