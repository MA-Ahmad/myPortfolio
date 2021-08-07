import fs from "fs";
import path from "path";
import matter from "gray-matter";
import html from "remark-html";
import {
  Box,
  Heading,
  VStack,
  Text,
  HStack,
  Flex,
  Tag,
  useColorModeValue
} from "@chakra-ui/react";
import remark from "remark";
import prism from "remark-prism";
import { getTagColor } from "../../components/ui/theme";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import { BlogPost } from "../../interfaces/interface";
import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import PageLayout from "components/layout/pageLayout";
import { MotionImage } from "components/ui/motion";
import DevToCallToAction from "components/layout/DevToCallToAction";
import { fadeInUp, stagger } from "components/ui/page-transitions";
import { motion } from "framer-motion";

dayjs.extend(localizedFormat);

export interface AllBlogProps {
  blogDetails: BlogPost;
  articleContent: string;
}

const ArticlePage: NextPage<AllBlogProps> = ({
  articleContent,
  blogDetails
}) => {
  const textColor = useColorModeValue("gray.500", "gray.200");
  return (
    <PageLayout
      title={blogDetails?.title}
      description={blogDetails?.description}
      image={blogDetails?.cover_image}
    >
      <motion.div initial="initial" animate="animate" variants={stagger}>
        <VStack marginBottom="5" alignItems="left" textAlign="left">
          {blogDetails?.cover_image ? (
            <MotionImage
              src={blogDetails.cover_image}
              variants={fadeInUp}
              layout="fixed"
              rounded="md"
            />
          ) : (
            ""
          )}
          <motion.div variants={fadeInUp}>
            <Heading as="h1" size="lg">
              {blogDetails?.title}
            </Heading>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <HStack
              justifyContent="space-between"
              isInline
              flexDirection={["column", "row", "row"]}
            >
              <HStack spacing={1} alignItems="center">
                {blogDetails?.tags.map(tag => (
                  <Tag
                    size={"md"}
                    padding="0 3px"
                    key={tag}
                    colorScheme={getTagColor(tag)}
                  >
                    {tag}
                  </Tag>
                ))}
              </HStack>
              <HStack spacing={2} isInline pt={["0.5rem", "0", "0"]}>
                {blogDetails?.public_reactions_count ? (
                  <Flex alignItems="center">
                    <Text
                      fontSize="sm"
                      noOfLines={1}
                      fontWeight="400"
                      align="left"
                      color={textColor}
                    >
                      {blogDetails.public_reactions_count}
                    </Text>
                    &nbsp;
                    <svg
                      id="Capa_1"
                      enableBackground="new 0 0 512 512"
                      height="20px"
                      viewBox="0 0 512 512"
                      width="20px"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g>
                        <path
                          d="m445.936 20.657h-379.872c-19.731 0-37.443 8.649-49.548 22.364l-6.403 43.701v239.535c0 36.486 19.465 66.064 55.951 66.064h89.427c6.57 0 12.872 10.817 17.518 15.463l77.704 77.704 16.721 2.268c.95-.664 1.856-1.42 2.704-2.268l77.704-77.704c4.646-4.646 10.948-7.256 17.518-7.256h80.577c36.486 0 66.064-29.578 66.064-66.064v-247.742c-.001-36.487-29.579-66.065-66.065-66.065z"
                          fill="#ff7e92"
                        />
                        <path
                          d="m164.159 407.784 77.704 77.704c6.959 6.959 17.774 7.714 25.57 2.268l-91.595-91.65c-7.685-7.685-18.323-12.093-29.194-12.093h-80.579c-27.323 0-49.548-22.226-49.548-49.548v-291.444c-10.25 11.639-16.517 26.973-16.517 43.701v247.742c0 36.486 29.578 66.065 66.065 66.065h80.577c6.57-.001 12.872 2.609 17.517 7.255z"
                          fill="#ff5f7a"
                        />
                        <path
                          d="m387.626 177.951c-4.003-35.677-34.163-63.99-69.988-66.315-21.701-1.408-41.538 6.405-56.107 19.853-3.135 2.894-7.926 2.894-11.062 0-14.569-13.448-34.406-21.261-56.107-19.853-8.653.562-16.976 2.639-24.679 5.971-24.19 10.461-40.655 60.344-40.655 60.344-8.486 75.632 93.735 136.686 124.126 154.751l21.005-.808c37.878-23.988 121.196-85.05 113.467-153.943z"
                          fill="#fff"
                        />
                        <path
                          d="m142.235 167.09c2.224-19.818 12.594-37.402 27.447-49.483-24.153 10.475-42.275 33.311-45.309 60.344-8.485 75.632 92.757 141.829 123.148 159.894 5.245 3.117 11.712 3.117 16.957 0 2.702-1.606 5.985-3.61 9.68-5.95-19.374-10.919-141.105-82.962-131.923-164.805z"
                          fill="#ffdbde"
                        />
                      </g>
                    </svg>
                  </Flex>
                ) : (
                  ""
                )}
                {blogDetails?.comments_count ? (
                  <Flex alignItems="center">
                    <Text
                      fontSize="sm"
                      noOfLines={1}
                      fontWeight="400"
                      align="left"
                      color={textColor}
                    >
                      {blogDetails.comments_count}
                    </Text>
                    &nbsp;
                    <svg
                      id="Capa_1"
                      enableBackground="new 0 0 512 512"
                      height="20px"
                      viewBox="0 0 512 512"
                      width="20px"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="m438.983 11.549h-276.72c-36.094 0-65.625 29.531-65.625 65.625v22.33h250.317c36.094 0 65.625 29.531 65.625 65.625v163.609h26.404c36.094 0 65.625-29.531 65.625-65.625v-185.939c0-36.094-29.532-65.625-65.626-65.625z"
                        fill="#6c7ed6"
                      />
                      <path
                        d="m392.454 96.504h-276.72c-6.636 0-13.047 1.006-19.096 2.86v.14h250.317c36.094 0 65.625 29.531 65.625 65.625v163.609h26.404c6.636 0 13.047-1.006 19.096-2.86v-163.748c0-36.094-29.532-65.626-65.626-65.626z"
                        fill="#4f67d2"
                      />
                      <path
                        d="m349.954 96.504h-276.72c-36.094 0-65.625 29.531-65.625 65.625v185.939c0 36.094 29.531 65.625 65.625 65.625h166.083c7.12 0 12.435 6.626 10.807 13.557-4.404 18.751-11.144 38.581-21.107 58.908-4.474 9.129 5.704 18.41 14.349 13.06 24.997-15.47 60.562-41.362 90.512-77.964 3.937-4.811 9.858-7.561 16.075-7.561 36.094 0 65.625-29.531 65.625-65.625v-185.938c.002-36.094-29.53-65.626-65.624-65.626z"
                        fill="#60b8fe"
                      />
                      <path
                        d="m292.624 427.25c1.628-6.932-3.687-13.557-10.807-13.557h-42.5c7.12 0 12.435 6.625 10.807 13.557-4.404 18.751-11.144 38.581-21.107 58.908-4.474 9.129 5.704 18.41 14.349 13.06 9.591-5.936 20.74-13.411 32.527-22.431 7.603-17.049 13.007-33.679 16.731-49.537z"
                        fill="#23a8fe"
                      />
                      <path
                        d="m50.109 348.068v-185.938c0-36.094 29.531-65.625 65.625-65.625h-42.5c-36.094 0-65.625 29.531-65.625 65.625v185.938c0 36.094 29.531 65.625 65.625 65.625h42.5c-36.094 0-65.625-29.531-65.625-65.625z"
                        fill="#23a8fe"
                      />
                      <g fill="#dfebfa">
                        <circle cx="98.577" cy="260.439" r="21.777" />
                        <circle cx="168.914" cy="260.439" r="21.777" />
                        <circle cx="239.251" cy="260.439" r="21.777" />
                        <circle cx="309.588" cy="260.439" r="21.777" />
                      </g>
                      <path
                        d="m98.577 260.439c0-8.059 4.381-15.091 10.888-18.856-3.204-1.854-6.92-2.921-10.888-2.921-12.027 0-21.777 9.75-21.777 21.777s9.75 21.777 21.777 21.777c3.968 0 7.685-1.066 10.888-2.92-6.507-3.767-10.888-10.798-10.888-18.857z"
                        fill="#b1dbfc"
                      />
                      <path
                        d="m168.914 260.439c0-8.059 4.381-15.091 10.888-18.856-3.204-1.854-6.92-2.921-10.888-2.921-12.027 0-21.777 9.75-21.777 21.777s9.75 21.777 21.777 21.777c3.968 0 7.685-1.066 10.888-2.92-6.507-3.767-10.888-10.798-10.888-18.857z"
                        fill="#b1dbfc"
                      />
                      <path
                        d="m239.251 260.439c0-8.059 4.381-15.091 10.888-18.856-3.204-1.854-6.921-2.921-10.888-2.921-12.027 0-21.777 9.75-21.777 21.777s9.75 21.777 21.777 21.777c3.968 0 7.685-1.066 10.888-2.92-6.507-3.767-10.888-10.798-10.888-18.857z"
                        fill="#b1dbfc"
                      />
                      <path
                        d="m309.588 260.439c0-8.059 4.381-15.091 10.888-18.856-3.204-1.854-6.921-2.921-10.888-2.921-12.027 0-21.777 9.75-21.777 21.777s9.75 21.777 21.777 21.777c3.968 0 7.685-1.066 10.888-2.92-6.507-3.767-10.888-10.798-10.888-18.857z"
                        fill="#b1dbfc"
                      />
                      <path d="m69.191 260.253c0 16.144 13.134 29.277 29.276 29.277 16.144 0 29.277-13.133 29.277-29.277 0-16.143-13.134-29.276-29.277-29.276-16.142 0-29.276 13.133-29.276 29.276zm43.554 0c0 7.872-6.405 14.277-14.277 14.277s-14.276-6.405-14.276-14.277 6.404-14.276 14.276-14.276 14.277 6.404 14.277 14.276z" />
                      <path d="m198.082 260.253c0-16.143-13.134-29.276-29.277-29.276s-29.276 13.133-29.276 29.276c0 16.144 13.134 29.277 29.276 29.277 16.143 0 29.277-13.133 29.277-29.277zm-43.554 0c0-7.872 6.404-14.276 14.276-14.276s14.277 6.404 14.277 14.276-6.405 14.277-14.277 14.277-14.276-6.405-14.276-14.277z" />
                      <path d="m268.419 260.253c0-16.143-13.134-29.276-29.277-29.276s-29.276 13.133-29.276 29.276c0 16.144 13.134 29.277 29.276 29.277 16.143 0 29.277-13.133 29.277-29.277zm-43.554 0c0-7.872 6.404-14.276 14.276-14.276s14.277 6.404 14.277 14.276-6.405 14.277-14.277 14.277-14.276-6.405-14.276-14.277z" />
                      <path d="m338.756 260.253c0-16.143-13.134-29.276-29.277-29.276s-29.276 13.133-29.276 29.276c0 16.144 13.134 29.277 29.276 29.277 16.143 0 29.277-13.133 29.277-29.277zm-43.554 0c0-7.872 6.404-14.276 14.276-14.276s14.277 6.404 14.277 14.276-6.405 14.277-14.277 14.277-14.276-6.405-14.276-14.277z" />
                      <path d="m438.874 3.863h-276.72c-40.321 0-73.126 32.804-73.126 73.125v11.83h-15.903c-40.321.001-73.125 32.805-73.125 73.126v185.938c0 40.322 32.804 73.125 73.125 73.125h78.18c4.143 0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5h-78.18c-32.05 0-58.125-26.075-58.125-58.125v-185.938c0-32.05 26.075-58.125 58.125-58.125h276.721c32.05 0 58.125 26.075 58.125 58.125v185.938c0 32.05-26.075 58.125-58.125 58.125-8.543 0-16.518 3.758-21.881 10.312-29.417 35.95-64.447 61.355-88.653 76.336-2.257 1.393-4.855-.96-3.669-3.382 9.512-19.408 16.805-39.761 21.675-60.494 2.728-11.618-6.129-22.772-18.109-22.772h-52.903c-4.143 0-7.5 3.358-7.5 7.5s3.357 7.5 7.5 7.5h52.903c2.301 0 4.027 2.128 3.506 4.342-4.612 19.638-11.523 38.924-20.541 57.323-7.776 15.872 10.025 32.025 25.032 22.738 25.178-15.583 61.642-42.04 92.368-79.591 2.503-3.058 6.247-4.812 10.272-4.812 40.321 0 73.125-32.804 73.125-73.125v-11.83h15.903c40.322 0 73.126-32.804 73.126-73.125v-75.469c0-4.142-3.357-7.5-7.5-7.5s-7.5 3.358-7.5 7.5v75.469c0 32.05-26.075 58.125-58.126 58.125h-15.903v-159.108c0-40.321-32.804-73.125-73.125-73.125h-245.818v-11.83c0-32.05 26.075-58.125 58.126-58.125h276.72c32.051 0 58.126 26.075 58.126 58.125v75.469c0 4.142 3.357 7.5 7.5 7.5s7.5-3.358 7.5-7.5v-75.469c0-40.322-32.804-73.126-73.126-73.126z" />
                    </svg>
                  </Flex>
                ) : (
                  ""
                )}
              </HStack>
            </HStack>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <HStack
              spacing={2}
              alignItems="left"
              justifyContent={["center", "left", "left"]}
            >
              <Text fontSize="xs">Published on</Text>
              <Text fontSize="xs" fontWeight="bold">
                {dayjs(blogDetails?.published_at).format("LL")}
              </Text>
            </HStack>
          </motion.div>
        </VStack>
        <motion.div variants={fadeInUp}>
          <Box className="article">
            <div dangerouslySetInnerHTML={{ __html: articleContent }} />
          </Box>
        </motion.div>
        {blogDetails?.url ? (
          <DevToCallToAction
            href={blogDetails.url}
          />
        ) : (
          ""
        )}
      </motion.div>
    </PageLayout>
  );
};

