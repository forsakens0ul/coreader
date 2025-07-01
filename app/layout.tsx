import "./globals.css";
import type { Metadata } from "next";
import {
  Inter,
  Crimson_Text,
  Merriweather,
  Source_Serif_4,
} from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const crimson = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson",
});
const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-merriweather",
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "CoReader - Your Personal Reading Experience",
  description:
    "A beautiful reading app inspired by WeChat Reading with advanced features",
  keywords: ["reading", "ebook", "epub", "pdf", "txt", "notes", "highlights"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${crimson.variable} ${merriweather.variable} ${sourceSerif.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
