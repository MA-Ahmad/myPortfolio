import { NextPage } from 'next'
import OnePageHome from 'components/home-page/one-page-home'
import Meta from 'components/shared/meta'

const Index: NextPage = () => {
  return (
    <>
      <Meta
        title="Muhammad Ahmad - Senior Software Engineer"
        description="Senior software engineer from Pakistan. Full-stack developer specializing in Ruby on Rails and React, passionate about open-source."
        keywords="Muhammad Ahmad, Software Engineer, Full Stack Developer, Ruby on Rails, React, Pakistan"
      />
      <OnePageHome />
    </>
  )
}

export default Index
