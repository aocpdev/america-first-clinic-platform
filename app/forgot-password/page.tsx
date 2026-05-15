import Link from "next/link";
import { ClinicLogo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-6 shadow-soft">
        <ClinicLogo />
        <h1 className="mt-8 text-3xl font-semibold text-clinic-ink">Reset password</h1>
        <p className="mt-2 text-sm text-slate-500">Enter your email and we will send a secure reset link.</p>
        <Input className="mt-6" placeholder="Email address" type="email" />
        <Button className="mt-4 w-full">Send reset link</Button>
        <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-clinic-blue">Back to log in</Link>
      </Card>
    </main>
  );
}
