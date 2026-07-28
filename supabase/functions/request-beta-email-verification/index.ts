import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const SITE_URL = (Deno.env.get("SITE_URL") || "https://20realms.net").replace(/\/$/, "")
const FROM_EMAIL = "20Realms Beta <betaaccess@20realms.net>"
const TOKEN_TTL_MINUTES = 60 * 24
const EMAIL_REGEX = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i
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
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Email verification service is not configured" }, 500)
    }

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || "").trim().toLowerCase()
    const name = String(body.name || "").trim()

    if (!EMAIL_REGEX.test(email)) {
      return jsonResponse({ error: "Invalid email address" }, 400)
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // Keep only the latest active token per email.
    await serviceClient
      .from("beta_email_verifications")
      .delete()
      .eq("email", email)
      .is("consumed_at", null)

    const token = generateToken()
    const tokenHash = await sha256Hex(token)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString()

    const { error: insertError } = await serviceClient
      .from("beta_email_verifications")
      .insert({
        email,
        name: name || null,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })

    if (insertError) {
      throw insertError
    }

    const verifyUrl = `${SITE_URL}/verify-email.html?token=${encodeURIComponent(token)}`
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: "Confirm your 20Realms beta email",
        html: generateVerificationEmail(name || email.split("@")[0], verifyUrl),
      }),
    })

    if (!emailResponse.ok) {
      const details = await emailResponse.text()
      return jsonResponse({ error: "Failed to send verification email", details }, 502)
    }

    return jsonResponse({ success: true }, 200)
  } catch (error) {
    console.error("Request verification error:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500)
  }
})

function generateToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("")
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("")
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  })
}

function generateVerificationEmail(name: string, verifyUrl: string) {
  const safeName = escapeHtml(name)
  const safeUrl = escapeHtml(verifyUrl)

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirm your 20Realms email</title>
      <style>
        body { font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b0f16; color: #f7efe2; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header h1 { font-family: 'Fraunces', Georgia, serif; font-size: 2rem; color: #d9a441; margin: 0 0 20px; }
        .content { background: rgba(255, 250, 240, 0.05); border: 1px solid rgba(181, 76, 47, 0.3); border-radius: 12px; padding: 28px; }
        .content p { line-height: 1.7; margin: 0 0 14px 0; }
        .btn { display: inline-block; margin-top: 14px; background: #b54c2f; color: #fffaf0; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Confirm your email, ${safeName}</h1>
        </div>
        <div class="content">
          <p>Thanks for joining the 20Realms beta list.</p>
          <p>Click the button below to confirm this email and start receiving updates.</p>
          <p><a class="btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Confirm email</a></p>
          <p>If the button does not open, copy this link:</p>
          <p><a href="${safeUrl}" style="color:#d9a441;word-break:break-all">${safeUrl}</a></p>
          <p>This link expires in 24 hours.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
