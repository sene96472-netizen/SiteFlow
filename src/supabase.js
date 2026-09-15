import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://usbxnalixpxdbydcjydp.supabase.co/rest/v1/";
const supabaseAnonKey = "sb_publishable_-6Rrw6bEloLH177FN3UiXw_GGOoWzID";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
