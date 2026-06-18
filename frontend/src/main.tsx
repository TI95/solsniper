import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './app/app'
import { Provider } from 'react-redux'
import { store } from './store'
import { setStore } from './api/axiosInstance'

// Wire the redux store into the axios instance so the request interceptor can
// attach the access token (auth state lives in memory, not localStorage).
setStore(store)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <App />
      </Provider>
    </BrowserRouter>
  </StrictMode>,
)
