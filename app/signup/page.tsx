import type { Metadata } from "next";
import AuthScreen from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Create an account · Walley" };

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
