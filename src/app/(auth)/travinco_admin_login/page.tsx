import { redirect } from 'next/navigation';

export default function RetiredAdminLoginPage({
  searchParams,
}: {
  searchParams: { reason?: string; redirectTo?: string };
}) {
  const query = new URLSearchParams();
  if (searchParams.redirectTo) query.set('redirectTo', searchParams.redirectTo);
  if (searchParams.reason) query.set('reason', searchParams.reason);
  const qStr = query.toString();
  redirect(`/app${qStr ? `?${qStr}` : ''}`);
}
