import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life OS - Your Personal Productivity System",
  description: "Manage your tasks and domains with Life OS, powered by Notion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
