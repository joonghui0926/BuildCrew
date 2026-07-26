import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildCrew — Install-ready BIM replacements",
  description:
    "Turn supplier delays into evidence-backed, install-ready BIM replacements.",
  icons: {
    icon: [
      {
        url: "/brand/buildcrew-mark.png",
        type: "image/png",
      },
    ],
    shortcut: "/brand/buildcrew-mark.png",
    apple: "/brand/buildcrew-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
