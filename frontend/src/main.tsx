import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// one shared cache for server data, any page can read tasks without fetching again
const queryClient = new QueryClient()

// draw the app inside <div id="root"> from index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* QueryClientProvider shares the cache, BrowserRouter reads the url for the pages */}
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
