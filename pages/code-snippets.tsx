import { MotionBox } from 'components/shared/animations/motion';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RxCross1 } from 'react-icons/rx';
import { BsThreeDots } from 'react-icons/bs';
import { FiEdit } from 'react-icons/fi';

const variants = {
  hidden: { opacity: 0, x: 200, y: 0 },
  enter: { opacity: 1, x: 0, y: 0 },
  exit: { opacity: 0, x: 0, y: -100 }
};

const avatarVariants = {
  hidden: { opacity: 0, x: -200, y: 0 },
  enter: { opacity: 1, x: 0, y: 0 },
  exit: { opacity: 0, x: 0, y: -100 }
};

const skills = [
  {
    bg: '#ffe1de',
    image: '/assets/images/skills/rails.png'
  },
  { bg: '#e1f6fa', image: '/assets/images/skills/react.png' },
  { bg: '#e4f0fa', image: '/assets/images/skills/typescript.png' },
  {
    bg: '#ffe1de',
    image: '/assets/images/skills/ruby.png'
  },
  {
    bg: '#fef9df',
    image: '/assets/images/skills/javascript.png'
  }
];

const CodeSnippets = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showEditSection, setShowEditSection] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <AnimatePresence>
        <MotionBox
          className="w-[345px] overflow-hidden rounded-lg bg-white p-6 shadow-lg"
          initial={{ height: 96 }}
          animate={{ height: showSkills || showEditSection ? 152 : 96 }}
          exit={{ height: 'auto' }}
          transition={{
            duration: 0.5,
            type: 'spring',
            stiffness: 300,
            damping: 20
          }}
        >
          <div className="flex items-center justify-between">
            <motion.div
              initial="hidden"
              animate={isLoaded ? 'enter' : 'hidden'}
              exit="exit"
              variants={avatarVariants}
              transition={{ type: 'tween', ease: 'linear' }}
            >
              <div className="flex items-center gap-2">
                <img
                  className="h-12 w-12 rounded-full object-cover"
                  src="https://avatars2.githubusercontent.com/u/37842853?v=4"
                  alt=""
                />
                <div className="flex flex-col text-left text-xs">
                  <span className="font-medium text-gray-400">Username</span>
                  <span className="font-bold">@MA-Ahmad</span>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial="hidden"
              animate={isLoaded ? 'enter' : 'hidden'}
              exit="exit"
              variants={variants}
              transition={{ type: 'tween', ease: 'linear' }}
            >
              <div className="flex items-center gap-2">
                <motion.div
                  initial={{ opacity: 0, x: 200 }}
                  animate={showOptions ? { opacity: 1, x: 0 } : { opacity: 0, x: 200 }}
                  exit={{ x: 200, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <div className="relative flex items-center justify-center gap-2">
                    <button
                      type="button"
                      aria-label="Delete"
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-base ${
                        showEditSection ? 'bg-blue-100' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => {
                        setShowSkills(false);
                        setShowEditSection(!showEditSection);
                      }}
                    >
                      <FiEdit />
                    </button>
                    <button
                      type="button"
                      className={`cursor-pointer rounded-full px-3 py-2 text-xs font-medium ${
                        showSkills ? 'bg-blue-100' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => {
                        setShowEditSection(false);
                        setShowSkills(!showSkills);
                      }}
                    >
                      Skills
                    </button>
                  </div>
                </motion.div>
                <button
                  type="button"
                  aria-label="action"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base text-gray-600"
                  onClick={() => setShowOptions(!showOptions)}
                >
                  <motion.div animate={{ rotate: showOptions ? [-40, 0] : 0 }}>
                    {showOptions ? <RxCross1 /> : <BsThreeDots />}
                  </motion.div>
                </button>
              </div>
            </motion.div>
          </div>
          {showEditSection && (
            <motion.div
              initial={{ opacity: 0, x: -150 }}
              animate={showEditSection ? { opacity: 1, x: 0 } : { opacity: 0, x: -150 }}
              exit={{ x: -10 }}
              transition={{
                duration: 0.5,
                type: 'spring',
                stiffness: 300,
                damping: 20
              }}
            >
              <div className="mt-4 flex items-center justify-between">
                <input
                  defaultValue="MA-Ahmad"
                  placeholder="MA-Ahmad"
                  className="rounded-md border border-gray-200 px-3 py-2"
                />
                <button
                  type="button"
                  className="h-max cursor-pointer rounded-full bg-gray-100 px-3 py-2 text-xs font-medium hover:bg-gray-200"
                  onClick={() => {
                    setShowEditSection(false);
                    setShowSkills(false);
                  }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
          {showSkills && (
            <motion.div
              initial={{ opacity: 0, x: -150 }}
              animate={showSkills ? { opacity: 1, x: 0 } : { opacity: 0, x: -150 }}
              exit={{ x: -10 }}
              transition={{
                duration: 0.5,
                type: 'spring',
                stiffness: 300,
                damping: 20
              }}
            >
              <div className="mt-4 flex gap-2">
                {skills.map((skill, index) => (
                  <div
                    key={index}
                    className="relative h-10 w-10 overflow-hidden rounded-lg p-2 leading-none shadow-[inset_0_0_1px_1px_rgba(0,0,0,0.015)]"
                    style={{ backgroundColor: skill.bg }}
                  >
                    <img src={skill.image} alt="" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </MotionBox>
      </AnimatePresence>
    </div>
  );
};

export default CodeSnippets;
