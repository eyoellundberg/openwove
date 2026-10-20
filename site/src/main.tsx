import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './site.css'
import { Landing } from './landing'

// Pick the theme before the first paint so dark-mode visitors don't see light colors fade out.
document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
