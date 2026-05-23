import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "九斗合作農場",
  description: "有機蔬菜・友善耕作・產地直送",

  openGraph: {
    title: "九斗合作農場",
    description: "有機蔬菜・友善耕作・產地直送",
    siteName: "九斗合作農場",
    locale: "zh_TW",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "九斗合作農場",
    description: "有機蔬菜・友善耕作・產地直送",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
