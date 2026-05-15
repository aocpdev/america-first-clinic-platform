import Link from "next/link";
import { ClinicLogo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-6 shadow-soft">
        <ClinicLogo />
        <h1 className="mt-8 text-3xl font-semibold text-clinic-ink">Log in</h1>
        <p className="mt-2 text-sm text-slate-500">Access your secure America First Clinic workspace.</p>
        <div className="mt-6 space-y-4">
          <Input placeholder="Email address" type="email" />
          <Input placeholder="Password" type="password" />
          <Button className="w-full" variant="accent">Log in securely</Button>
        </div>
        <div className="mt-5 flex justify-between text-sm font-medium">
          <Link href="/forgot-password" className="text-clinic-blue">Forgot password?</Link>
          <Link href="/register" className="text-clinic-red">Create account</Link>
        </div>
      </Card>
    </main>
  );
}
