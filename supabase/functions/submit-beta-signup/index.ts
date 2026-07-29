import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
}
const EMAIL_REGEX = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ ok: false, error: "Signup service is not configured" }, 500)
    }

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || "").trim().toLowerCase()
    const name = String(body.name || "").trim()
    const role = String(body.role || "").trim()
    const interest = String(body.interest || "").trim()
    const userId = body.user_id ? String(body.user_id) : null
    const emailUpdatesOptIn = Boolean(body.email_updates_opt_in)

    if (!name) {
      return jsonResponse({ ok: false, error: "Name is required" }, 400)
    }

    if (!EMAIL_REGEX.test(email)) {
      return jsonResponse({ ok: false, error: "Invalid email address" }, 400)
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { data: existingEmailRows, error: emailLookupError } = await serviceClient
      .from("beta_signups")
      .select("id")
      .eq("email", email)
      .limit(1)

    if (emailLookupError) {
      throw emailLookupError
    }

    if (existingEmailRows && existingEmailRows.length > 0) {
      return jsonResponse({ ok: false, duplicate: true, reason: "duplicate-email", error: "duplicate-email" }, 409)
    }

    const { data: existingNameRows, error: nameLookupError } = await serviceClient
      .from("beta_signups")
      .select("id")
      .ilike("name", name)
      .limit(1)

    if (nameLookupError) {
      throw nameLookupError
    }

    if (existingNameRows && existingNameRows.length > 0) {
      return jsonResponse({ ok: false, duplicate: true, reason: "duplicate-username", error: "duplicate-username" }, 409)
    }

    const insertPayload = {
      name: name || null,
      email,
      role: role || null,
      interest: interest || null,
      user_id: userId,
      email_updates_opt_in: emailUpdatesOptIn,
    }

    const { data, error: insertError } = await serviceClient
      .from("beta_signups")
      .insert(insertPayload)
      .select("id")
      .single()

    if (insertError) {
      if (insertError.code === "23505" || /duplicate|unique/i.test(insertError.message)) {
        const reason = /name|username/i.test(insertError.message) ? "duplicate-username" : "duplicate-email"
        return jsonResponse({ ok: false, duplicate: true, reason, error: reason }, 409)
      }
      throw insertError
    }

    return jsonResponse({ ok: true, id: data?.id ?? null }, 200)
  } catch (error) {
    console.error("Submit beta signup error:", error)
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "Unexpected server error" }, 500)
  }
})

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  })
}
