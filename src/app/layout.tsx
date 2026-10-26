import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaperVault · University Past Papers",
  description: "A searchable university past examination paper repository.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 bg-[#f6f4ed] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
