import { Inter } from "next/font/google";
import BugReportButton from "@/components/BugReportButton";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Amplify · Dashboard de Aquisição",
  description: "Acompanhamento em tempo real do funil de aquisição de creators — Amplify TikTok Shop",
  manifest: "/manifest.webmanifest",
  applicationName: "Amplify Projetos",
  appleWebApp: {
    capable: true,
    title: "Amplify Projetos",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0B12",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        {children}
        <BugReportButton />
      </body>
    </html>
  );
}
