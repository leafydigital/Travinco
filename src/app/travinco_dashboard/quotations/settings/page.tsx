import { redirect } from 'next/navigation';

/** Quotation settings moved to the sidebar Settings page. */
export default function QuotationSettingsRedirectPage() {
  redirect('/travinco_dashboard/settings');
}
