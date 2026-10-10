import StaffRegistration from '@/components/staff-registration';
export default function Page(){return <StaffRegistration url={process.env.NEXT_PUBLIC_SUPABASE_URL??''} anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??''}/>;}
