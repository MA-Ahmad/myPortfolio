import { usePostData } from 'lib/usePostData';
import React from 'react';
import { MotionBox, MotionFlex } from './animations/motion';
import { BsHeartFill } from 'react-icons/bs';

const emojis = ['👍', '🙏', '🥰'];

export const LikeButton = ({
  id,
  devToLikes,
  linkColor,
  title
}: {
  id: string;
  devToLikes: number;
  linkColor: string;
  title: string;
}) => {
  const { currentUserLikes, totalPostLikes, isLoading, incrementLikes } = usePostData(id, title);

  return (
    <div className="mb-2 flex items-center gap-2">
      <button
        className="focus:outline-none"
        onClick={() => {
          if (isLoading) return;
          incrementLikes();
        }}
      >
        <div className="relative">
          <div className="absolute w-full text-center text-2xl">
            {emojis.map((item, index) => {
              return (
                <MotionBox
                  key={index}
                  className="absolute w-full"
                  animate={currentUserLikes === index + 1 ? 'show' : 'hide'}
                  variants={{
                    hide: { translateY: -80, opacity: 0 },
                    show: {
                      translateY: [0, -40, -60],
                      opacity: [0, 1, 0]
                    }
                  }}
                  initial="hide"
                >
                  {item}
                </MotionBox>
              );
            })}
          </div>
          <MotionFlex
            className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-[#c9c4c4] shadow-lg dark:bg-[#3c3838]"
            whileHover="hover"
            whileTap="active"
            variants={{
              hover: {
                scale: 1.15
              },
              active: {
                scale: 1.3
              }
            }}
          >
            <MotionBox
              className="absolute h-full w-full bg-gradient-to-t from-yellow-300 to-red-500"
              animate={String(currentUserLikes)}
              variants={{
                '0': { translateY: 32 },
                '1': { translateY: 20 },
                '2': { translateY: 10 },
                '3': { translateY: 0 }
              }}
              initial="0"
            />
            <BsHeartFill className="relative h-5 w-5 text-white" />
          </MotionFlex>
        </div>
      </button>
      <div className="text-lg font-semibold" style={{ color: linkColor }}>
        {isLoading ? (
          <span
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-200 border-t-current"
            style={{ borderTopColor: linkColor }}
          />
        ) : (
          <span>{totalPostLikes + (Number(devToLikes) || 0)}</span>
        )}
      </div>
    </div>
  );
};
