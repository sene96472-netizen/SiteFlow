import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "_URL";
const supabaseAnonKey = "CLE_ANON";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
