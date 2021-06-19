import * as React from "react";
import { Stack } from "@chakra-ui/react";
import { articles } from "../data/posts/articles";
import PostCard from "../components/blog/card";
import { PageSlideFade, StaggerChildren } from "../components/layout/page-transitions";
import Header from "../components/layout/header";
import { MotionBox } from "../components/layout/motion";

const TURQUOISE = "#06b6d4";

const Posts = ({ articles }) => {
  return (
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
