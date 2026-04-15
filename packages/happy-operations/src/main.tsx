import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { operationsRouter } from './router';
import 'antd/dist/reset.css';
import './styles.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#7c3aed', borderRadius: 12 } }}>
      <QueryClientProvider client={queryClient}>
        <AntdApp>
          <RouterProvider router={operationsRouter} />
        </AntdApp>
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
