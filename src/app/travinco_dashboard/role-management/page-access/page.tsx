import { redirect } from 'next/navigation';

/** Page access is now managed per role — old links go to the Roles page. */
export default function PageAccessRedirect() {
  redirect('/travinco_dashboard/role-management/roles');
}
