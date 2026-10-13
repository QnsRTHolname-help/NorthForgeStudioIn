import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleEnquiryRelayRequest } from '../shared/enquiryRelay';

/**
 * Vercel Serverless Function for `POST /api/enquiries`.
 *
 * Ensures that production deployments on Vercel have the exact same server-side
 * enquiry relay as the local Vite dev/preview server.
 */
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  await handleEnquiryRelayRequest(req, res, { supabaseUrl, secretKey });
}
