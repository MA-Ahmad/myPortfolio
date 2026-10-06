import React, { useEffect, useState } from 'react';
import { MotionBox, MotionFlex } from 'components/shared/animations/motion';
import Header from 'components/shared/header';
import NextLink from 'next/link';
import { useLinkColor } from 'components/theme';
import PopularArticles from './PopularArticles';
import { BlogPostProps } from 'interfaces/interface';
import { newContent } from 'data/data';

const ANIMATION_DURATION = 0.5;
const ORANGE = '#ff9400';
const emojis = ['👋', '👍', '🖐'];

const Home: React.FC<BlogPostProps> = (props) => {
  const { posts } = props;
  const linkColor = useLinkColor();
  const [showEmogi, setShowEmoji] = useState(false);
  const [emojiCounter, setEmojiCounter] = useState(-1);

  useEffect(() => {
    const interval = setInterval(() => {
      if (emojiCounter >= 3) setEmojiCounter(0);
    }, 500);
    return () => clearInterval(interval);
  }, [emojiCounter]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col lg:flex-row">
        <MotionBox
          className="mx-auto mb-16 lg:mb-auto"
          initial={{
            translateX: -150,
            opacity: 0
          }}
          animate={{
            translateX: 0,
            opacity: 1,
            transition: {
              duration: ANIMATION_DURATION
            }
          }}
        >
          <MotionBox whileHover={{ scale: 1.2 }} className="rounded-full shadow-lg">
            <img
              className="h-32 w-32 rounded-full border-2 object-cover"
              style={{ borderColor: linkColor }}
              src="https://avatars2.githubusercontent.com/u/37842853?v=4"
              alt=""
            />
          </MotionBox>
        </MotionBox>
        <MotionFlex
          className="relative mx-auto w-[90%] max-w-[800px] flex-col justify-center sm:w-[85%] lg:ml-16 lg:w-[80%]"
          initial={{
            opacity: 0,
            translateX: 150
          }}
          animate={{
            opacity: 1,
            translateX: 0,
            transition: {
              duration: ANIMATION_DURATION
            }
          }}
        >
          <div className="relative">
            <div className="absolute w-full text-center text-2xl">
              {emojis.map((item, index) => {
                return (
                  <MotionBox
                    key={index}
                    className="absolute right-[80%]"
                    animate={showEmogi && emojiCounter === index ? 'show' : 'hide'}
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
            <MotionBox
              whileHover={{ translateY: -5 }}
              className="w-max cursor-pointer"
              onClick={() => {
                setEmojiCounter((prevCounter) => prevCounter + 1);
                setShowEmoji(true);
              }}
            >
              <Header underlineColor={ORANGE} emoji="👋" className="mt-0 w-max">
                Hey!
              </Header>
            </MotionBox>
          </div>
          <h2 className="text-left text-2xl font-normal">
            My name is <strong className="font-semibold">Ahmad</strong> and I&apos;m a{' '}
            <span className="whitespace-nowrap">Full Stack Developer and</span>{' '}
            <span className="whitespace-nowrap">an open source lover&nbsp;</span>
            from <span className="whitespace-nowrap">Pakistan 🇵🇰</span>
          </h2>
          <h2 className="mt-5 text-left text-2xl font-normal">
            This is my digital garden, where I write about the things I&apos;m working on and share
            what I&apos;ve learned. 😊
          </h2>
        </MotionFlex>
      </div>

      <MotionBox
        className="z-[1] w-full"
        initial={{
          translateY: 80,
          opacity: 0
        }}
        animate={{
          translateY: 0,
          opacity: 1,
          transition: {
            delay: ANIMATION_DURATION - 0.1,
            duration: ANIMATION_DURATION
          }
        }}
      >
        <div className="mt-10">
          <ContentBox linkColor={linkColor} />
          <PopularArticles posts={posts} />
        </div>
      </MotionBox>
    </div>
  );
};

const ContentBox = ({ linkColor }) => {
  return (
    <div
      className="mb-10 flex flex-col items-start rounded-sm bg-gray-100 p-4 text-base hover:shadow-lg dark:bg-[#1e2533] lg:mx-10"
      style={{ borderLeft: `4px solid ${linkColor}` }}
    >
      <p className="text-center text-base font-bold text-[#53c8c4] sm:text-lg">Content:</p>
      <ul className="m-0 pl-5 text-left">
        {newContent.map((content, index) => (
          <li key={index}>
            <NextLink href={content.link} style={{ color: linkColor }}>

              {content.text}
              {content.showNewTag && (
                <span className="ml-1 rounded bg-green-100 px-1 text-xs text-green-800">New</span>
              )}

            </NextLink>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Home;
