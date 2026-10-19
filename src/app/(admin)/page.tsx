import Image from "next/image";
import Link from "next/link";
import { DailyReactionsChart, HourlyChart, Legend, type Series } from "@/components/charts";
import { Panel, StatTile, TableView } from "@/components/panel";
import { requireSuperadmin } from "@/lib/admin";
import { getDashboard, type Dashboard } from "@/lib/dashboard";
import { REACTIONS } from "@/lib/reactions";
import { avatarUrl, fullName, uploadUrl } from "@/lib/storage";
import { getVibe } from "@/lib/vibes";

const REACTION_SERIES: Series[] = REACTIONS.map((r) => ({
  key: r.id,
  label: `${r.emoji} ${r.label}`,
  color: r.chartColor,
}));

const SINGLE_SERIES_COLOR = "#3987e5";

const tableClass = "w-full text-left text-sm [&_td]:px-3 [&_td]:py-1.5 [&_th]:px-3 [&_th]:py-2 [&_thead]:bg-panel-2";

function percent(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : "0%";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayLabel(day: string) {
  const [, month, date] = day.split("-").map(Number);
  return `${MONTHS[month - 1]} ${date}`;
}

export default async function DashboardPage() {
  const { supabase } = await requireSuperadmin();
  const { dashboard, error } = await getDashboard(supabase);

  if (error || !dashboard) {
    return (
      <p className="rounded-md border border-mta-red p-4 text-red-300">
        Could not load the dashboard: {error?.message ?? "no data"}. Has <code>supabase/admin.sql</code> been run?
      </p>
    );
  }

  const { totals } = dashboard;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-ink-3">Live from the Humor Project database. Times are New York time.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Users" value={totals.users.toLocaleString()} />
        <StatTile label="Photos" value={totals.generations.toLocaleString()} />
        <StatTile label="AI captions" value={totals.captions.toLocaleString()} />
        <StatTile label="Reactions" value={totals.reactions.toLocaleString()} />
        <StatTile label="💀 Dead rate" value={percent(totals.dead, totals.reactions)} note="of all reactions" />
        <StatTile
          label="😬🤨 Miss rate"
          value={percent(totals.cringe + totals.huh, totals.reactions)}
          note="cringe or doesn't make sense"
        />
      </div>

      <ReactionMix dashboard={dashboard} />
      <VibeShowdown dashboard={dashboard} />
      <HallOfFame dashboard={dashboard} />
      <CommunityHealth dashboard={dashboard} />
    </div>
  );
}