// export async function markdownToHtml(markdown) {
//   const result = await remark()
//     .use(html)
//     .use(prism)
//     .process(markdown);
//   return result.toString();
// }

// const root = process.cwd();

// export async function getStaticPaths() {
//   return {
//     fallback: false,
//     paths: fs.readdirSync(path.join(root, "data", "posts")).map(p => ({
//       params: {
//         slug: p.replace(/\.mdx/, "")
//       }
//     }))
//   };
// }

// export async function getStaticProps({ params: { slug } }) {
//   const markdownWithMeta = fs.readFileSync(
//     path.join(root, "data", "posts", `${slug}.mdx`),
//     "utf-8"
//   );

//   const { data: frontmatter, content } = matter(markdownWithMeta);

//   const remarkContent = await markdownToHtml(content);

//   return {
//     props: {
//       frontmatter,
//       slug,
//       remarkContent
//     }
//   };
// }

const getAllBlogs = async () => {
  const res = await fetch("https://dev.to/api/articles?username=m_ahmad");

  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `Error fetching... Status code: ${res.status}, ${res.statusText}`
    );
  }
  const data = await res.json();
  return data;
};

const root = process.cwd();
export const getStaticPaths: GetStaticPaths = async () => {
  let devData: BlogPost[] = await getAllBlogs();
  devData = devData.filter(data => data.canonical_url.includes("dev.to"));
  const devtoPaths = devData.map(data => ({
    params: { slug: data?.slug }
  }));

  const localPaths = fs
    .readdirSync(path.join(root, "data", "posts"))
    .map(p => ({
      params: {
        slug: p.replace(/\.mdx/, "")
      }
    }));

  return {
    paths: [...devtoPaths, ...localPaths],
    fallback: true
  };
};

