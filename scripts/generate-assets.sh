#!/usr/bin/env bash
# Regenerates the raster brand assets from public/favicon.svg.
# Requires ImageMagick (`convert`). Deterministic — no external services.
#
#   bash scripts/generate-assets.sh
set -euo pipefail

cd "$(dirname "$0")/.."
FONT_BOLD="${FONT_BOLD:-DejaVu-Sans-Bold}"
FONT_REG="${FONT_REG:-DejaVu-Sans}"

# ── App icons ───────────────────────────────────────────────────
convert -background none public/favicon.svg -resize 192x192 -depth 8 PNG32:public/icon-192.png
convert -background none public/favicon.svg -resize 512x512 -depth 8 PNG32:public/icon-512.png

# ── Open Graph card (1200 × 630) ────────────────────────────────
# Dark editorial card: wordmark, tagline and a brand accent rule.
convert -size 1200x630 \
  gradient:'#0B0D12'-'#111522' \
  -font "$FONT_BOLD" -fill '#F6F7FB' -pointsize 64 \
  -annotate +96+236 "NorthForge" \
  -font "$FONT_REG" -fill '#8A93A6' -pointsize 34 \
  -annotate +96+304 "Websites that don't just look good." \
  -annotate +96+352 "They work." \
  -font "$FONT_REG" -fill '#6B7488' -pointsize 24 \
  -annotate +96+430 "Web · Automation · AI · Growth" \
  -stroke '#2F6BFF' -strokewidth 6 -fill none \
  -draw "line 96,150 420,150" \
  \( public/favicon.svg -resize 96x96 \) -geometry +984+96 -composite \
  -depth 8 PNG32:public/og.png

echo "✓ public/icon-192.png  public/icon-512.png  -depth 8 PNG32:public/og.png"
