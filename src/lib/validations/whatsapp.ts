import { z } from 'zod';

export const whatsappContactSchema = z.object({
  customer_id: z.string().uuid().optional().nullable().or(z.literal('')),
  phone: z.string().min(8, 'Enter a valid phone number').max(20),
  display_name: z.string().max(120).optional().nullable(),
  tags: z.array(z.string()).default([]),
  opt_in: z.boolean().default(false),
});

export type WhatsappContactFormValues = z.infer<typeof whatsappContactSchema>;

export const whatsappTemplateSchema = z.object({
  name: z.string().min(2, 'Name is required').max(120),
  category: z.enum(['marketing', 'utility', 'authentication']).default('marketing'),
  body: z.string().min(5, 'Message body is required'),
});

export type WhatsappTemplateFormValues = z.infer<typeof whatsappTemplateSchema>;

export const whatsappCampaignSchema = z.object({
  name: z.string().min(2, 'Campaign name is required').max(200),
  template_id: z.string().uuid('Select a template'),
  media_url: z.string().url().optional().nullable().or(z.literal('')),
  scheduled_at: z.string().optional().nullable().or(z.literal('')),
  audience_tag: z.string().optional().nullable().or(z.literal('')),
});

export type WhatsappCampaignFormValues = z.infer<typeof whatsappCampaignSchema>;
