import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Go Virtual Health CRM",
  description: "A premium healthcare and wellness CRM commerce platform for agent-led sales.",
  icons: {
    icon: "/go-virtual-health-emblem.png",
    apple: "/go-virtual-health-emblem.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "xb4ssehq7u");
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
