import type { Metadata } from "next";
import { LoginScreen } from "@/components/shell/login";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <LoginScreen />;
}
