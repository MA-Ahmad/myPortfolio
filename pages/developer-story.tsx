import * as React from 'react'
import MyStory from 'components/developer-story/story'
import { companies, institutes } from 'data/data'
import Meta from 'components/shared/meta'

const Index = ({ companies, institutes }) => {
  return (
    <React.Fragment>
      <Meta title="Open-source" keywords="My professional journey" />
      <MyStory companies={companies} institutes={institutes} />
    </React.Fragment>
  )
}

export function getStaticProps() {
  return {
    props: {
      companies,
      institutes,
    },
  }
}

export default Index
