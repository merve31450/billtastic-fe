// app/AntdProviders.tsx
'use client';
import '@ant-design/v5-patch-for-react-19'; // <-- önce bu
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';

export default function AntdProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#0766AD',
          colorInfo: '#0766AD',
          colorBgLayout: '#F6F8FB',
          colorText: '#0F172A',
          borderRadius: 12,
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
