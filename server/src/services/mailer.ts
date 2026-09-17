/**
 * Mail delivery for the self-hosted stack.
 *
 * With SMTP configured (SMTP_HOST / SMTP_USER / SMTP_PASS) mail is sent
 * for real via nodemailer. Without it, nothing is silently dropped: every
 * message is written to the `email_outbox` table so it can be inspected,
 * and the caller knows delivery did not happen.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { db, newId, nowIso } from '../db';
import { env, mailEnabled } from '../env';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!mailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: string;
}

/** Persists the message so every attempt is auditable, sent or not. */
function recordOutbox(message: MailMessage, status: 'sent' | 'queued', error?: string) {
  try {
    db.prepare(
      `INSERT INTO email_outbox (id, to_email, subject, body, template, status, transport, error, meta, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`,
    ).run(
      newId('ml'),
      message.to,
      message.subject,
      message.text,
      message.template ?? null,
      status,
      status === 'sent' ? 'smtp' : 'none',
      error ?? null,
      nowIso(),
      status === 'sent' ? nowIso() : null,
    );
  } catch {
    /* outbox is a best-effort audit trail — never break the caller */
  }
}

export async function sendMail(message: MailMessage): Promise<{ sent: boolean }> {
  const tx = getTransporter();
  if (!tx) {
    recordOutbox(message, 'queued');
    return { sent: false };
  }
  try {
    await tx.sendMail({
      from: env.smtp.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    recordOutbox(message, 'sent');
    return { sent: true };
  } catch (error) {
    recordOutbox(message, 'queued', error instanceof Error ? error.message : String(error));
    return { sent: false };
  }
}

/* ── Branded templates ─────────────────────────────────────────── */

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;padding:32px 0;font-family:Georgia,serif;color:#1f1b16">
  <div style="max-width:520px;margin:0 auto;background:#fffdf9;border:1px solid #e7dfd2;border-radius:12px;padding:36px">
    <div style="font-size:16px;font-weight:700;letter-spacing:.18em">NORTHFORGE</div>
    <div style="font-size:20px;font-weight:600;margin:20px 0 10px">${title}</div>
    ${bodyHtml}
    <p style="font-size:12px;color:#8a7f6f;margin-top:28px">NorthForge Studio — client operations platform. If you did not expect this email, ignore it.</p>
  </div></body></html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#1f1b16;color:#faf7f2;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;margin:14px 0">${label}</a>`;
}

export function verificationEmail(to: string, url: string) {
  return sendMail({
    to,
    subject: 'Confirm your NorthForge account',
    template: 'verify_email',
    text: `Welcome to NorthForge. Confirm your email to activate your workspace:\n\n${url}\n\nThis link expires in 24 hours.`,
    html: shell(
      'Confirm your email.',
      `<p style="font-size:14px;line-height:1.6">Welcome to NorthForge. Confirm your email to activate your business workspace.</p>${button(url, 'Confirm email')}<p style="font-size:12px;color:#8a7f6f">Or paste this link into your browser: ${url}</p>`,
    ),
  });
}

export function resetEmail(to: string, url: string) {
  return sendMail({
    to,
    subject: 'Reset your NorthForge password',
    template: 'reset_password',
    text: `Reset your NorthForge password:\n\n${url}\n\nThis link expires in 30 minutes and can be used once.`,
    html: shell(
      'Reset your password.',
      `<p style="font-size:14px;line-height:1.6">Someone (hopefully you) asked to reset this account's password. The link below is valid for 30 minutes and works once.</p>${button(url, 'Reset password')}<p style="font-size:12px;color:#8a7f6f">Or paste this link into your browser: ${url}</p>`,
    ),
  });
}
