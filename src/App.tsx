import { Route, Routes } from 'react-router-dom'
import { Experience } from './three/Experience'
import { Hud } from './ui/Hud'
import { Intro } from './ui/Intro'
import { Scrubber } from './ui/Scrubber'
import { Projects } from './ui/pages/Projects'
import { ProjectPage } from './ui/pages/ProjectPage'
import { Videography } from './ui/pages/Videography'
import { About } from './ui/pages/About'

/**
 * The canvas lives outside <Routes> on purpose: routes swap the DOM panel over
 * the top while the same WebGL scene keeps running and the camera eases to that
 * page's framing. Nothing is ever torn down and rebuilt.
 */
export default function App() {
  return (
    <>
      <Experience />
      <Hud />
      <Scrubber />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:slug" element={<ProjectPage />} />
        <Route path="/videography" element={<Videography />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={null} />
      </Routes>
      <Intro />
    </>
  )
}
