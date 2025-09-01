import { createClient } from '@supabase/supabase-js'


// HANYA dipakai di server (Service Role)
export const supabaseAdmin = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
)