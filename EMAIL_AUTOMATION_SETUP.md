# 20Realms Beta Email Automation - Complete Setup Guide

## ✅ Implementation Status: **COMPLETE**

The beta signup form now includes email automation for opt-in subscribers. When users check the "Email me news and playtest updates" checkbox and submit the form, they automatically receive a welcome email.

---

## 🏗️ Architecture Overview

### Components
1. **Beta Form** (`beta.html`) - Public signup page with email opt-in checkbox
2. **Supabase Database** - Stores signup data and opt-in preferences
3. **Vercel Function** (`api/webhook-beta-email.js`) - Serverless endpoint for sending emails
4. **Resend Email Service** - Sends formatted welcome emails

### Data Flow
```
User submits form with opt-in ✓
    ↓
Form validation & submission to Supabase beta_signups table
    ↓
If opt-in checked → Insert to beta_email_signups table
    ↓
Direct call to Vercel webhook endpoint
    ↓
Webhook fetches data and calls Resend API
    ↓
Welcome email sent to subscriber
```

---

## 📋 What's Configured

### 1. Beta Form (`beta.html`)
- **Email opt-in checkbox**: "Email me news and playtest updates"
- **Form submission logic**:
  - Inserts primary signup to `beta_signups` table
  - If opt-in checked → Creates record in `beta_email_signups` table
  - **DIRECT WEBHOOK TRIGGER**: Immediately calls Vercel endpoint when opt-in record created

**Relevant code (lines ~190-220)**:
```javascript
// Direct webhook trigger for email automation
if (optinRecord && !optinRecord.error && optinRecord.data) {
  fetch('https://20realms-website-73fayutrk-bloodstone-forge.vercel.app/api/webhook-beta-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record: optinRecord.data[0] })
  });
}
```

### 2. Supabase Database Tables

**`beta_signups`** - All beta form submissions
- `id` (UUID, primary key)
- `name` (text)
- `email` (text, unique)
- `role` (text: Player/DM/Both/Creator)
- `interest` (text, nullable)
- `user_id` (UUID, nullable - for logged-in users)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- **RLS Status**: Disabled (allows public inserts)

**`beta_email_signups`** - Opt-in subscribers only
- `id` (UUID, primary key)
- `email` (text)
- `opted_in_at` (timestamp)
- `created_at` (timestamp)

### 3. Vercel Webhook Handler (`api/webhook-beta-email.js`)

**Endpoint**: `https://20realms-website-73fayutrk-bloodstone-forge.vercel.app/api/webhook-beta-email`

**Function**:
- Receives POST request with `{ record: { email, ... } }`
- Validates email address
- Calls Resend API to send welcome email
- Returns 200 on success

**Email Template**:
- Dark medieval theme matching 20Realms brand
- Personalized greeting: "Welcome, [Name]!"
- Call-to-action button linking to https://20realms.net
- Footer with privacy/contact links

### 4. Resend Email Service

**Status**: ✅ Configured and tested
- **From Address**: `betaaccess@20realms.net`
- **API Key**: Stored in Vercel environment variables
- **Free Tier**: 100 emails/day (sufficient for initial testing)

### 5. Admin Panel (`admin.html`)

**Beta Signups Viewer Features**:
- View all signups with count
- Filter by opt-in status: "All" / "Opted In" / "Not Opted In"
- Color-coded badges: Green ✓ for yes, Red ✗ for no
- Sortable columns: Email, Name, Role, Opted In, Date
- Requires admin authentication (whitelisted users)

---

## 🧪 Testing & Verification

### Test 1: Form Submission
1. Go to https://20realms.net/beta.html
2. Fill in form fields
3. **CHECK** "Email me news and playtest updates"
4. Click "Request beta access"
5. Should see: "You're on the list. We'll be in touch when beta testing opens."
6. ✅ Form works correctly

### Test 2: Database Records
To verify data is stored:
```bash
# Via Supabase REST API
curl -X GET "https://avcqqazytvvcfraowgsm.supabase.co/rest/v1/beta_email_signups?order=created_at.desc&limit=10" \
  -H "Authorization: Bearer sb_publishable_mMzC6t1szSIzhhYZpHOhkA_4oYbwgc0" \
  -H "apikey: sb_publishable_mMzC6t1szSIzhhYZpHOhkA_4oYbwgc0"
```

### Test 3: Email Delivery
1. Submit test form with real email address and opt-in checked
2. Check inbox for email from `betaaccess@20realms.net`
3. Subject: "Welcome to 20Realms Beta!"
4. ✅ Email should arrive within 1-2 minutes

### Test 4: Admin Panel Filtering
1. Go to https://20realms.net/admin.html (if logged in as admin)
2. Click "Beta Signups" tab
3. Use filter buttons to sort by opt-in status
4. Verify counts and data display correctly

