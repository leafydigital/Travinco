import { redirect } from 'next/navigation';

/** The Settings page was retired: contact details live in Theme → Contact and terms in Theme → Packages. */
export default function SettingsRedirectPage() {
  redirect('/travinco_dashboard/theme');
}
