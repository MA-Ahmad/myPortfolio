import { Fragment } from 'react';
import { Stack } from "@chakra-ui/react";
import { articles } from "../../data/posts/articles";
import PostCard from "../../components/blog/card";
import { PageSlideFade, StaggerChildren } from "../../components/ui/page-transitions";
import Header from "../../components/layout/header";
import { MotionBox } from "../../components/ui/motion";
import Meta from '../../components/layout/meta';

const TURQUOISE = "#06b6d4";

const Posts = ({ articles }) => {
  return (
    <Fragment>
      <Meta title='Blog' description='A list of all articles and posts!' />
      <PageSlideFade>
        <Header underlineColor={TURQUOISE} mt={0} mb={0}>
          Featured Articles
      </Header>
        <StaggerChildren>
          <Stack spacing={4} mt={12}>
            {articles.map((article, index) => (
              <MotionBox whileHover={{ y: -5 }} key={index}>
                <PostCard article={article} />
              </MotionBox>
            ))}
          </Stack>
        </StaggerChildren>
      </PageSlideFade>
    </Fragment>
  );
};

export function getStaticProps() {
  return {
    props: {
      articles
    },
  };
}

export default Posts;