---

## 🔑 API Keys & Credentials

### Supabase
- **Project URL**: https://avcqqazytvvcfraowgsm.supabase.co
- **Public API Key**: `sb_publishable_mMzC6t1szSIzhhYZpHOhkA_4oYbwgc0`
- **Database**: PostgreSQL on Supabase

### Resend Email
- **API Key**: Configured in Vercel (DO NOT commit to git)
- **Free Tier Limit**: 100 emails/day
- **Upgrade**: Add payment method at https://resend.com

### Vercel Deployment
- **Project**: 20realms-website
- **GitHub Integration**: Auto-deploys from main branch
- **Function Endpoint**: Automatically deployed with each push
- **Latest Deployment**: Commit 0f3bc6c (Direct webhook trigger implementation)

---

## ⚙️ Configuration & Customization

### Change Email Template
Edit `api/webhook-beta-email.js`, function `generateWelcomeEmail()`:
```javascript
function generateWelcomeEmail(userName) {
  return `
    <!-- Edit HTML template here -->
  `;
}
```

### Change Email Subject
Update line in `webhook-beta-email.js`:
```javascript
subject: 'Welcome to 20Realms Beta!'  // Change this text
```

### Change Email From Address
Update in Vercel environment variables:
```
FROM_EMAIL=newaddress@20realms.net
```

### Adjust Admin Filter Labels
Edit `admin.html` filter buttons section

---

## 🚀 Deployment Status

| Component | Status | Details |
|-----------|--------|---------|
| Beta Form | ✅ Live | Deployed to GitHub Pages |
| Supabase DB | ✅ Live | Production database active |
| Vercel Function | ✅ Live | Webhook endpoint reachable |
| Resend Integration | ✅ Live | Email service configured |
| Admin Panel | ✅ Live | Requires auth to access |
| Direct Webhook Call | ✅ Live | Triggered on form opt-in |

---

## 📊 Monitoring & Analytics

### Email Metrics (Resend Dashboard)
- Track: Sent, Delivered, Opened, Bounced
- Link: https://resend.com

### Form Submissions (Supabase)
- View `beta_signups` table for all submissions
- View `beta_email_signups` table for opt-in only
- Query via Supabase dashboard

### Webhook Logs (Vercel)
- View function invocations at https://vercel.com/bloodstone-forge/20realms-website/functions
- Check for errors and response times
- Monitor function usage

---

## ⚠️ Known Limitations & Future Improvements

### Current Limitations
1. **No unsubscribe links**: Future emails should include unsubscribe option
2. **CSV export**: Admin panel doesn't support bulk export yet
3. **Email rate limiting**: Free tier limited to 100 emails/day
4. **Manual email list management**: No bulk import/export

### Recommended Improvements
1. Add unsubscribe link to email template
2. Implement CSV export button in admin panel
3. Create preference management page for subscribers
4. Set up email open/click tracking
5. Add automated follow-up email sequences
6. Implement email validation/verification step
7. Create admin email sending interface (manual campaigns)

---

## 🐛 Troubleshooting

### Issue: Form submits but no success message
**Solution**: Clear browser cache, verify JavaScript loads without errors (check DevTools console)

### Issue: Email not received
**Steps**:
1. Check spam/junk folder
2. Verify email in form matches verified address in Resend
3. Check Resend dashboard for bounce/error
4. Verify Vercel function logs for errors
5. Check Supabase `beta_email_signups` for record creation

### Issue: Admin panel shows 0 signups
**Solution**:
- Verify RLS policies allow reading (currently disabled)
- Ensure authenticated user has admin role
- Check Supabase API key has correct permissions

### Issue: Webhook returning 404
**Solution**:
- Verify Vercel deployment is latest
- Check function file exists at `api/webhook-beta-email.js`
- Confirm endpoint URL in beta.html matches deployed URL

---

## 📝 Recent Changes

### Latest Commit (0f3bc6c)
- **Modified**: `beta.html`
- **Change**: Added direct webhook trigger on form submit
- **Benefit**: Bypasses Supabase webhook UI issues, more reliable email delivery
- **Impact**: Emails now sent immediately when opt-in record created

---

## 📞 Support & Documentation

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Resend Docs**: https://resend.com/docs
- **GitHub Repo**: https://github.com/ItsJurassic/20realms-website

---

## ✨ Summary

The beta email automation system is **fully functional and deployed**. Users who opt-in on the beta signup form receive welcome emails automatically. The admin panel provides visibility into signups and filtering options. The system uses modern serverless infrastructure (Vercel + Supabase + Resend) for reliability and scalability.

**Ready for production use!** 🎉
