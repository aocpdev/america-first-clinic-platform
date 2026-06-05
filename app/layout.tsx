import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Go Virtual Health CRM",
  description: "A premium healthcare and wellness CRM commerce platform for consultant-led sales.",
  icons: {
    icon: "/go-virtual-health-emblem.png",
    apple: "/go-virtual-health-emblem.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
