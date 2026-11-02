import { PageHeader, Notice } from "@/components/ui/Panel";
import { WeekGrid } from "@/components/radio/WeekGrid";
import { getPrograms } from "@/lib/queries";
import { config } from "@/lib/config";
import { toStationTime } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const { programs, source } = await getPrograms();
  const now = toStationTime(new Date(), config.timezone);
  return (
    <>
      <PageHeader kicker="24 / 7 · Eastern Time (ET)" title="Weekly schedule"
        intro="All times are Eastern Time and follow daylight saving time. Programming may change for special broadcasts." />
      {source === "defaults" && <div className="mb-4"><Notice tone="warn">Showing the launch schedule — the live station database is not connected.</Notice></div>}
      <WeekGrid programs={programs} nowDay={now.isoDay} nowMinute={now.minute} />
    </>
  );
}
