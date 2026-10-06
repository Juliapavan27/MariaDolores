import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

const root = document.getElementById('root')!
root.dataset.montado = '1'
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
