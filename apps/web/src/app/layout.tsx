import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "PIKUDO";

export const metadata: Metadata = {
  title: appName,
  description: "PIKUDO landing"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="container">
          <main>{children}</main>
          <footer className="footer">{new Date().getFullYear()} {appName}</footer>
        </div>
      </body>
    </html>
  );
}
