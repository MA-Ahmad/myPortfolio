import React from 'react';
import { usePalette } from 'react-palette';
import { MotionBox } from '../shared/animations/motion';
import { item } from '../shared/animations/page-transitions';
import { useLinkColor } from 'components/theme';

const SkillCard = ({ name, image, description }) => {
  const linkColor = useLinkColor();
  const { data, loading } = usePalette(image);

  return (
    <MotionBox variants={item}>
      <MotionBox whileHover={{ y: -5 }}>
        <div className="flex w-full items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 text-left hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
          <div className="relative overflow-hidden rounded-lg p-2 leading-none shadow-[inset_0_0_1px_1px_rgba(0,0,0,0.015)]">
            <div
              className="absolute inset-0 opacity-25"
              style={{ backgroundColor: data.lightVibrant }}
            />
            {loading ? (
              <div className="h-[26px] w-[26px] animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
            ) : (
              <img src={image} height={26} width={26} alt="" className="rounded-md" />
            )}
          </div>
          <div className="flex h-full max-w-lg flex-col items-start justify-start gap-1">
            <div className="flex flex-grow flex-col items-start gap-0">
              <p className="line-clamp-2 text-base font-bold" style={{ color: linkColor }}>
                {name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-200">{description}</p>
            </div>
          </div>
        </div>
      </MotionBox>
    </MotionBox>
  );
};

export default SkillCard;
