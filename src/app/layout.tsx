import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "職場の声レポート",
  description: "従業員アンケートのCSVをローカルで集計し、根拠を確認できます。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
