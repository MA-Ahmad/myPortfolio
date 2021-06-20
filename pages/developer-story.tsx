import MyStory from "../components/developer-story/story";
import { companies, institutes } from "../data/data";

const Index = ({ companies, institutes }) => {
  return (
      <MyStory companies={companies} institutes={institutes} />
  );
};

export function getStaticProps() {
    return {
      props: {
        companies, institutes
      },
    };
  }

export default Index;
