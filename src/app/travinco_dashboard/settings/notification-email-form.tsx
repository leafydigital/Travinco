'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, Check, Send, RefreshCw } from 'lucide-react';
import { saveNotificationEmailAction, sendTestNotificationEmailAction } from './actions';

export function NotificationEmailForm({
  initialEmail = 'travinco2026@gmail.com',
  isAdmin = true,
}: {
  initialEmail?: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveNotificationEmailAction(email);
      if (res.success) {
        toast.success(`Admin alert email saved as: ${res.email || email}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update notification email.');
      }
    } catch {
      toast.error('An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address first.');
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await sendTestNotificationEmailAction(email);
      if (res.success) {
        toast.success(`Test email sent to ${email}! Please check your inbox.`);
      } else {
        toast.error(res.error || 'Failed to send test email.');
      }
    } catch {
      toast.error('An unexpected error occurred while sending test email.');
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-brand-50/60 border border-brand-100 p-4 text-xs text-brand-900 leading-relaxed">
        <p>
          When a traveler submits a booking request through <strong className="font-semibold">&quot;Book with us&quot;</strong> or sends a message from the <strong className="font-semibold">Contact page</strong>, an instant email alert with customer contact information, requested dates, and trip details is automatically dispatched to this address.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
            disabled={isSaving || !isAdmin}
            className="input pl-10 h-10 text-xs sm:text-sm rounded-xl font-medium"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary inline-flex items-center gap-1.5 h-10 px-4 text-xs font-semibold rounded-xl shadow-xs shrink-0 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Email</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={isSendingTest}
              title="Send a sample email to verify delivery"
              className="inline-flex items-center gap-1.5 h-10 px-3.5 text-xs font-semibold rounded-xl border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition shadow-xs shrink-0 cursor-pointer"
            >
              {isSendingTest ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand-600" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 text-brand-600" />
                  <span>Test Email</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
