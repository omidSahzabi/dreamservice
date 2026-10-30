import {getLocale} from 'next-intl/server';
import {redirect} from '@/lib/i18n/navigation';
export default async function RootPage() {
  const locale = await getLocale();
  redirect({href: '/', locale});
}
