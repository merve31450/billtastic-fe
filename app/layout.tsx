import type { Metadata } from "next";
import "./globals.css";
import "antd/dist/reset.css";
import ReduxProvider from "@/Redux/Provider/ReduxProvider";
import AntdProviders from "./AntdProviders";


export const metadata: Metadata = {
  title: "Portal ASO",
  description: "U2 Soft",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AntdProviders>
          <ReduxProvider>{children}</ReduxProvider>
        </AntdProviders>
      </body>
    </html>
  );
}