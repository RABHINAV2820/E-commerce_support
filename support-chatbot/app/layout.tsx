import "../styles/globals.css";
import { ReactNode } from "react";
import ThemeProvider from "@/components/ThemeProvider";
import Layout from "@/components/Layout";
import AuthGuard from "../components/AuthGuard";

export const metadata = {
  title: "E-commerce Support Chatbot",
  description: "MVP storefront with support chatbot placeholder"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthGuard>
            <Layout>{children}</Layout>
          </AuthGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}

