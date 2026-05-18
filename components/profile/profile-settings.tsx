import Image from "next/image";
import { Upload } from "lucide-react";
import type { User } from "@prisma/client";
import { uploadAvatar, updateProfile } from "@/app/profile/actions";
import { SubmitButton } from "@/components/ui/submit-button";

const errors: Record<string, string> = {
  missing_avatar: "Choose an image before uploading.",
  invalid_avatar: "Upload a JPG, PNG, WebP, or GIF image.",
  avatar_too_large: "Avatar images must be 3 MB or smaller."
};

const updatedMessages: Record<string, string> = {
  profile: "Profile details updated.",
  avatar: "Profile photo updated."
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
  updated
}: {
  user: Pick<User, "email" | "firstName" | "lastName" | "phone" | "avatarUrl" | "role">;
  title: string;
  description: string;
  error?: string;
  updated?: string;
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
            <input
              name="phone"
              defaultValue={user.phone ?? ""}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-clinic-ink">Email</span>
            <input
              value={user.email}
              disabled
              className="h-11 w-full rounded-xl border border-border bg-slate-50 px-3 text-sm text-slate-500"
            />
          </label>
          <div className="md:col-span-2">
            <SubmitButton>Save profile</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
