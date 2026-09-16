# NorthForge — SEO & analytics setup

Everything in this list is either already built into the site or a one-line
environment variable. Nothing requires code changes.

## 0. Fix email verification links FIRST (Supabase dashboard)

If confirmation emails open `http://localhost:3000/?error=access_denied&error_code=otp_expired`:

1. Supabase dashboard → **Authentication → URL Configuration**
   - **Site URL**: `https://your-production-domain.com`
   - **Redirect URLs**: add your production domain, `https://*-your-team.vercel.app`,
     `http://localhost:5173`
2. **Authentication → Emails → templates**: keep `{{ .ConfirmationURL }}` as the
   action link in the confirmation template.
3. Redeploy and register again — links will now open your domain.
   `otp_expired` specifically means the link was already used (some mail
   providers pre-fetch links; if a fresh resend also fails instantly, switch
   the template's link to `{{ .SiteURL }}/login` style or use the magic-link
   template variant).

The app side already handles this gracefully: expired links show a clear
explanation (no more dead landing), and the register page has a
**"Resend verification email"** button.

## 1. Google Search Console
- Add a **Domain** or **URL-prefix** property for your production domain.
- Choose the **HTML tag** verification method, copy the `content="…"` token.
- Set it as `VITE_GOOGLE_SITE_VERIFICATION` on Vercel (all environments) and
  redeploy. The tag is injected automatically — no code edits.
- Then submit the sitemap (below).

## 2. sitemap.xml (already built)
- `npm run build` generates `dist/sitemap.xml` + `robots.txt` from
  `scripts/generate-sitemap.mjs` (public routes only, portal/admin excluded).
- In Search Console: **Sitemaps → add** `https://your-domain.com/sitemap.xml`.
- Update `VITE_SITE_URL` whenever the domain changes — the sitemap uses it.

## 3. Google Analytics 4
- Create a GA4 property → **Data stream → Web** → copy the measurement ID
  (`G-XXXXXXXXXX`).
- Set `VITE_GA4_ID` on Vercel and redeploy. The gtag loader is injected only
  when the variable is set; page views are tracked on every route change
  (SPA-safe), IPs anonymised.
- Verify with GA4 → **Reports → Realtime** while browsing the deployed site.

## 4. Google Business Profile
- Create/claim your profile at business.google.com with **exactly the same
  name, address, phone (NAP)** as the site footer and the structured data —
  the site uses: NorthForge, Mangaluru (Mangalore), Karnataka, India.
- Add the production website URL to the profile, verify, and add photos +
  service areas. Consistent NAP across the profile, the website schema, and
  the footer is what makes local search trust the listing.

## 5. Meta tags & descriptions (already built)
- `index.html`: title, description, robots, geo tags (`geo.placename` =
  Mangaluru), OpenGraph + Twitter cards with a 1200×630 image.
- Every page sets its own title + description through `usePageMeta`
  (marketing pages indexable; portal/admin are `noIndex`).
- Structured data: `organizationSchema()` emits `ProfessionalService` JSON-LD
  with the Mangaluru address and area served.

## 6. Internal links (already built)
- Footer links to every public page; pricing cards cross-link to the checkout
  (`/contact?plan=…`), the checkout links back to `/pricing#scope`; Home
  anchors (`/#services`, `/#work`) are reachable from the hero and 404 page.
- Rule of thumb going forward: every new page must be reachable from the
  footer or one click from the home page.

## 7. Compress images
- Before adding photos/OG images, compress to WebP where possible and keep
  the OG image under ~300 KB (1200×630 PNG is currently `/og.png`).
- Quick checks: `npx sharp-cli` or https://squoosh.app. Serve via the CDN
  (Vercel does this automatically) and never commit camera originals.

## 8. Backlinks
- Free, legitimate starters: your Google Business Profile, your clients'
  websites ("built by NorthForge" footer link — offer it to every client),
  local Mangaluru business directories, and the WhatsApp/catalog pages you
  already use. Never buy links — Search Console's Links report will show
  progress after the profile + sitemap are live.
