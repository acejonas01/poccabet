import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'

// TEMP: keep the splash on screen while designing it — the app doesn't mount.
// Only on the local dev server (never in the deployed build); add ?app to the URL to load the app anyway.
// Remove this block when the splash is done.
const HOLD_SPLASH = import.meta.env.DEV && !new URLSearchParams(location.search).has('app')

if (!HOLD_SPLASH) createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
