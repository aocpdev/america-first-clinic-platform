import Link from "next/link";
import { ClinicLogo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/app/(auth)/actions";

const errorMessages: Record<string, string> = {
  invalid_email: "Enter a valid email address."
};

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : null;
  const sent = params?.sent === "1";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-6 shadow-soft">
        <ClinicLogo />
        <h1 className="mt-8 text-3xl font-semibold text-clinic-ink">Reset password</h1>
        <p className="mt-2 text-sm text-slate-500">Enter your email and we will send a secure reset link.</p>
        {sent ? (
          <div className="mt-6 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            If that email exists, a secure reset link has been requested.
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
            {error}
          </div>
        ) : null}
        <form action={requestPasswordReset}>
          <Input name="email" className="mt-6" placeholder="Email address" type="email" required />
          <Button className="mt-4 w-full">Send reset link</Button>
        </form>
        <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-clinic-blue">Back to log in</Link>
      </Card>
    </main>
  );
}
