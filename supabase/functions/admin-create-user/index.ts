import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CreateUserPayload = {
  fullName?: string;
  email?: string;
  password?: string;
  telephone?: string;
  bundles?: string[];
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = req.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: 'SERVER_CONFIGURATION_ERROR' }, 500);
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return json({ error: 'AUTHENTICATION_REQUIRED' }, 401);

  const { data: canManage, error: permissionError } = await caller.rpc('has_permission', {
    required_permission: 'users.manage',
  });
  if (permissionError || !canManage) return json({ error: 'PERMISSION_DENIED' }, 403);

  const body = (await req.json().catch(() => ({}))) as CreateUserPayload;
  const fullName = String(body.fullName ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const telephone = String(body.telephone ?? '').trim();
  const bundles = Array.from(new Set((body.bundles ?? []).map((code) => String(code).trim()).filter(Boolean)));

  if (fullName.length < 2) return json({ error: 'FULL_NAME_REQUIRED' }, 400);
  if (!email.includes('@')) return json({ error: 'VALID_EMAIL_REQUIRED' }, 400);
  if (password.length < 8) return json({ error: 'PASSWORD_MIN_8' }, 400);

  const { data: companyId, error: companyError } = await caller.rpc('get_user_company_id');
  if (companyError || !companyId) return json({ error: 'COMPANY_NOT_FOUND' }, 400);

  const { data: entitlements, error: entitlementError } = await caller.rpc('get_company_entitlements');
  if (entitlementError) return json({ error: entitlementError.message }, 400);
  const maxUsers = Number(entitlements?.limits?.users ?? 0);

  const { count: userCount, error: countError } = await admin
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true);
  if (countError) return json({ error: countError.message }, 400);
  if (maxUsers > 0 && (userCount ?? 0) >= maxUsers) {
    return json({ error: 'SUBSCRIPTION_USER_LIMIT_REACHED', maxUsers }, 409);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) return json({ error: createError?.message ?? 'AUTH_USER_CREATE_FAILED' }, 400);

  const userId = created.user.id;
  try {
    const primaryRole = bundles[0] || 'MANAGER_LIMITED';
    const { error: profileError } = await caller.rpc('admin_create_user_profile', {
      p_user_id: userId,
      p_username: email.split('@')[0],
      p_full_name: fullName,
      p_email: email,
      p_phone: telephone || null,
      p_role_code: primaryRole,
    });
    if (profileError) throw profileError;

    if (bundles.length > 0) {
      const { data: roles, error: rolesError } = await admin
        .from('roles')
        .select('id,code')
        .eq('company_id', companyId)
        .in('code', bundles);
      if (rolesError) throw rolesError;

      const roleRows = (roles ?? []).map((role) => ({ user_id: userId, role_id: role.id }));
      if (roleRows.length > 0) {
        const { error: roleInsertError } = await admin.from('user_roles').upsert(roleRows, { onConflict: 'user_id,role_id' });
        if (roleInsertError) throw roleInsertError;
      }
    }

    return json({ ok: true, userId, email });
  } catch (error) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
    return json({ error: message || 'USER_PROVISIONING_FAILED' }, 400);
  }
});
