import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: unknown) => {
        const msg = error instanceof Error ? error.message : '操作失败';
        if (msg.includes('timeout') || msg.includes('超时')) {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'warning', message: '请求超时，请检查 OpenClaw 服务是否正常运行' } }));
        } else if (msg.includes('401') || msg.includes('403')) {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: 'API Key 认证失败，请检查配置' } }));
        } else {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: msg } }));
        }
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
