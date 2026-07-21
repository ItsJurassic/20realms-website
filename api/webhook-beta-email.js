const RESEND_API_KEY = 're_6pUDLEgC_NNsS5cd99xXXGfVuB4DzjNwF';
const FROM_EMAIL = 'betaaccess@20realms.net';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { record } = req.body;

    if (!record || !record.email) {
      return res.status(400).json({ error: 'Missing email in webhook payload' });
    }

    const { email, name } = record;
    const userName = name || email.split('@')[0];

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: 'Welcome to 20Realms Beta!',
        html: generateWelcomeEmail(userName),
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.json();
      console.error('Resend API error:', error);
      return res.status(emailResponse.status).json({ error: 'Failed to send email', details: error });
    }

    const emailData = await emailResponse.json();
    console.log('Email sent successfully:', emailData.id);

    return res.status(200).json({
      success: true,
      message: 'Welcome email sent',
      emailId: emailData.id,
    });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function generateWelcomeEmail(name) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to 20Realms Beta</title>
      <style>
        body { font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b0f16; color: #f7efe2; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { font-family: 'Fraunces', Georgia, serif; font-size: 2.5rem; color: #d9a441; margin: 0; font-weight: 700; }
        .content { background: rgba(255, 250, 240, 0.05); border: 1px solid rgba(181, 76, 47, 0.3); border-radius: 12px; padding: 30px; margin-bottom: 30px; }
        .content p { line-height: 1.8; margin: 0 0 16px 0; }
        .content p:last-child { margin-bottom: 0; }
        .content ul { margin: 16px 0; padding-left: 20px; }
        .content li { margin: 8px 0; }
        .cta-button { display: inline-block; background: #b54c2f; color: #fffaf0; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 24px; }
        .cta-button:hover { background: #d4682d; }
        .footer { text-align: center; color: #c9beb0; font-size: 0.9rem; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(247, 239, 226, 0.1); }
        .footer a { color: #d9a441; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome, ${escapeHtml(name)}!</h1>
        </div>

        <div class="content">
          <p>You're officially on the 20Realms beta list!</p>
          
          <p>We'll be keeping you updated on:</p>
          <ul>
            <li>Playtest openings for mobile, PC, and console builds</li>
            <li>New features and mechanics as they're developed</li>
            <li>Exclusive previews of the world as it takes shape</li>
          </ul>

          <p>In the meantime, check out what we're building:</p>

          <a href="https://20realms.net" class="cta-button">Explore 20Realms</a>

          <p style="margin-top: 30px; font-size: 0.95rem;">Questions? <a href="https://20realms.net/contact.html" style="color: #d9a441;">Get in touch with us</a>.</p>
        </div>

        <div class="footer">
          <p>20Realms — Mobile, PC, and Console. Built by Bloodstone Forge.</p>
          <p><a href="https://20realms.net/privacy-cookies.html">Privacy Policy</a> • <a href="https://20realms.net/contact.html">Contact</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
