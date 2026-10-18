import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { App } from './App';
import './styles/tokens.css';

// A data router (not <BrowserRouter>) so pages can block navigation with useBlocker.
// App keeps its own <Routes>; this single splat route just hosts it.
const router = createBrowserRouter([{ path: '*', Component: App }]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
