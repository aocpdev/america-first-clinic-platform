type AuthMetadata = Record<string, unknown>;

export type SupabaseAuthUser = {
  id: string;
  email?: string;
  app_metadata?: AuthMetadata;
  user_metadata?: AuthMetadata;
};

type CreateOrUpdateAuthUserInput = {
  email?: string;
  password?: string;
  app_metadata?: AuthMetadata;
  user_metadata?: AuthMetadata;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function adminAuthRequest<T>(path: string, init: RequestInit = {}) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers
    },
    cache: "no-store"
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      typeof payload?.msg === "string"
        ? payload.msg
        : typeof payload?.message === "string"
          ? payload.message
          : "Supabase Auth admin request failed.";
    throw new Error(message);
  }

  return payload as T;
}

export async function findAuthUserByEmail(email: string) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (page <= 10) {
    const data = await adminAuthRequest<{ users: SupabaseAuthUser[] }>(
      `/admin/users?page=${page}&per_page=${perPage}`
    );
    const match = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match) {
      return match;
    }
    if (data.users.length < perPage) {
      return null;
    }
    page += 1;
  }

  return null;
}

export async function createConfirmedAuthUser(input: CreateOrUpdateAuthUserInput) {
  return adminAuthRequest<SupabaseAuthUser>("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      email_confirm: true
    })
  });
}

export async function updateConfirmedAuthUser(authUserId: string, input: CreateOrUpdateAuthUserInput) {
  return adminAuthRequest<SupabaseAuthUser>(`/admin/users/${authUserId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...input,
      email_confirm: true
    })
  });
}

export async function upsertConfirmedAuthUserByEmail(input: CreateOrUpdateAuthUserInput & { email: string }) {
  const existingUser = await findAuthUserByEmail(input.email);
  if (existingUser) {
    return updateConfirmedAuthUser(existingUser.id, input);
  }
  return createConfirmedAuthUser(input);
}
