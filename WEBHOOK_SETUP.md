# Beta Email Webhook Setup Guide

## Overview
This guide sets up automated welcome emails when beta signup users opt in to email updates.

## Architecture
1. User submits beta form with email opt-in checked
2. Data saved to `beta_email_signups` table in Supabase
3. Supabase webhook triggers on INSERT
4. Webhook calls deployed function at webhook endpoint
5. Function sends welcome email via Resend API

## Step 1: Deploy Webhook Handler

### Option A: Deploy to Vercel (Recommended - Free)

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import the 20realms-website repository
5. Create a `api` folder in the repository root
6. Add file: `api/webhook-beta-email.js`
7. Copy the contents from `webhook-handler.js` to that file
8. Push to GitHub - Vercel will auto-deploy
9. Note the deployment URL: `https://your-project.vercel.app/api/webhook-beta-email`

### Option B: Deploy to Netlify (Free)

1. Go to [netlify.com](https://netlify.com)
2. Connect GitHub repository
3. In build settings, set Functions directory to `netlify/functions`
4. Create file: `netlify/functions/webhook-beta-email.js`
5. Copy `webhook-handler.js` contents
6. Push to GitHub - Netlify auto-deploys
7. Webhook URL: `https://your-site.netlify.app/.netlify/functions/webhook-beta-email`

### Option C: Use Supabase Edge Functions (Free within limits)

1. Go to Supabase Dashboard → Edge Functions
2. Create new function: `send-welcome-email`
3. Copy the handler code (adapt for Deno/TypeScript)
4. Deploy
5. Webhook URL: `https://your-project.supabase.co/functions/v1/send-welcome-email`

## Step 2: Set Up Supabase Webhook

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to: Database → Webhooks
3. Click "Create a new webhook"
4. Configure:
   - **Name:** Beta Email Signup
   - **Table:** `beta_email_signups`
   - **Events:** INSERT
   - **URL:** `https://your-deployment-url.com/path`
   - **HTTP Method:** POST
5. Click "Create webhook"

## Step 3: Test the Setup

1. Go to your beta form: https://20realms.net/beta.html
2. Fill in form with test email
3. **Check the "Email me news and playtest updates" checkbox**
4. Submit form
5. Check webhook logs in Supabase Dashboard
6. Check your email for the welcome message

## Troubleshooting

### Email not arriving
- Check Supabase webhook logs for errors
- Verify Resend API key is correct
- Check Resend dashboard for delivery status
- Ensure spam filter isn't blocking `betaaccess@20realms.net`

### Webhook not triggering
- Verify `beta_email_signups` table exists
- Check that webhook URL is correct and publicly accessible
- Verify webhook is enabled in Supabase

### 404 Errors
- Ensure deployed function/webhook endpoint is live
- Test URL directly in browser (should return 405 or 400, not 404)

## Resend API Key
The API key `re_6pUDLEgC_NNsS5cd99xXXGfVuB4DzjNwF` is already configured in the webhook code.

## Security Notes
- API key is visible in deployed code - **rotate it after testing if you're concerned**
- In production, store Resend API key as an environment variable
- Webhook should validate incoming requests (add signature verification if needed)

## Next Steps After Setup
1. Monitor first week of signups
2. Check delivery rate in Resend dashboard
3. Adjust email template if needed (edit HTML in webhook handler)
4. Set up email unsubscribe link when ready (advanced)
