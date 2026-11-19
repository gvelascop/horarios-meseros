import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Auth from './Auth.jsx'
import ErrorPantalla from './ErrorPantalla.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorPantalla><Auth><App /></Auth></ErrorPantalla>
  </StrictMode>,
)
