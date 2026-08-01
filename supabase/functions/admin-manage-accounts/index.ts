import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const SUPABASE_AUTH_ISSUER = `${SUPABASE_URL}/auth/v1`
const SUPABASE_JWKS = createRemoteJWKSet(new URL(`${SUPABASE_AUTH_ISSUER}/.well-known/jwks.json`))
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
}

const LEGACY_ACCOUNT_NAME_MAP: Record<string, { first_name: string; last_name: string }> = {
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
  const usernameKey = username.trim().toLowerCase()
  const emailLocalKey = String(email || "").split("@")[0]?.trim().toLowerCase() || ""

  if (usernameKey && LEGACY_ACCOUNT_NAME_MAP[usernameKey]) {
    return LEGACY_ACCOUNT_NAME_MAP[usernameKey]
  }

  if (emailLocalKey && LEGACY_ACCOUNT_NAME_MAP[emailLocalKey]) {
    return LEGACY_ACCOUNT_NAME_MAP[emailLocalKey]
  }

  // Match prefixes to support usernames/emails that append numeric suffixes.
  const keys = Object.keys(LEGACY_ACCOUNT_NAME_MAP)
  const matchedKey = keys.find((key) =>
    (usernameKey && usernameKey.startsWith(key)) || (emailLocalKey && emailLocalKey.startsWith(key)),
  )

  return matchedKey ? LEGACY_ACCOUNT_NAME_MAP[matchedKey] : undefined
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (request.method !== "GET" && request.method !== "DELETE") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Account management service is not configured" }, 500)
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

    const userId = String(payload.sub || "").trim()
    if (!userId) {
      return jsonResponse({ error: "Invalid session" }, 401)
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { data: authUserData, error: authUserError } = await serviceClient.auth.admin.getUserById(userId)
    const user = authUserData?.user

    if (authUserError || !user?.id || !user?.email) {
      return jsonResponse({ error: "Invalid session" }, 401)
    }

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

      const accounts = await Promise.all((data?.users || []).map(async (account) => {
        const userMetadata = (account.user_metadata || {}) as Record<string, unknown>
        const username = String(userMetadata.username || "").trim()
        const fallbackName = resolveLegacyName(username, account.email || "")

        const firstName = String(userMetadata.first_name || fallbackName?.first_name || "").trim()
        const lastName = String(userMetadata.last_name || fallbackName?.last_name || "").trim()
        const fullName = String(userMetadata.full_name || "").trim() || [firstName, lastName].filter(Boolean).join(" ")

        const shouldBackfill = Boolean(account.id && fallbackName && (!userMetadata.first_name || !userMetadata.last_name))
        if (shouldBackfill) {
          const { error: updateError } = await serviceClient.auth.admin.updateUserById(account.id, {
            user_metadata: {
              ...userMetadata,
              first_name: firstName,
              last_name: lastName,
              full_name: fullName,
            },
          })

          if (updateError) {
            console.warn(`Legacy name backfill failed for ${username}:`, updateError.message)
          }
        }

        return {
          id: account.id,
          email: account.email || "",
          first_name: firstName,
          last_name: lastName,
          username,
          created_at: account.created_at || null,
          last_sign_in_at: account.last_sign_in_at || null,
          email_confirmed_at: account.email_confirmed_at || null,
        }
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
