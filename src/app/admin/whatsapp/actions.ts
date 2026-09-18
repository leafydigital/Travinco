'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import {
  whatsappContactSchema,
  whatsappTemplateSchema,
  whatsappCampaignSchema,
} from '@/lib/validations/whatsapp';
import { getWhatsappProvider } from '@/lib/whatsapp/provider';
import { revalidatePath } from 'next/cache';

// ---------- CONTACTS ----------

export async function createWhatsappContact(raw: unknown) {
  await requireProfile();
  const parsed = whatsappContactSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase.from('whatsapp_contacts').insert({
    ...parsed.data,
    customer_id: parsed.data.customer_id || null,
    opted_in_at: parsed.data.opt_in ? new Date().toISOString() : null,
  });

  if (error) {
    if (error.code === '23505') return { error: 'A contact with this phone number already exists.' };
    return { error: 'Could not add contact.' };
  }

  revalidatePath('/admin/whatsapp');
  return {};
}

/**
 * Toggles a contact's opt-in status. Recording opted_in_at / opted_out_at
 * is not cosmetic — it's the audit trail that proves consent (or its
 * withdrawal) if that's ever questioned, and the DB trigger in migration
 * 006 refuses to add an opted-out contact to a campaign regardless of
 * what this action does, so consent is enforced at two layers.
 */
export async function setWhatsappOptIn(id: string, optIn: boolean) {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from('whatsapp_contacts')
    .update({
      opt_in: optIn,
      opted_in_at: optIn ? new Date().toISOString() : undefined,
      opted_out_at: !optIn ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (error) return { error: 'Could not update opt-in status.' };
  revalidatePath('/admin/whatsapp');
  return {};
}

export async function deleteWhatsappContact(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('whatsapp_contacts').delete().eq('id', id);
  if (error) return { error: 'Could not delete contact.' };
  revalidatePath('/admin/whatsapp');
  return {};
}

// ---------- TEMPLATES ----------

export async function createWhatsappTemplate(raw: unknown) {
  await requireProfile();
  const parsed = whatsappTemplateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();
  const { error } = await supabase.from('whatsapp_templates').insert(parsed.data);

  if (error) {
    if (error.code === '23505') return { error: 'A template with this name already exists.' };
    return { error: 'Could not create template.' };
  }

  revalidatePath('/admin/whatsapp/templates');
  return {};
}

export async function deleteWhatsappTemplate(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id);
  if (error) return { error: 'Could not delete template — it may be used by an existing campaign.' };
  revalidatePath('/admin/whatsapp/templates');
  return {};
}

// ---------- CAMPAIGNS ----------

export async function createWhatsappCampaign(raw: unknown) {
  const profile = await requireProfile();
  const parsed = whatsappCampaignSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await createClient();

  const { data: campaign, error } = await supabase
    .from('whatsapp_campaigns')
    .insert({
      name: parsed.data.name,
      template_id: parsed.data.template_id,
      media_url: parsed.data.media_url || null,
      scheduled_at: parsed.data.scheduled_at || null,
      audience_filter: parsed.data.audience_tag ? { tag: parsed.data.audience_tag } : {},
      status: parsed.data.scheduled_at ? 'scheduled' : 'draft',
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error || !campaign) return { error: 'Could not create campaign.' };

  // Build the recipient list now from opted-in contacts matching the
  // audience tag (or all opted-in contacts if no tag filter given). The
  // DB trigger still re-verifies opt-in on each insert as a second gate.
  let contactsQuery = supabase.from('whatsapp_contacts').select('id').eq('opt_in', true);
  if (parsed.data.audience_tag) {
    contactsQuery = contactsQuery.contains('tags', [parsed.data.audience_tag]);
  }
  const { data: contacts } = await contactsQuery;

  if (contacts && contacts.length > 0) {
    await supabase
      .from('whatsapp_campaign_recipients')
      .insert(contacts.map((c) => ({ campaign_id: campaign.id, contact_id: c.id })));
  }

  revalidatePath('/admin/whatsapp/campaigns');
  return { id: campaign.id, recipientCount: contacts?.length ?? 0 };
}

export async function deleteWhatsappCampaign(id: string) {
  const profile = await requireProfile();
  if (!['admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Only admins can delete campaigns.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('whatsapp_campaigns').delete().eq('id', id);
  if (error) return { error: 'Could not delete campaign.' };
  revalidatePath('/admin/whatsapp/campaigns');
  return {};
}

/**
 * Sends a campaign through the configured provider (mock by default).
 * Processes recipients sequentially and updates each recipient row's
 * delivery_status as results come back, so the admin can watch progress
 * rather than getting a single all-or-nothing result. Runs as one server
 * action call — fine for the recipient volumes a small agency sends; for
 * very large lists this would move to a background job queue rather than
 * a single request/response cycle.
 */
export async function sendWhatsappCampaign(campaignId: string) {
  await requireProfile();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from('whatsapp_campaigns')
    .select('*, whatsapp_templates(name, body)')
    .eq('id', campaignId)
    .single();

  if (!campaign) return { error: 'Campaign not found.' };
  if (campaign.status === 'sending' || campaign.status === 'completed') {
    return { error: 'This campaign has already been sent or is currently sending.' };
  }

  const { data: recipients } = await supabase
    .from('whatsapp_campaign_recipients')
    .select('id, contact_id, whatsapp_contacts(phone, opt_in)')
    .eq('campaign_id', campaignId)
    .eq('delivery_status', 'pending');

  if (!recipients || recipients.length === 0) {
    return { error: 'No pending recipients to send to.' };
  }

  await supabase.from('whatsapp_campaigns').update({ status: 'sending' }).eq('id', campaignId);

  const provider = getWhatsappProvider();
  const templateRaw = campaign.whatsapp_templates as
    | { name: string; body: string }
    | { name: string; body: string }[]
    | null;
  const template = Array.isArray(templateRaw) ? templateRaw[0] ?? null : templateRaw;

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    const contactRaw = recipient.whatsapp_contacts as
      | { phone: string; opt_in: boolean }
      | { phone: string; opt_in: boolean }[]
      | null;
    const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;

    if (!contact || !contact.opt_in) {
      await supabase
        .from('whatsapp_campaign_recipients')
        .update({ delivery_status: 'opted_out' })
        .eq('id', recipient.id);
      continue;
    }

    const result = await provider.sendMessage({
      to: contact.phone,
      templateName: template?.name,
      body: template?.body,
      mediaUrl: campaign.media_url ?? undefined,
    });

    if (result.status === 'sent') {
      sentCount += 1;
      await supabase
        .from('whatsapp_campaign_recipients')
        .update({
          delivery_status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: result.providerMessageId,
        })
        .eq('id', recipient.id);
    } else {
      failedCount += 1;
      await supabase
        .from('whatsapp_campaign_recipients')
        .update({ delivery_status: 'failed', failure_reason: result.failureReason })
        .eq('id', recipient.id);
    }
  }

  await supabase
    .from('whatsapp_campaigns')
    .update({ status: 'completed', sent_count: sentCount, failed_count: failedCount })
    .eq('id', campaignId);

  revalidatePath(`/admin/whatsapp/campaigns/${campaignId}`);
  revalidatePath('/admin/whatsapp/campaigns');
  return { sentCount, failedCount };
}
