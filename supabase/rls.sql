create schema if not exists app;

alter table "User" enable row level security;
alter table "Company" enable row level security;
alter table "ConsultantProfile" enable row level security;
alter table "Customer" enable row level security;
alter table "Product" enable row level security;
alter table "ProductCategory" enable row level security;
alter table "Order" enable row level security;
alter table "Commission" enable row level security;
alter table "PaymentTransaction" enable row level security;
alter table "Subscription" enable row level security;
alter table "ReferralLink" enable row level security;
alter table "Lead" enable row level security;
alter table "Team" enable row level security;
alter table "TeamMember" enable row level security;
alter table "ActivityLog" enable row level security;
alter table "Notification" enable row level security;
alter table "AuditLog" enable row level security;
alter table "OnboardingStep" enable row level security;

create or replace function app.current_user_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'CUSTOMER');
$$;

create or replace function app.current_company_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::uuid;
$$;

create or replace function app.current_consultant_profile_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'consultant_profile_id', '')::uuid;
$$;

create policy "super admins can access all users"
on "User" for all
using (app.current_user_role() = 'SUPER_ADMIN')
with check (app.current_user_role() = 'SUPER_ADMIN');

create policy "company scoped users"
on "User" for select
using (
  app.current_user_role() in ('COMPANY_ADMIN', 'MANAGER')
  and "companyId" = app.current_company_id()
);

create policy "consultants can read own profile"
on "ConsultantProfile" for select
using (
  app.current_user_role() = 'SUPER_ADMIN'
  or ("companyId" = app.current_company_id() and app.current_user_role() in ('COMPANY_ADMIN', 'MANAGER'))
  or id = app.current_consultant_profile_id()
);

create policy "company scoped products"
on "Product" for select
using (
  active = true
  or app.current_user_role() = 'SUPER_ADMIN'
  or ("companyId" = app.current_company_id() and app.current_user_role() in ('COMPANY_ADMIN', 'MANAGER', 'CONSULTANT'))
);

create policy "company admins manage products"
on "Product" for all
using ("companyId" = app.current_company_id() and app.current_user_role() in ('SUPER_ADMIN', 'COMPANY_ADMIN'))
with check ("companyId" = app.current_company_id() and app.current_user_role() in ('SUPER_ADMIN', 'COMPANY_ADMIN'));

create policy "consultants read own customers"
on "Customer" for select
using (
  app.current_user_role() = 'SUPER_ADMIN'
  or ("companyId" = app.current_company_id() and app.current_user_role() = 'COMPANY_ADMIN')
  or ("consultantProfileId" = app.current_consultant_profile_id())
);

create policy "orders scoped by role"
on "Order" for select
using (
  app.current_user_role() = 'SUPER_ADMIN'
  or ("companyId" = app.current_company_id() and app.current_user_role() = 'COMPANY_ADMIN')
  or ("consultantProfileId" = app.current_consultant_profile_id())
);

create policy "commissions scoped by role"
on "Commission" for select
using (
  app.current_user_role() = 'SUPER_ADMIN'
  or ("companyId" = app.current_company_id() and app.current_user_role() = 'COMPANY_ADMIN')
  or ("consultantProfileId" = app.current_consultant_profile_id())
);

create policy "notifications are private"
on "Notification" for select
using ("userId"::text = auth.uid()::text);
