"use client";

import { ConfigProvider, theme as antdTheme } from "antd";
import ReduxProvider from "@/Redux/Provider/ReduxProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider>
      <ConfigProvider
        theme={{
          algorithm: antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: "#0766AD",
            colorInfo: "#0766AD",
            colorBgLayout: "#F6F8FB",
            colorText: "#FFFFFFF",
            borderRadius: 12,
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ReduxProvider>
  );
}
