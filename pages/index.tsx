import Home from 'components/home-page/home'
import { GetStaticProps, NextPage } from 'next'
import { BlogPostProps } from 'interfaces/interface'
import PageLayout from 'components/layouts/pageLayout'
import { getDevtoPosts } from 'lib/fetchPosts'

const Index: NextPage<BlogPostProps> = (props) => {
  const { posts } = props
  return (
    <PageLayout title="Muhammad Mustafa Ali - Full Stack Developer">
      <Home posts={posts} />
    </PageLayout>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const posts = await getDevtoPosts()

  if (!posts) {
    return {
      notFound: true,
    }
  }

  return {
    props: { posts },
    revalidate: 1,
  }
}

export default Index
