import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "Portfolito",
  description: "un porfolio cripto simple.",
  openGraph: {
    title: "Portfolito",
    description: "un porfolio cripto simple.",
    url: "https://portfolito-matrix.vercel.app/",
    siteName: "Portfolito",
    images: [
      {
        url: "/icon_portfolito.svg",
        width: 800,
        height: 600,
        alt: "Descripción de la imagen",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
