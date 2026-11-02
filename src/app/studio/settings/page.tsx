import { PageHeader, Panel, Notice } from "@/components/ui/Panel";
import { SettingsForm } from "@/components/studio/SettingsForm";
import { requirePagePermission } from "@/lib/session";
import { db, requireStation } from "@/lib/db";
import { computeRotationReport } from "@/lib/rotation";
import { engine } from "@/lib/azuracast/client";
import { integrations } from "@/lib/config";

export const metadata = { title: "Station settings" };

export default async function SettingsPage() {
  await requirePagePermission("settings.rotation");
  const station = await requireStation();
  const goals = { caprio: station.rotationCaprioPct, independent: station.rotationIndiePct, guest: station.rotationGuestPct };
  let report = null;
  let err: string | null = null;
  if (integrations.azuracastAdmin()) {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 86400_000);
      const history = await engine().history(start, end);
      const library = await db.track.findMany({ where: { stationId: station.id }, select: { title: true, artistName: true, category: true, azuracastMediaId: true } });
      report = computeRotationReport(history.map((h) => ({ title: h.song.title, artist: h.song.artist, durationSec: h.duration })), library, goals);
    } catch (e) { err = (e as Error).message; }
  }
  const rows = report ? ([["Caprio Jackson", "CAPRIO", goals.caprio], ["Independent / AI", "INDEPENDENT", goals.independent], ["Guest / promo", "GUEST", goals.guest]] as const) : [];
  return (
    <div className="space-y-4">
      <PageHeader kicker="Station" title="Settings & rotation" />
      <Panel title="Rotation goals">
        <SettingsForm initial={{ ...goals, showListenerCount: station.showListenerCount }} />
      </Panel>
      <Panel title="Actual airtime · last 7 days" kicker="From AzuraCast play history">
        {!integrations.azuracastAdmin() && <p className="text-sm text-[var(--color-muted)]">Connect the AzuraCast admin API to measure real airtime against these goals.</p>}
        {err && <Notice tone="error">{err}</Notice>}
        {report && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-muted)]">{report.plays} plays · {(report.totalSec / 3600).toFixed(1)} h total · {(report.unmatchedSec / 3600).toFixed(1)} h could not be matched to library tracks (excluded from percentages).</p>
            {rows.map(([label, key, goal]) => (
              <div key={key}>
                <div className="flex justify-between text-sm"><span>{label}</span><span className="font-mono">{report.actual[key]}% <span className="text-[var(--color-muted)]">/ goal {goal}% ({report.variance[key] >= 0 ? "+" : ""}{report.variance[key]})</span></span></div>
                <div className="relative mt-1 h-2 rounded bg-black/50">
                  <div className="h-2 rounded bg-[var(--color-signal)]" style={{ width: `${report.actual[key]}%` }} />
                  <div className="absolute top-[-3px] h-3.5 w-0.5 bg-[var(--color-gold)]" style={{ left: `${goal}%` }} aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
