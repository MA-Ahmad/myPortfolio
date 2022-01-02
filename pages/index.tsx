import Home from "components/home-page/home";
import { GetStaticProps, NextPage } from "next";
import { Props } from "interfaces/interface";
import PageLayout from "components/layout/pageLayout";

const Index: NextPage<Props> = props => {
    const { posts } = props;
    console.log(posts);
  return (
    <PageLayout title="Muhammad Ahmad - Full Stack Developer">
      <Home posts={posts} />
    </PageLayout>
  );
}

const getPosts = async () => {
  const res = await fetch("https://dev.to/api/articles?username=m_ahmad");
  const posts = await res.json();

  return posts;
};

export const getStaticProps: GetStaticProps = async () => {
  const posts = await getPosts();

  if (!posts) {
    return {
      notFound: true
    };
  }

  return {
    props: { posts },
    revalidate: 1
  };
};

export default Index;
