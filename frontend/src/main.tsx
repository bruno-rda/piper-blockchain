import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { client } from '@/client/client.gen';
import './index.css';
import App from './App.tsx';

// Configure the API client base URL
client.setConfig({
  baseUrl: import.meta.env.VITE_API_URL,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
