import ProjectCard from './card'
import Header from '../shared/header'
import { MotionBox } from '../shared/animations/motion'

interface ProjectsProps {
  projects: project[]
}

const ORANGE = '#ff9400'

const Projects: React.FC<ProjectsProps> = ({ projects }) => {
  return (
    <div className="flex flex-col items-start gap-8">
      <Header underlineColor={ORANGE} className="mb-0 mt-0">
        Projects
      </Header>
      <div className="mt-5 grid w-full grid-cols-1 gap-4">
        {projects.map((project, index) => (
          <MotionBox whileHover={{ y: -5 }} key={index}>
            <ProjectCard
              title={project.title}
              description={project.desc}
              blurHash={project.blurHash}
              logo={project.logo}
              link={project.link}
              technologies={project.technologies}
            />
          </MotionBox>
        ))}
      </div>
    </div>
  )
}

export default Projects
