import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Serena Riverside | Social Arena",
  description: "Cuộc thi lan tỏa dấu ấn Serena Riverside — Kickoff 2026",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
