import Link from "next/link";
import { loginUser } from "@/app/(auth)/actions";
import { ClinicLogo } from "@/components/layout/logo";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dashboardPathForRole } from "@/lib/auth/redirects";
import { redirect } from "next/navigation";

const errorMessages: Record<string, string> = {
  invalid_credentials: "The email or password is incorrect.",
  account_not_active: "This account is not active. Contact an administrator.",
  profile_not_found: "Your authentication profile exists, but the CRM profile was not found.",
  access_denied: "You do not have access to that workspace."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();

  if (user && !error) {
    redirect(dashboardPathForRole(user.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-6 shadow-soft">
        <ClinicLogo />
        <h1 className="mt-8 text-3xl font-semibold text-clinic-ink">Log in</h1>
        <p className="mt-2 text-sm text-slate-500">Access your secure America First Clinic workspace.</p>
        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {errorMessages[error] ?? "We could not sign you in. Please try again."}
          </div>
        )}
        <form action={loginUser} className="mt-6 space-y-4">
          <Input name="email" placeholder="Email address" type="email" required />
          <Input name="password" placeholder="Password" type="password" required />
          <SubmitButton className="w-full" pendingText="Signing in..." variant="accent">Log in securely</SubmitButton>
        </form>
        <div className="mt-5 flex justify-between text-sm font-medium">
          <Link href="/forgot-password" className="text-clinic-blue">Forgot password?</Link>
          <Link href="/register" className="text-clinic-red">Create account</Link>
        </div>
      </Card>
    </main>
  );
}