const markdownToHtml = async (markdown: string) => {
  const result = await remark()
    .use(html)
    .use(prism)
    .process(markdown);
  return result.toString();
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const devData: BlogPost[] = await getAllBlogs();

  const selectedBlog = devData.filter(
    data => data?.slug === params?.slug && data.canonical_url.includes("dev.to")
  );
  let blogObj = null,
    remarkContent = null;

  if (selectedBlog.length) {
    const res = await fetch(
      `https://dev.to/api/articles/${selectedBlog[0]?.id}`
    );
    blogObj = await res.json();
    remarkContent = await markdownToHtml(blogObj.body_markdown);
  } else {
    const markdownWithMeta = fs.readFileSync(
      path.join(root, "data", "posts", `${params?.slug}.mdx`),
      "utf-8"
    );
    const { data: frontmatter, content } = matter(markdownWithMeta);
    const devtoPost = devData.filter(
      data =>
        !data.canonical_url.includes("dev.to") &&
        data.canonical_url.split("/blog/")[1] === params?.slug
    )[0];
    if (devtoPost) {
      frontmatter["comments_count"] = devtoPost?.comments_count;
      frontmatter["public_reactions_count"] = devtoPost?.public_reactions_count;
      frontmatter["url"] = devtoPost?.url;
    }
    blogObj = frontmatter;
    remarkContent = await markdownToHtml(content);
  }

  if (!devData) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      articleContent: remarkContent,
      blogDetails: blogObj
    },
    revalidate: 1
  };
};

export default ArticlePage;
