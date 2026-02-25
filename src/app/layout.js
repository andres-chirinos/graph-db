import Script from "next/script";
import Providers from "./providers";
import "leaflet/dist/leaflet.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata = {
  title: "Base de Conocimiento",
  description: "Explorador de entidades",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/logo.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code&family=Inter:opsz,wght@14..32,100..900&display=swap"
          rel="stylesheet"
        />
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body className={"bg-[#f8f9fa] font-[Inter] text-sm text-[#202122]"}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
