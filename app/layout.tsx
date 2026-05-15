import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "America First Clinic CRM",
  description: "A premium healthcare and wellness CRM commerce platform for consultant-led sales."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
