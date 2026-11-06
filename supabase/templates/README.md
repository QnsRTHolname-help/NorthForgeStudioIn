# North Forge Studio – Supabase Email Verification Configuration

This guide details the production configuration for the North Forge Studio Supabase Email Verification System.

---

## 1. Supabase Auth Email Branding Settings

In your **Supabase Dashboard** → **Authentication** → **Email Templates** → **Confirm signup**:

- **Sender Name**: `North Forge Studio`
- **Sender Email**: `north.forge.studio.in@gmail.com`
- **Subject**: `Verify your email address | North Forge Studio`

### Template File
The production-ready HTML template is located at:
`supabase/templates/confirm_signup.html`

Copy and paste the exact contents of `confirm_signup.html` into the **Confirm signup** message body in Supabase.

---

## 2. Supabase Auth URL Configuration

In your **Supabase Dashboard** → **Authentication** → **URL Configuration**:

### Site URL
```
https://northforgestudioin.vercel.app
```

### Redirect URLs (Allowed Callback URLs)
Ensure the following redirect URLs are explicitly added to the whitelist:
```
https://northforgestudioin.vercel.app/auth/callback
https://northforgestudioin.vercel.app/verify/success
https://northforgestudioin.vercel.app/verify/pending
http://localhost:5173/auth/callback
http://localhost:5173/verify/success
http://localhost:5173/verify/pending
```

---

## 3. Template Variables Used

The template utilizes standard Supabase GoTrue variables:

| Variable | Description |
|---|---|
| `{{ .ConfirmationURL }}` | The one-time magic link that confirms the email address and redirects to the configured `emailRedirectTo` (`/auth/callback`). |
| `{{ .Email }}` | The recipient's registered email address. |
| `{{ .Data.name }}` | The user's name provided in `options.data` during registration (when available). |

---

## 4. Security Highlights

1. **Server-Side Session Verification**:
   The verification success page checks the authenticated Supabase session and `user.email_confirmed_at`. Users cannot view the confirmed screen without real verification.
2. **Open-Redirect Hardening**:
   All redirect URLs are strictly validated against `https://northforgestudioin.vercel.app` or safe local paths.
3. **No Secrets in Frontend**:
   All Supabase service role keys and SMTP credentials remain strictly in Supabase server configuration.
4. **Rate Limit & Cooldown**:
   Resend actions enforce a visible 45-second countdown and respect Supabase's `retryAfterSeconds` from `over_email_send_rate_limit`.
