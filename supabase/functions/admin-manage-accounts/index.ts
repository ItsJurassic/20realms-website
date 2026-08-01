import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const SUPABASE_AUTH_ISSUER = `${SUPABASE_URL}/auth/v1`
const SUPABASE_JWKS = createRemoteJWKSet(new URL(`${SUPABASE_AUTH_ISSUER}/.well-known/jwks.json`))

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
}

const LEGACY_ACCOUNT_NAME_MAP = {
  "rpowell": { first_name: "Jason", last_name: "Powell" },
  "keenerka": { first_name: "Kaleena", last_name: "Caldwell" },
  "drewdallas": { first_name: "Drew", last_name: "Dallas" },
  "misty.amburgey": { first_name: "Misty", last_name: "Amburgey" },
  "dungeon.master": { first_name: "Joseph", last_name: "Caldwell" },
  "gabriel.salvatori": { first_name: "Gabriel", last_name: "Salvatori" },
  "josephcaldwell": { first_name: "Joseph", last_name: "Caldwell" },
  "nootdoot63": { first_name: "Gabriel", last_name: "Salvatori" },
}

function resolveLegacyName(username: string, email: string) {
  const usernameKey = String(username || "").trim().toLowerCase()
  const emailLocalKey = String(email || "").split("@")[0]?.trim().toLowerCase() || ""

  if (usernameKey && LEGACY_ACCOUNT_NAME_MAP[usernameKey as keyof typeof LEGACY_ACCOUNT_NAME_MAP]) {
    return LEGACY_ACCOUNT_NAME_MAP[usernameKey as keyof typeof LEGACY_ACCOUNT_NAME_MAP]
  }

  if (emailLocalKey && LEGACY_ACCOUNT_NAME_MAP[emailLocalKey as keyof typeof LEGACY_ACCOUNT_NAME_MAP]) {
    return LEGACY_ACCOUNT_NAME_MAP[emailLocalKey as keyof typeof LEGACY_ACCOUNT_NAME_MAP]
  }

  for (const key of Object.keys(LEGACY_ACCOUNT_NAME_MAP)) {
    if ((usernameKey && usernameKey.startsWith(key)) || (emailLocalKey && emailLocalKey.startsWith(key))) {
      return LEGACY_ACCOUNT_NAME_MAP[key as keyof typeof LEGACY_ACCOUNT_NAME_MAP]
    }
  }

  return null
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (request.method !== "GET" && request.method !== "POST" && request.method !== "DELETE") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Account management service is not configured" }, 500)
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}))
      const username = String(body.username || "").trim().toLowerCase()

      if (!username) {
        return jsonResponse({ ok: false, error: "Username is required" }, 400)
      }

      let page = 1
      const perPage = 1000

      while (true) {
        const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
        if (error) {
          throw error
        }

        const users = data?.users || []
        const taken = users.some((user) => {
          const existing = String(user.user_metadata?.username || "").trim().toLowerCase()
          return existing && existing === username
        })

        if (taken) {
          return jsonResponse({ ok: true, available: false }, 200)
        }

        if (users.length < perPage) {
          break
        }

        page += 1
      }

      return jsonResponse({ ok: true, available: true }, 200)
    }

    const authorization = request.headers.get("Authorization") || ""
    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required" }, 401)
    }

    const accessToken = authorization.replace("Bearer ", "").trim()
    const { payload } = await jwtVerify(accessToken, SUPABASE_JWKS, {
      issuer: SUPABASE_AUTH_ISSUER,
      audience: "authenticated",
    })

    const requesterUserId = String(payload.sub || "").trim()
    if (!requesterUserId) {
      return jsonResponse({ error: "Invalid session" }, 401)
    }

    const { data: requesterData, error: requesterError } = await serviceClient.auth.admin.getUserById(requesterUserId)
    const requester = requesterData?.user

    if (requesterError || !requester?.id || !requester?.email) {
      return jsonResponse({ error: "Invalid session" }, 401)
    }

    const { data: adminRows, error: adminError } = await serviceClient.from("admin_users").select("email")
    if (adminError) {
      throw adminError
    }

    const isAdmin = (adminRows || []).some((row) => row.email?.toLowerCase() === requester.email?.toLowerCase())
    if (!isAdmin) {
      return jsonResponse({ error: "Administrator access required" }, 403)
    }

    if (request.method === "GET") {
      const { data, error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (error) {
        throw error
      }

      const accounts = (data?.users || []).map((account) => {
        const metadata = account.user_metadata || {}
        const username = String(metadata.username || "").trim()
        const fallbackName = resolveLegacyName(username, account.email || "")

        const firstName = String(fallbackName?.first_name || metadata.first_name || "").trim()
        const lastName = String(fallbackName?.last_name || metadata.last_name || "").trim()

        return {
          id: account.id,
          email: account.email || "",
          username,
          first_name: firstName,
          last_name: lastName,
          created_at: account.created_at || null,
          last_sign_in_at: account.last_sign_in_at || null,
          email_confirmed_at: account.email_confirmed_at || null,
        }
      })

      accounts.sort((a, b) => {
        const aCreated = new Date(a.created_at || 0).getTime()
        const bCreated = new Date(b.created_at || 0).getTime()
        return bCreated - aCreated
      })

      return jsonResponse({ ok: true, accounts }, 200)
    }

    const body = await request.json().catch(() => ({}))
    const deleteUserId = String(body.userId || "").trim()

    if (!deleteUserId || !/^[0-9a-fA-F-]{36}$/.test(deleteUserId)) {
      return jsonResponse({ error: "A valid userId is required" }, 400)
    }

    if (deleteUserId === requester.id) {
      return jsonResponse({ error: "You cannot delete your own account" }, 400)
    }

    const { data: targetData, error: targetError } = await serviceClient.auth.admin.getUserById(deleteUserId)
    if (targetError) {
      throw targetError
    }

    const targetEmail = targetData?.user?.email?.toLowerCase() || ""

    await serviceClient.from("beta_signups").delete().eq("user_id", deleteUserId)
    if (targetEmail) {
      await serviceClient.from("beta_signups").delete().eq("email", targetEmail)
      await serviceClient.from("beta_email_signups").delete().eq("email", targetEmail)
      await serviceClient.from("beta_email_verifications").delete().eq("email", targetEmail)
      await serviceClient.from("admin_users").delete().eq("email", targetEmail)
    }

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(deleteUserId)
    if (deleteError) {
      throw deleteError
    }

    return jsonResponse({ ok: true, deletedUserId: deleteUserId, deletedEmail: targetEmail || null }, 200)
  } catch (error) {
    console.error("Admin account management error:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500)
  }
})

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  })
}
