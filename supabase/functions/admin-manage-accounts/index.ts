import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (request.method !== "GET" && request.method !== "DELETE") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Account management service is not configured" }, 500)
    }

    const authorization = request.headers.get("Authorization") || ""
    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required" }, 401)
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })

    const { data: userData, error: userError } = await authClient.auth.getUser()
    const user = userData.user

    if (userError || !user?.id || !user?.email) {
      return jsonResponse({ error: "Invalid session" }, 401)
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { data: adminRows, error: adminError } = await serviceClient
      .from("admin_users")
      .select("email")

    if (adminError) {
      throw adminError
    }

    const isAdmin = (adminRows || []).some((row) =>
      row.email?.toLowerCase() === user.email?.toLowerCase(),
    )

    if (!isAdmin) {
      return jsonResponse({ error: "Administrator access required" }, 403)
    }

    if (request.method === "GET") {
      const { data, error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (error) {
        throw error
      }

      const accounts = (data?.users || []).map((account) => ({
        id: account.id,
        email: account.email || "",
        username: String(account.user_metadata?.username || "").trim(),
        created_at: account.created_at || null,
        last_sign_in_at: account.last_sign_in_at || null,
        email_confirmed_at: account.email_confirmed_at || null,
      }))

      accounts.sort((a, b) => {
        const aCreated = new Date(a.created_at || 0).getTime()
        const bCreated = new Date(b.created_at || 0).getTime()
        return bCreated - aCreated
      })

      return jsonResponse({ ok: true, accounts }, 200)
    }

    const body = await request.json().catch(() => ({}))
    const userId = String(body.userId || "").trim()

    if (!userId || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
      return jsonResponse({ error: "A valid userId is required" }, 400)
    }

    if (userId === user.id) {
      return jsonResponse({ error: "You cannot delete your own account" }, 400)
    }

    const { data: targetData, error: targetError } = await serviceClient.auth.admin.getUserById(userId)
    if (targetError) {
      throw targetError
    }

    const targetEmail = targetData?.user?.email?.toLowerCase() || ""

    // Clean up public data tied to this account where possible.
    await serviceClient.from("beta_signups").delete().eq("user_id", userId)
    if (targetEmail) {
      await serviceClient.from("beta_signups").delete().eq("email", targetEmail)
      await serviceClient.from("beta_email_signups").delete().eq("email", targetEmail)
      await serviceClient.from("beta_email_verifications").delete().eq("email", targetEmail)
      await serviceClient.from("admin_users").delete().eq("email", targetEmail)
    }

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      throw deleteError
    }

    return jsonResponse({ ok: true, deletedUserId: userId, deletedEmail: targetEmail || null }, 200)
  } catch (error) {
    console.error("Admin account management error:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500)
  }
})

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  })
}
