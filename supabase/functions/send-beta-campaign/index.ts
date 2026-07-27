import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const FROM_EMAIL = "20Realms Beta <betaaccess@20realms.net>"
const BATCH_SIZE = 100
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://20realms.net",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
}

type Signup = {
  email: string | null
  name: string | null
  interest: string | null
  email_updates_opt_in?: boolean | null
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Email service is not configured" }, 500)
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

    if (userError || !user?.email) {
      return jsonResponse({ error: "Invalid session" }, 401)
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
    const { data: admins, error: adminError } = await serviceClient
      .from("admin_users")
      .select("email")

    if (adminError) {
      throw adminError
    }

    const isAdmin = (admins || []).some((admin) =>
      admin.email?.toLowerCase() === user.email?.toLowerCase()
    )
    if (!isAdmin) {
      return jsonResponse({ error: "Administrator access required" }, 403)
    }

    const body = await request.json()
    const subject = String(body.subject || "").trim()
    const message = String(body.message || "").trim()
    const audience = body.audience === "all" ? "all" : "opted-in"
    const testOnly = body.testOnly === true

    if (!subject || subject.length > 150) {
      return jsonResponse({ error: "Subject must be between 1 and 150 characters" }, 400)
    }
    if (!message || message.length > 10000) {
      return jsonResponse({ error: "Message must be between 1 and 10,000 characters" }, 400)
    }

    if (testOnly) {
      const testResult = await sendBatch([{ email: user.email, name: user.user_metadata?.username || "Admin" }], subject, message, audience)
      if (testResult.failed > 0) {
        return jsonResponse({
          error: "Test email failed to send",
          details: testResult.error || "Resend did not accept the message",
        }, 502)
      }
      return jsonResponse({ success: true, testOnly: true, sent: 1 })
    }

    const [{ data: signups, error: signupsError }, { data: emailSignups, error: emailSignupsError }] = await Promise.all([
      serviceClient.from("beta_signups").select("*"),
      serviceClient.from("beta_email_signups").select("email"),
    ])

    if (signupsError) {
      throw signupsError
    }

    const explicitOptIns = new Set(
      emailSignupsError
        ? []
        : (emailSignups || []).map((row) => row.email?.toLowerCase()).filter(Boolean)
    )
    const recipients = deduplicateRecipients(
      ((signups || []) as Signup[]).filter((signup) =>
        audience === "all" || isOptedIn(signup, explicitOptIns)
      )
    )

    if (recipients.length === 0) {
      return jsonResponse({ error: "No recipients match this audience" }, 400)
    }

    const { data: campaign, error: campaignError } = await serviceClient
      .from("beta_email_campaigns")
      .insert({
        subject,
        message,
        audience,
        recipient_count: recipients.length,
        created_by: user.id,
        created_by_email: user.email,
      })
      .select("id")
      .single()

    if (campaignError) {
      throw campaignError
    }

    let sent = 0
    let failed = 0
    for (let offset = 0; offset < recipients.length; offset += BATCH_SIZE) {
      const result = await sendBatch(recipients.slice(offset, offset + BATCH_SIZE), subject, message, audience)
      sent += result.sent
      failed += result.failed
    }

    const status = sent === 0 ? "failed" : failed > 0 ? "partial" : "completed"
    await serviceClient
      .from("beta_email_campaigns")
      .update({ sent_count: sent, failed_count: failed, status, completed_at: new Date().toISOString() })
      .eq("id", campaign.id)

    return jsonResponse({
      success: failed === 0,
      campaignId: campaign.id,
      recipients: recipients.length,
      sent,
      failed,
      status,
    }, failed === recipients.length ? 502 : 200)
  } catch (error) {
    console.error("Campaign send error:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500)
  }
})

function isOptedIn(signup: Signup, explicitOptIns: Set<string>) {
  const email = signup.email?.toLowerCase() || ""
  return signup.email_updates_opt_in === true ||
    explicitOptIns.has(email) ||
    (signup.interest || "").toLowerCase().includes("[optin:true]")
}

function deduplicateRecipients(signups: Signup[]) {
  const recipients = new Map<string, { email: string; name: string }>()
  for (const signup of signups) {
    const email = signup.email?.trim().toLowerCase() || ""
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || recipients.has(email)) {
      continue
    }
    recipients.set(email, { email, name: signup.name?.trim() || "Beta tester" })
  }
  return [...recipients.values()]
}

async function sendBatch(
  recipients: { email: string; name: string }[],
  subject: string,
  message: string,
  audience: "all" | "opted-in",
) {
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(recipients.map((recipient) => ({
      from: FROM_EMAIL,
      to: [recipient.email],
      subject,
      html: generateCampaignEmail(recipient.name, message, audience),
      text: generatePlainText(recipient.name, message, audience),
      headers: audience === "opted-in"
        ? { "List-Unsubscribe": "<mailto:support@20realms.net?subject=Unsubscribe%20from%2020Realms>" }
        : undefined,
    }))),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("Resend batch error:", error)
    return { sent: 0, failed: recipients.length, error }
  }

  return { sent: recipients.length, failed: 0, error: "" }
}

function generateCampaignEmail(name: string, message: string, audience: "all" | "opted-in") {
  const safeName = escapeHtml(name)
  const safeMessage = escapeHtml(message)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("")
  const unsubscribe = audience === "opted-in"
    ? '<p class="fine-print">To stop receiving news and playtest updates, email <a href="mailto:support@20realms.net?subject=Unsubscribe%20from%2020Realms">support@20realms.net</a> with the subject "Unsubscribe from 20Realms."</p>'
    : ""

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subjectForTitle(message))}</title></head>
<body style="margin:0;background:#0b0f16;color:#f7efe2;font-family:Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:40px 20px;">
    <p style="color:#d9a441;font-size:24px;font-weight:700;margin:0 0 28px;">20Realms</p>
    <div style="background:#141922;border:1px solid #3d332b;border-radius:8px;padding:28px;line-height:1.7;">
      <p>Hi ${safeName},</p>
      ${safeMessage}
    </div>
    <div style="color:#c9beb0;font-size:13px;line-height:1.6;margin-top:24px;">
      <p>20Realms - Mobile, PC, and Console.</p>
      ${unsubscribe}
      <p><a href="https://20realms.net/privacy-cookies.html" style="color:#d9a441;">Privacy Policy</a> | <a href="https://20realms.net/contact.html" style="color:#d9a441;">Contact</a></p>
    </div>
  </div>
</body>
</html>`
}

function generatePlainText(name: string, message: string, audience: "all" | "opted-in") {
  const unsubscribe = audience === "opted-in"
    ? "\n\nTo unsubscribe from news and playtest updates, email support@20realms.net with the subject 'Unsubscribe from 20Realms.'"
    : ""
  return `Hi ${name},\n\n${message}\n\n20Realms - Mobile, PC, and Console.${unsubscribe}`
}

function subjectForTitle(message: string) {
  return message.slice(0, 60) || "20Realms Beta Update"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}
