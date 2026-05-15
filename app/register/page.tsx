import Link from "next/link";
import { ClinicLogo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg p-6 shadow-soft">
        <ClinicLogo />
        <h1 className="mt-8 text-3xl font-semibold text-clinic-ink">Create your account</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Input placeholder="First name" />
          <Input placeholder="Last name" />
          <Input className="sm:col-span-2" placeholder="Email address" type="email" />
          <Input className="sm:col-span-2" placeholder="Password" type="password" />
        </div>
        <Button className="mt-5 w-full" variant="accent">Start onboarding</Button>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-semibold text-clinic-blue">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
