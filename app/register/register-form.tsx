"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Crown, Users } from "lucide-react";
import { registerUser } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

type PartnerOption = {
  id: string;
  name: string;
};

type LeaderOption = {
  id: string;
  partnerProfileId: string;
  displayName: string;
};

type RegistrationRole = "CONSULTANT" | "GROUP_LEADER";

export function RegisterForm({
  partners,
  groupLeaders,
  error,
  errorMessage
}: {
  partners: PartnerOption[];
  groupLeaders: LeaderOption[];
  error?: string;
  errorMessage?: string;
}) {
  const [requestedRole, setRequestedRole] = useState<RegistrationRole>("CONSULTANT");
  const [partnerProfileId, setPartnerProfileId] = useState("");
  const [groupLeaderProfileId, setGroupLeaderProfileId] = useState("");

  const visibleLeaders = useMemo(
    () => groupLeaders.filter((leader) => leader.partnerProfileId === partnerProfileId),
    [groupLeaders, partnerProfileId]
  );

  function selectPartner(value: string) {
    setPartnerProfileId(value);
    setGroupLeaderProfileId("");
  }

  return (
    <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.12)]">
      <div className="border-b border-border bg-gradient-to-b from-white to-clinic-mist/40 p-6">
        <Badge className="border-blue-100 bg-white text-clinic-navy">Seller access</Badge>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-clinic-ink">Create your account</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Choose the access type that matches your role. Accounts are reviewed by the assigned partner or company admin before the CRM opens.
        </p>
      </div>

      <div className="grid gap-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRequestedRole("CONSULTANT")}
            className={cn(
              "rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft",
              requestedRole === "CONSULTANT" ? "border-clinic-navy bg-clinic-mist shadow-line" : "border-border bg-white"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-white text-clinic-navy shadow-line">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-clinic-ink">Seller</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Join a partner and optionally select your group leader.</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setRequestedRole("GROUP_LEADER");
              setGroupLeaderProfileId("");
            }}
            className={cn(
              "rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft",
              requestedRole === "GROUP_LEADER" ? "border-clinic-navy bg-clinic-mist shadow-line" : "border-border bg-white"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-white text-clinic-navy shadow-line">
                <Crown className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-clinic-ink">Group leader</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Request leader access under a partner company.</p>
              </div>
            </div>
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage ?? "Registration could not be completed. Please review your information and try again."}
          </div>
        ) : null}

        <form action={registerUser} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="requestedRole" value={requestedRole} />
          <Input name="firstName" placeholder="First name" required />
          <Input name="lastName" placeholder="Last name" required />
          <Input className="sm:col-span-2" name="email" placeholder="Email address" type="email" required />
          <PhoneInput className="sm:col-span-2" name="phone" />
          <Input className="sm:col-span-2" name="password" placeholder="Password" type="password" minLength={8} required />

          <label className="sm:col-span-2 space-y-2 text-sm font-semibold text-clinic-ink">
            <span>Partner company</span>
            <select
              name="requestedPartnerProfileId"
              className="h-12 w-full rounded-2xl border border-input bg-white px-4 text-sm shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={partnerProfileId}
              onChange={(event) => selectPartner(event.target.value)}
              required
            >
              <option value="" disabled>Select your partner company</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>{partner.name}</option>
              ))}
            </select>
          </label>

          {requestedRole === "CONSULTANT" ? (
            <label className="sm:col-span-2 space-y-2 text-sm font-semibold text-clinic-ink">
              <span>Group leader</span>
              <select
                name="requestedGroupLeaderProfileId"
                className="h-12 w-full rounded-2xl border border-input bg-white px-4 text-sm shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={groupLeaderProfileId}
                onChange={(event) => setGroupLeaderProfileId(event.target.value)}
                disabled={!partnerProfileId}
              >
                <option value="">Direct to partner / not sure yet</option>
                {visibleLeaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>{leader.displayName}</option>
                ))}
              </select>
              <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <Users className="h-3.5 w-3.5" />
                Leaders appear after selecting a partner company.
              </p>
            </label>
          ) : null}

          <SubmitButton className="sm:col-span-2 mt-1 h-12 w-full rounded-2xl" pendingText="Creating account..." variant="accent">
            Request {requestedRole === "GROUP_LEADER" ? "leader" : "seller"} access
          </SubmitButton>
        </form>

        <p className="text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-semibold text-clinic-blue">Log in</Link>
        </p>
      </div>
    </Card>
  );
}
