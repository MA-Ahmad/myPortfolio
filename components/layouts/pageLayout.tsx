import React, { Fragment, ReactNode } from 'react'
import { motion } from 'framer-motion'
import Meta from '../shared/meta'

type Props = {
  children: ReactNode
  title: string
  description?: string
  keywords?: string
  image?: string
  imageAlt?: string
  canonical?: string
  animate?: boolean
}

const variants = {
  hidden: { opacity: 0, x: -200, y: 0 },
  enter: { opacity: 1, x: 0, y: 0 },
  exit: { opacity: 0, x: 0, y: -100 },
}

const PageLayout = ({
  children,
  title,
  description,
  keywords,
  image,
  imageAlt,
  canonical,
  animate = true,
}: Props): JSX.Element => (
  <Fragment>
    <Meta
      title={title}
      description={description}
      keywords={keywords}
      image={image}
      imageAlt={imageAlt}
      canonical={canonical}
    />
    {animate ? (
      <motion.main
        initial="hidden"
        animate="enter"
        exit="exit"
        variants={variants}
        transition={{ type: 'tween', ease: 'linear' }}
      >
        {children}
      </motion.main>
    ) : (
      <main>{children}</main>
    )}
  </Fragment>
)

export default PageLayout
