import Image from "next/image";
import { LockKeyhole, Upload } from "lucide-react";
import type { User } from "@prisma/client";
import { changePassword, uploadAvatar, updateProfile } from "@/app/profile/actions";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";

const errors: Record<string, string> = {
  missing_avatar: "Choose an image before uploading.",
  invalid_avatar: "Upload a JPG, PNG, WebP, or GIF image.",
  avatar_too_large: "Avatar images must be 3 MB or smaller.",
  missing_company_name: "Enter a company name before saving.",
  invalid_email: "Enter a valid email address before saving.",
  email_taken: "That email is already connected to another CRM account.",
  email_update_failed: "We could not update that email. Try another email or contact support.",
  invalid_bank_account: "Review the bank details. Routing must be 9 digits and both account numbers must match.",
  bank_encryption_missing: "Bank details cannot be saved until BANK_ACCOUNT_ENCRYPTION_KEY is configured.",
  partner_profile_required: "A partner profile is required before adding payout banking.",
  password_too_short: "Use at least 8 characters for the new password.",
  password_mismatch: "Both password fields must match.",
  password_update_failed: "We could not update the password. Try again or contact support."
};

const updatedMessages: Record<string, string> = {
  profile: "Profile details updated.",
  avatar: "Profile photo updated.",
  company: "Partner company updated.",
  bank: "Partner payout banking updated.",
  password: "Password updated. Use the new password the next time you sign in."
};

function initials(user: Pick<User, "firstName" | "lastName" | "email">) {
  const first = user.firstName?.trim().charAt(0);
  const last = user.lastName?.trim().charAt(0);
  return `${first ?? ""}${last ?? ""}`.trim().toUpperCase() || user.email.charAt(0).toUpperCase();
}

export function ProfileSettings({
  user,
  title,
  description,
  error,
  updated,
  children
}: {
  user: Pick<User, "email" | "firstName" | "lastName" | "phone" | "avatarUrl" | "role">;
  title: string;
  description: string;
  error?: string;
  updated?: string;
  children?: React.ReactNode;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Account";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {error && errors[error] ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-clinic-red">
          {errors[error]}
        </div>
      ) : null}
      {updated && updatedMessages[updated] ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {updatedMessages[updated]}
        </div>
      ) : null}

      <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 shrink-0 overflow-hidden rounded-full bg-clinic-navy text-2xl font-bold text-white shadow-inner">
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt={fullName} fill sizes="96px" className="object-cover" />
              ) : (
                <span className="m-auto">{initials(user)}</span>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-clinic-red">{user.role.replace("_", " ")}</p>
              <h2 className="mt-2 text-2xl font-semibold text-clinic-ink">{title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            </div>
          </div>

          <form action={uploadAvatar} className="rounded-2xl border border-border bg-clinic-mist p-4">
            <label className="text-sm font-semibold text-clinic-ink" htmlFor="avatar">
              Profile photo
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="avatar"
                name="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="max-w-64 rounded-xl border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-clinic-navy file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
              />
              <SubmitButton className="gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </SubmitButton>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-clinic-ink">Personal information</h3>
          <p className="mt-1 text-sm text-slate-500">This information is used across dashboards, assignments, and internal activity.</p>
        </div>
        <form action={updateProfile} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-clinic-ink">First name</span>
            <input
              name="firstName"
              defaultValue={user.firstName ?? ""}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-clinic-ink">Last name</span>
            <input
              name="lastName"
              defaultValue={user.lastName ?? ""}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-clinic-ink">Phone</span>
            <PhoneInput
              name="phone"
              defaultValue={user.phone ?? ""}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-clinic-ink">Email</span>
            <input
              name="email"
              type="email"
              defaultValue={user.email}
              required
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
            />
          </label>
          <div className="md:col-span-2">
            <SubmitButton>Save profile</SubmitButton>
          </div>
        </form>
      </section>
      <section className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-gradient-to-br from-white to-clinic-mist/70 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-clinic-navy shadow-sm ring-1 ring-border">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Secure access</p>
              <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Password & access</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Update the password used to sign in to the CRM. This changes the Supabase Auth password directly without sending an email.
              </p>
            </div>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Active account
          </div>
        </div>
        <form action={changePassword} className="grid gap-4 p-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-clinic-ink">New password</span>
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-clinic-ink">Confirm password</span>
            <input
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="Repeat new password"
              className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
            />
          </label>
          <div className="rounded-2xl border border-border bg-clinic-mist p-4 text-sm leading-6 text-slate-600 md:col-span-2">
            Passwords are never stored in the CRM database. Supabase stores the encrypted credential and the CRM keeps only the user profile and role.
          </div>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Updating password...">Update password</SubmitButton>
          </div>
        </form>
      </section>
      {children}
    </div>
  );
}
