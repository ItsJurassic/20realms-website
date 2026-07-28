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

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Verification service is not configured" }, 500)
    }

    const body = await request.json().catch(() => ({}))
    const token = String(body.token || "").trim()
    if (!token || token.length < 40) {
      return jsonResponse({ error: "Invalid verification token" }, 400)
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const tokenHash = await sha256Hex(token)
    const nowIso = new Date().toISOString()
    const { data: verification, error: verificationError } = await serviceClient
      .from("beta_email_verifications")
      .select("id, email")
      .eq("token_hash", tokenHash)
      .is("consumed_at", null)
      .gt("expires_at", nowIso)
      .maybeSingle()

    if (verificationError) {
      throw verificationError
    }

    if (!verification?.id || !verification.email) {
      return jsonResponse({ error: "This verification link is invalid or expired" }, 400)
    }

    const email = verification.email.trim().toLowerCase()
    const optedInAt = new Date().toISOString()

    const { error: upsertError } = await serviceClient
      .from("beta_email_signups")
      .upsert({ email, opted_in_at: optedInAt }, { onConflict: "email" })

    if (upsertError) {
      throw upsertError
    }

    await serviceClient
      .from("beta_signups")
      .update({ email_updates_opt_in: true })
      .eq("email", email)

    const { error: consumeError } = await serviceClient
      .from("beta_email_verifications")
      .update({ consumed_at: optedInAt })
      .eq("id", verification.id)

    if (consumeError) {
      throw consumeError
    }

    return jsonResponse({ success: true, email }, 200)
  } catch (error) {
    console.error("Verify opt-in error:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500)
  }
})

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes).map((item) => item.toString(16).padStart(2, "0")).join("")
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  })
}
