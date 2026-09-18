import { verifyEnquiryEmailOtp } from '@/lib/enquiry-otp';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) {
  const { token, email } = searchParams;
  const result =
    token && email ? await verifyEnquiryEmailOtp(email, token) : { error: 'Missing verification link details.' };

  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center pt-32 pb-12">
      <div className="max-w-sm text-center">
        {result.verified ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-brand-600" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">Email verified</h1>
            <p className="mt-2 text-sm text-ink-500">
              You&apos;re all set — go back to the form you were filling in and submit it now.
            </p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-12 w-12 text-coral-500" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">
              Couldn&apos;t verify this link
            </h1>
            <p className="mt-2 text-sm text-ink-500">{result.error}</p>
          </>
        )}
        <Link href="/" className="btn-outline mt-6 inline-flex">
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