function ReactionMix({ dashboard }: { dashboard: Dashboard }) {
  const { totals, daily } = dashboard;
  return (
    <Panel title="Reaction mix over time" subtitle="Reactions per day, last 30 days" aside={<Legend series={REACTION_SERIES} />}>
      <DailyReactionsChart data={daily} series={REACTION_SERIES} />
      <ul className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {REACTIONS.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-ink-2">
            <span aria-hidden className="h-3 w-3 rounded-sm" style={{ backgroundColor: r.chartColor }} />
            {r.emoji} {r.label}
            <span className="ml-auto font-bold text-white tabular-nums">
              {totals[r.id].toLocaleString()} · {percent(totals[r.id], totals.reactions)}
            </span>
          </li>
        ))}
      </ul>
      <TableView>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Day</th>
              {REACTIONS.map((r) => (
                <th key={r.id}>{r.emoji}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...daily].reverse().map((d) => (
              <tr key={d.day} className="border-t border-edge">
                <td>{dayLabel(d.day)}</td>
                {REACTIONS.map((r) => (
                  <td key={r.id} className="tabular-nums">{d[r.id]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
    </Panel>
  );
}

function VibeShowdown({ dashboard }: { dashboard: Dashboard }) {
  const vibes = dashboard.vibes;
  const maxAbs = Math.max(0.5, ...vibes.map((v) => Math.abs(Number(v.avg_score))));

  return (
    <Panel
      title="Vibe showdown"
      subtitle="Average score per caption (💀 ×2 + 😂 − 🤨) and how people react to each caption vibe"
      aside={<Legend series={REACTION_SERIES} />}
    >
      {vibes.length === 0 ? (
        <p className="text-ink-3">No photos yet.</p>
      ) : (
        <ol className="space-y-4">
          {vibes.map((v, index) => {
            const vibe = getVibe(v.vibe);
            const score = Number(v.avg_score);
            const width = `${(Math.abs(score) / maxAbs) * 50}%`;
            return (
              <li key={v.vibe} className="grid gap-2 md:grid-cols-[14rem_1fr_1fr] md:items-center">
                <div>
                  <p className="font-bold">
                    {index === 0 && v.reactions > 0 && <span className="mr-1" aria-label="Leader">🏆</span>}
                    {vibe.emoji} {vibe.label}
                  </p>
                  <p className="text-xs text-ink-3">
                    {v.generations} photos · {v.reactions} reactions · {percent(v.dead, v.reactions)} 💀
                  </p>
                </div>

                {/* Average score: bars grow left (negative) or right (positive) from zero. */}
                <div className="flex items-center gap-2" title={`Average score ${score}`}>
                  <div className="relative h-5 flex-1">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-edge" aria-hidden />
                    <div
                      className={`absolute inset-y-0.5 ${score >= 0 ? "left-1/2 rounded-r" : "right-1/2 rounded-l"}`}
                      style={{ width, backgroundColor: SINGLE_SERIES_COLOR }}
                    />
                  </div>
                  <span className="w-12 text-right font-bold tabular-nums">{score.toFixed(2)}</span>
                </div>

                {/* Reaction mix: 100% stacked bar with 2px gaps. */}
                <div className="flex h-5 gap-[2px] overflow-hidden rounded" aria-label="Reaction mix">
                  {v.reactions === 0 ? (
                    <div className="flex-1 rounded bg-panel-2" />
                  ) : (
                    REACTIONS.filter((r) => v[r.id] > 0).map((r) => (
                      <div
                        key={r.id}
                        title={`${r.emoji} ${r.label}: ${v[r.id]} (${percent(v[r.id], v.reactions)})`}
                        style={{ flexGrow: v[r.id], backgroundColor: r.chartColor }}
                      />
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <TableView>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Vibe</th>
              <th>Photos</th>
              <th>Avg score</th>
              {REACTIONS.map((r) => (
                <th key={r.id}>{r.emoji}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vibes.map((v) => (
              <tr key={v.vibe} className="border-t border-edge">
                <td>{getVibe(v.vibe).label}</td>
                <td className="tabular-nums">{v.generations}</td>
                <td className="tabular-nums">{Number(v.avg_score).toFixed(2)}</td>
                {REACTIONS.map((r) => (
                  <td key={r.id} className="tabular-nums">{v[r.id]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
    </Panel>
  );
}

type FameItem = { id: string; text: string; generation_id: string; image_path: string; stat: string };

function FameList({ title, emptyText, items }: { title: string; emptyText: string; items: FameItem[] }) {
  return (
    <div>
      <h3 className="mb-3 font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">{emptyText}</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/media/${item.generation_id}`} className="group flex gap-3">
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-black">
                  <Image src={uploadUrl(item.image_path)} alt="" fill unoptimized className="object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm group-hover:underline">{item.text}</span>
                  <span className="text-xs font-bold text-ink-3">{item.stat}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function HallOfFame({ dashboard }: { dashboard: Dashboard }) {
  return (
    <Panel title="Hall of fame & shame" subtitle="All time. Click a caption to manage its photo.">
      <div className="grid gap-6 md:grid-cols-3">
        <FameList
          title="💀 Most deadly"
          emptyText="Nobody has died laughing yet."
          items={dashboard.most_dead.map((c) => ({ ...c, stat: `${c.count} 💀` }))}
        />
        <FameList
          title="🤨 Most confusing"
          emptyText="Everything has made sense so far."
          items={dashboard.most_confusing.map((c) => ({ ...c, stat: `${c.count} 🤨` }))}
        />
        <FameList
          title="⚖️ Most divisive"
          emptyText="No caption has split the room (needs both 💀 and 😬)."
          items={dashboard.most_divisive.map((c) => ({ ...c, stat: `${c.dead} 💀 vs ${c.cringe} 😬` }))}
        />
      </div>
    </Panel>
  );
}

function PersonList({
  title,
  people,
}: {
  title: string;
  people: { user_id: string; first_name: string | null; last_name: string | null; avatar_path: string | null; stat: string }[];
}) {
  return (
    <div>
      <h3 className="mb-3 font-bold">{title}</h3>
      {people.length === 0 ? (
        <p className="text-sm text-ink-3">No one yet.</p>
      ) : (
        <ol className="space-y-2">
          {people.map((p, index) => {
            const avatar = avatarUrl(p.avatar_path);
            return (
              <li key={p.user_id} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-ink-3 tabular-nums">{index + 1}</span>
                {avatar ? (
                  <Image src={avatar} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-panel-2 text-xs font-bold">
                    {fullName(p).charAt(0)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{fullName(p)}</span>
                <span className="font-bold tabular-nums">{p.stat}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function CommunityHealth({ dashboard }: { dashboard: Dashboard }) {
  const totalGenerations = dashboard.models.reduce((sum, m) => sum + Number(m.generations), 0);
  const maxModel = Math.max(1, ...dashboard.models.map((m) => Number(m.generations)));

  return (
    <Panel title="Community & AI health" subtitle="Who drives the app, when it's busy, and which AI model did the writing">
      <div className="grid gap-6 md:grid-cols-2">
        <PersonList
          title="Top creators (total caption score)"
          people={dashboard.top_creators.map((p) => ({ ...p, stat: String(p.total_score) }))}
        />
        <PersonList
          title="Most active reactors"
          people={dashboard.top_reactors.map((p) => ({ ...p, stat: `${p.reactions} reactions` }))}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-bold">Reactions by hour</h3>
          <HourlyChart data={dashboard.hourly} metric="reactions" label="Reactions" color={SINGLE_SERIES_COLOR} />
        </div>
        <div>
          <h3 className="font-bold">Photos captioned by hour</h3>
          <HourlyChart data={dashboard.hourly} metric="generations" label="Photos" color={SINGLE_SERIES_COLOR} />
        </div>
      </div>
      <TableView>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Hour</th>
              <th>Reactions</th>
              <th>Photos</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.hourly.map((h) => (
              <tr key={h.hour} className="border-t border-edge">
                <td>{`${h.hour % 12 || 12}${h.hour < 12 ? " AM" : " PM"}`}</td>
                <td className="tabular-nums">{h.reactions}</td>
                <td className="tabular-nums">{h.generations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>

      <div className="mt-8">
        <h3 className="font-bold">Which Gemini model wrote the captions</h3>
        <p className="mb-3 text-sm text-ink-3">
          The app falls back to other models when the main one is busy or out of free quota.
        </p>
        {dashboard.models.length === 0 ? (
          <p className="text-sm text-ink-3">No photos yet.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.models.map((m) => (
              <li key={m.model} className="grid grid-cols-[12rem_1fr_5rem] items-center gap-3 text-sm">
                <code className="truncate text-ink-2">{m.model}</code>
                <div className="h-4">
                  <div
                    className="h-full rounded-r"
                    style={{ width: `${(Number(m.generations) / maxModel) * 100}%`, backgroundColor: SINGLE_SERIES_COLOR }}
                  />
                </div>
                <span className="text-right font-bold tabular-nums">
                  {m.generations} · {percent(Number(m.generations), totalGenerations)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
