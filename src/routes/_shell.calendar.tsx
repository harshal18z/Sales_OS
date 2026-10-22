import { createFileRoute, Link } from "@/lib/router-compat";
import { useMemo } from "react";
import { Calendar, CalendarDays, ExternalLink, Link2, MapPin } from "lucide-react";
import { useMeetings } from "@/hooks/use-data";
import { useCalendarEvents, useConnectCalendar, useGoogleStatus } from "@/hooks/use-google";
import { PageHeader, PrimaryBtn, SkeletonList } from "@/components/app/data-ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/calendar")({
  head: () => ({ meta: [{ title: "Calendar — SalesOS AI" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { data: meetings = [], isLoading } = useMeetings();
  const { data: googleStatus } = useGoogleStatus();
  const connect = useConnectCalendar();
  const period = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 14);
    return { timeMin: now.toISOString(), timeMax: end.toISOString() };
  }, []);
  const googleEvents = useCalendarEvents({ ...period, max: 100 }, !!googleStatus?.calendar);
  const internalUpcoming = useMemo(
    () =>
      (meetings as any[])
        .filter(
          (meeting) => meeting.status !== "cancelled" && new Date(meeting.starts_at) >= new Date(),
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [meetings],
  );
  const externalUpcoming = useMemo(
    () =>
      ((googleEvents.data as any)?.events ?? [])
        .map((event: any) => ({
          ...event,
          starts_at: event.start?.dateTime || event.start?.date,
          source: "Google Calendar",
        }))
        .filter((event: any) => event.starts_at)
        .sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at)),
    [googleEvents.data],
  );
  async function connectCalendar() {
    try {
      await connect.mutateAsync();
      toast.success("Google Calendar connected");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  return (
    <div className="min-h-full">
      <PageHeader
        title="Calendar"
        subtitle="Upcoming sales meetings and calendar events for the next two weeks."
        action={
          !googleStatus?.calendar && (
            <PrimaryBtn onClick={connectCalendar} disabled={connect.isPending}>
              <Link2 className="h-3.5 w-3.5" />
              {connect.isPending ? "Connecting…" : "Connect Google Calendar"}
            </PrimaryBtn>
          )
        }
      />
      <main className="max-w-5xl space-y-5 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="SalesOS meetings" value={internalUpcoming.length} />
          <Stat
            label="Google events"
            value={googleStatus?.calendar ? externalUpcoming.length : "Not connected"}
          />
          <Stat
            label="Calendar sync"
            value={googleStatus?.calendar ? "Connected" : "Disconnected"}
          />
        </div>
        {isLoading || googleEvents.isLoading ? (
          <SkeletonList count={5} />
        ) : internalUpcoming.length + externalUpcoming.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-foreground-subtle" />
            <h2 className="mt-3 text-[14px] font-semibold">No upcoming events</h2>
            <p className="mt-1 text-[12px] text-foreground-muted">
              Schedule a sales meeting or connect Google Calendar to see your events here.
            </p>
            <Link
              to="/meetings"
              className="mt-4 inline-flex text-[12px] text-foreground underline underline-offset-4"
            >
              Open meetings
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {groupByDay([
              ...internalUpcoming.map((m: any) => ({
                ...m,
                starts_at: m.starts_at,
                source: "SalesOS",
              })),
              ...externalUpcoming,
            ]).map(([day, rows]) => (
              <section
                key={day}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Calendar className="h-3.5 w-3.5 text-foreground-muted" />
                  <h2 className="text-[12px] font-semibold">{day}</h2>
                  <span className="text-[10px] text-foreground-subtle">
                    {rows.length} event{rows.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {rows.map((event: any) => (
                    <article key={`${event.source}-${event.id}`} className="flex gap-4 p-4">
                      <div className="w-20 shrink-0 text-[11px] text-foreground-muted">
                        {new Date(event.starts_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[13px] font-medium">
                          {event.title || event.summary || "Untitled meeting"}
                        </h3>
                        <p className="mt-1 text-[11px] text-foreground-subtle">
                          {event.source}
                          {event.status ? ` · ${event.status}` : ""}
                          {event.location ? ` · ${event.location}` : ""}
                        </p>
                        {event.description && (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-foreground-muted">
                            {event.description}
                          </p>
                        )}
                      </div>
                      {event.meeting_url && (
                        <a
                          href={event.meeting_url}
                          target="_blank"
                          rel="noreferrer"
                          className="self-start text-foreground-subtle hover:text-foreground"
                          aria-label="Open meeting link"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {event.location && (
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground-subtle" />
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {!googleStatus?.calendar && (
          <p className="text-[11px] leading-5 text-foreground-subtle">
            Google Calendar connection uses your account’s authorized access. You can disconnect it
            from Integrations.
          </p>
        )}
      </main>
    </div>
  );
}

function groupByDay(events: any[]): [string, any[]][] {
  const map = new Map<string, any[]>();
  for (const event of events) {
    const label = new Date(event.starts_at).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    map.set(label, [...(map.get(label) || []), event]);
  }
  return Array.from(map.entries());
}
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] text-foreground-subtle">{label}</p>
      <p className="mt-2 text-[16px] font-semibold">{value}</p>
    </div>
  );
}
