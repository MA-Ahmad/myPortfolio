import { Fragment } from 'react';
import Home from 'components/home-page/home';
import { projectsList } from "data/projects-list";
import Meta from 'components/layout/meta';

export default function Index({ projects }) {
  return (
    <Fragment>
      <Meta title='Muhammad Ahmad - Full Stack Developer' />
      <Home projects={projects} />
    </Fragment>
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
