import { z } from 'zod';
import { fieldErrors, badRequest } from './http';

/** Parses a body and converts failures into a 400 with per-field messages. */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw badRequest('Please check the highlighted fields.', fieldErrors(result.error));
  }
  return result.data;
}

export const email = z.string().trim().toLowerCase().email('Enter a valid email address.');
export const password = z.string().min(8, 'Use at least 8 characters.');
export const optionalText = z.string().trim().max(2000).optional().nullable();
export const idParam = z.object({ id: z.string().min(1) });

export const leadStatuses = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'] as const;
export const leadSources = ['website', 'whatsapp', 'referral', 'outreach', 'manual', 'call', 'other'] as const;
export const taskStatuses = ['todo', 'in_progress', 'review', 'done'] as const;
export const priorities = ['low', 'medium', 'high', 'urgent'] as const;
export const projectStages = ['discovery', 'design', 'development', 'review', 'launch', 'optimization'] as const;
export const requestTypes = ['website_change', 'content_change', 'technical_issue', 'automation', 'general'] as const;
export const requestStatuses = ['open', 'in_progress', 'blocked', 'resolved', 'closed'] as const;
export const ticketStatuses = ['open', 'pending', 'resolved', 'closed'] as const;
export const workflowNodeTypes = [
  'trigger',
  'condition',
  'ai',
  'action',
  'notification',
  'whatsapp',
  'delay',
  'update_record',
  'create_task',
  'book_appointment',
] as const;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean().optional(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(80),
  email,
  password,
  businessName: z.string().trim().min(2, 'Enter your business name.').max(120),
  phone: z.string().trim().max(24).optional().or(z.literal('')),
  businessType: z.string().trim().max(80).optional().or(z.literal('')),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  businessName: z.string().trim().min(2, 'Enter your business name.').max(120),
  email,
  phone: z.string().trim().min(6, 'Enter a reachable phone or WhatsApp number.').max(24),
  businessType: z.string().trim().min(2, 'Select a business type.').max(80),
  currentTools: z.string().trim().max(400).optional().or(z.literal('')),
  slowestProcess: z.string().trim().max(600).optional().or(z.literal('')),
  monthlyEnquiries: z.string().trim().max(40).optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  /** Honeypot — bots fill it, humans never see it. */
  website: z.string().max(0).optional().or(z.literal('')),
});

export const leadCreateSchema = z.object({
  contactName: z.string().trim().min(2, 'Enter a contact name.').max(120),
  businessName: z.string().trim().max(120).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  phone: z.string().trim().max(24).optional().or(z.literal('')),
  source: z.enum(leadSources).default('website'),
  status: z.enum(leadStatuses).default('new'),
  value: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  nextAction: z.string().trim().max(240).optional().or(z.literal('')),
  clientId: z.string().optional().nullable(),
});

export const leadUpdateSchema = leadCreateSchema.partial().extend({
  score: z.coerce.number().int().min(0).max(100).optional(),
  intent: z.string().trim().max(120).optional().nullable(),
});

export const clientCreateSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter a business name.').max(120),
  contactName: z.string().trim().min(2, 'Enter a contact name.').max(120),
  email,
  phone: z.string().trim().max(24).optional().or(z.literal('')),
  businessType: z.string().trim().max(80).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  state: z.string().trim().max(80).optional().or(z.literal('')),
  planId: z.string().optional().nullable(),
  status: z.enum(['lead', 'onboarding', 'active', 'paused', 'churned']).default('lead'),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(2, 'Enter a task title.').max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  status: z.enum(taskStatuses).default('todo'),
  priority: z.enum(priorities).default('medium'),
  projectId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  dueDate: z.string().max(24).optional().nullable(),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2, 'Enter a project name.').max(160),
  clientId: z.string().min(1, 'Choose a client.'),
  stage: z.enum(projectStages).default('discovery'),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).default('planning'),
  dueDate: z.string().max(24).optional().nullable(),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const requestCreateSchema = z.object({
  title: z.string().trim().min(3, 'Give your request a short title.').max(160),
  description: z.string().trim().min(5, 'Describe what you need.').max(3000),
  type: z.enum(requestTypes).default('general'),
  priority: z.enum(priorities).default('medium'),
});

export const ticketCreateSchema = z.object({
  subject: z.string().trim().min(3, 'Enter a subject.').max(160),
  message: z.string().trim().min(5, 'Describe the issue.').max(3000),
  priority: z.enum(priorities).default('medium'),
  category: z.string().trim().max(60).optional().or(z.literal('')),
});

export const bookingCreateSchema = z.object({
  customerName: z.string().trim().min(2, 'Enter the customer name.').max(120),
  customerPhone: z.string().trim().max(24).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  service: z.string().trim().max(120).optional().or(z.literal('')),
  startsAt: z.string().min(4, 'Choose a date and time.'),
  durationMins: z.coerce.number().int().min(15).max(480).default(30),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const workflowCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name the workflow.').max(120),
  description: z.string().trim().max(600).optional().or(z.literal('')),
  trigger: z.string().trim().max(80).default('lead.created'),
  status: z.enum(['draft', 'active', 'paused', 'error']).default('draft'),
});

export const workflowNodeSchema = z.object({
  type: z.enum(workflowNodeTypes),
  label: z.string().trim().min(1).max(120),
  config: z.record(z.unknown()).default({}),
  x: z.coerce.number().int().min(0).max(4000).default(0),
  y: z.coerce.number().int().min(0).max(4000).default(0),
});

export const subscriptionCreateSchema = z.object({
  clientId: z.string().min(1),
  planId: z.string().min(1),
  status: z.enum(['trialing', 'active', 'past_due', 'paused', 'cancelled']).default('active'),
});

export const onboardingSaveSchema = z.object({
  currentStep: z.coerce.number().int().min(0).max(20).default(0),
  completed: z.boolean().default(false),
  data: z.record(z.unknown()).default({}),
  clientId: z.string().optional().nullable(),
});

export const aiChatSchema = z.object({
  scope: z.enum(['public', 'client', 'admin']),
  message: z.string().trim().min(1).max(1500),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string().max(3000) }))
    .max(20)
    .default([]),
  /** Client-side hint only. The server re-derives scope from the session. */
  context: z.string().max(120).optional(),
});

export const aiActionSchema = z.object({
  actionId: z.string().min(1).max(80),
  payload: z.record(z.unknown()).default({}),
  confirmed: z.boolean(),
});

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password,
});
