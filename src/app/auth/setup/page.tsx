import AccountSetup from '@/components/account-setup';

export default function Page() {
  return <AccountSetup url={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}/>;
}
