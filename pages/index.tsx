import Home from '../components/home-page/home';
import { projectsList } from "../data/projects-list";

export default function Index({ projects }) {
  return (
    <Home projects={projects} />
  )
}

export function getStaticProps() {
  const projects = projectsList;
  return {
    props: {
      projects
    },
  };
}
