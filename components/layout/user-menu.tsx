"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { logoutUser } from "@/app/(auth)/actions";

type UserMenuProps = {
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    role: string;
  };
  profileHref: string;
};

function initials(firstName: string | null, lastName: string | null, email: string) {
  const first = firstName?.trim().charAt(0);
  const last = lastName?.trim().charAt(0);
  return `${first ?? ""}${last ?? ""}`.trim().toUpperCase() || email.charAt(0).toUpperCase();
}

export function UserMenu({ user, profileHref }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Account";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 items-center gap-2 rounded-full border border-border bg-white px-1.5 pr-3 text-left shadow-sm transition hover:border-clinic-navy/30 hover:shadow-md"
        aria-expanded={open}
        aria-label="Open user menu"
      >
        <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-clinic-navy text-xs font-bold text-white">
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt={fullName} fill sizes="32px" className="object-cover" />
          ) : (
            <span className="m-auto">{initials(user.firstName, user.lastName, user.email)}</span>
          )}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-semibold text-clinic-ink sm:block">{fullName}</span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
          <div className="border-b border-border px-4 py-4">
            <p className="truncate text-sm font-semibold text-clinic-ink">{fullName}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-2 inline-flex rounded-full bg-clinic-mist px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-clinic-navy">
              {user.role.replace("_", " ")}
            </p>
          </div>
          <div className="p-2">
            <Link
              href={profileHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-clinic-mist hover:text-clinic-navy"
            >
              <UserRound className="h-4 w-4" />
              Profile
            </Link>
            <form action={logoutUser}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-red-50 hover:text-clinic-red"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
