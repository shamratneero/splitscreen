import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "SplitUp",
  description: "Claim your share without installing an app.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
