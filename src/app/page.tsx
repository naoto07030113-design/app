import RecruitingDashboard from '@/components/recruiting-dashboard';
export const dynamic = 'force-dynamic';
export default function Page() { return <RecruitingDashboard url={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}/>; }
