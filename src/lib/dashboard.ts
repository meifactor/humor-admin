import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Person = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
};

type FameCaption = {
  id: string;
  text: string;
  generation_id: string;
  image_path: string;
};

export type DailyReactions = { day: string; dead: number; huh: number; funny: number; cringe: number };

export type VibeStats = {
  vibe: string;
  generations: number;
  captions: number;
  reactions: number;
  dead: number;
  funny: number;
  cringe: number;
  huh: number;
  avg_score: number;
};

export type HourlyActivity = { hour: number; reactions: number; generations: number };

// The shape returned by the admin_dashboard() database function (supabase/admin.sql).
export type Dashboard = {
  totals: {
    users: number;
    generations: number;
    captions: number;
    reactions: number;
    dead: number;
    funny: number;
    cringe: number;
    huh: number;
  };
  daily: DailyReactions[];
  vibes: VibeStats[];
  hourly: HourlyActivity[];
  models: { model: string; generations: number }[];
  top_creators: (Person & { generation_count: number; total_score: number })[];
  top_reactors: (Person & { reactions: number })[];
  most_dead: (FameCaption & { count: number })[];
  most_confusing: (FameCaption & { count: number })[];
  most_divisive: (FameCaption & { dead: number; cringe: number })[];
};

export async function getDashboard(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("admin_dashboard");
  return { dashboard: (data as Dashboard | null) ?? null, error };
}
