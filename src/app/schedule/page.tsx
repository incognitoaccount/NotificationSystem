"use client";

// This page shows the main Kanban schedule board.
// It reuses the same implementation that originally lived at the root route.

import Link from "next/link";
import { useEffect, useState } from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  BellRing,
  Calendar,
  Clock,
  Briefcase,
  AlertCircle,
  Plus,
  Loader2,
  CalendarDays,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

type EventType = "deadline" | "meeting" | "business_trip";

interface Event {
  id: number;
  title: string;
  description: string | null;
  event_type: EventType;
  scheduled_at: string;
}

const columnConfig: Record<
  EventType,
  { title: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }
> = {
  deadline: {
    title: "Deadlines",
    icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  meeting: {
    title: "Meetings",
    icon: <CalendarDays className="w-5 h-5 text-sky-600" />,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
  },
  business_trip: {
    title: "Business Trips",
    icon: <Briefcase className="w-5 h-5 text-emerald-600" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
};

export default function SchedulePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("deadline");
  const [scheduledAt, setScheduledAt] = useState("");

  async function loadEvents() {
    try {
      setLoading(true);
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to load events");
      const data: Event[] = await res.json();
      setEvents(data);
    } catch (e) {
      setError("Could not load events. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !scheduledAt) {
      setError("Title and schedule are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, eventType, scheduledAt }),
      });

      if (!res.ok) throw new Error("Failed to create event");

      const created: Event = await res.json();
      setEvents((prev) =>
        [...prev, created].sort(
          (a, b) =>
            new Date(a.scheduled_at).getTime() -
            new Date(b.scheduled_at).getTime()
        )
      );

      setTitle("");
      setDescription("");
      setScheduledAt("");
      setEventType("deadline");
    } catch (e) {
      setError("Could not create event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete event");
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setTitle("");
        setDescription("");
        setScheduledAt("");
        setEventType("deadline");
      }
      if (confirmDeleteId === id) {
        setConfirmDeleteId(null);
      }
    } catch {
      setError("Could not delete event. Please try again.");
    }
  }

  function startEdit(event: Event) {
    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description ?? "");
    const dt = new Date(event.scheduled_at);
    const local = new Date(
      dt.getTime() - dt.getTimezoneOffset() * 60000
    ).toISOString();
    setScheduledAt(local.slice(0, 16));
    setEventType(event.event_type);
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setScheduledAt("");
    setEventType("deadline");
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null) {
      return handleCreate(e);
    }

    setError(null);
    if (!title.trim() || !scheduledAt) {
      setError("Title and schedule are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/events/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          eventType,
          scheduledAt,
        }),
      });
      if (!res.ok) throw new Error("Failed to update event");
      const updated: Event = await res.json();
      setEvents((prev) =>
        prev
          .map((e) => (e.id === updated.id ? updated : e))
          .sort(
            (a, b) =>
              new Date(a.scheduled_at).getTime() -
              new Date(b.scheduled_at).getTime()
          )
      );
      resetForm();
    } catch {
      setError("Could not update event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-700 font-sans selection:bg-sky-200">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-xl border border-sky-200">
              <BellRing className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                NotifyFlow
              </h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide">
                Schedule & Slack Notification System
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-xs font-medium">
            <Link
              href="/home"
              className="px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              Back to Home
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col xl:flex-row gap-8 items-start">
        <aside className="w-full xl:w-80 flex-shrink-0 sticky top-28">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-600" />
                {editingId ? "Edit Event" : "Add New Event"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Schedule a plan to trigger automated Slack alerts.
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Title
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Project Alpha Launch"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Description{" "}
                  <span className="text-slate-400 normal-case font-normal">
                    (Optional)
                  </span>
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 resize-none min-h-[80px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes about this event..."
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Category
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                    value={eventType}
                    onChange={(e) =>
                      setEventType(e.target.value as EventType)
                    }
                    disabled={isSubmitting}
                  >
                    <option value="deadline">Deadlines</option>
                    <option value="meeting">Meetings</option>
                    <option value="business_trip">Business Trips</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg
                      className="h-4 w-4 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Date & Time
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-bold transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>{editingId ? "Update Event" : "Save Event"}</>
                  )}
                </button>
                {editingId !== null && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </aside>

        <section className="flex-1 min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-3 border border-slate-200 rounded-2xl bg-white/50 border-dashed">
              <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
              <p className="text-sm font-medium">Loading your schedule...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(Object.keys(columnConfig) as EventType[]).map((type) => {
                const config = columnConfig[type];
                const columnEvents = events.filter(
                  (e) => e.event_type === type
                );

                return (
                  <div key={type} className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded-lg ${config.bgColor} border ${config.borderColor}`}
                        >
                          {config.icon}
                        </div>
                        <h3 className="font-semibold text-slate-900 tracking-wide">
                          {config.title}
                        </h3>
                      </div>
                      <div className="bg-slate-200 border border-slate-300 px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-600">
                        {columnEvents.length}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {columnEvents.length === 0 ? (
                        <div className="border border-slate-200 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center text-slate-500 bg-white/50">
                          <p className="text-sm">
                            No {config.title.toLowerCase()} planned.
                          </p>
                        </div>
                      ) : (
                        columnEvents.map((event) => {
                          const dateObj = new Date(event.scheduled_at);
                          const past = isPast(dateObj);

                          return (
                            <div
                              key={event.id}
                              className={`group relative bg-white border rounded-2xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                                past
                                  ? "border-rose-300 opacity-80 bg-rose-50/30"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div>
                                  <h4 className="font-semibold text-sm text-slate-900 line-clamp-2 leading-snug">
                                    {event.title}
                                  </h4>
                                  {event.description && (
                                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                      {event.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => startEdit(event)}
                                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmDeleteId(event.id)
                                      }
                                      className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  {past ? (
                                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider border border-rose-200">
                                      Missed
                                    </span>
                                  ) : (
                                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                      {formatDistanceToNow(dateObj, {
                                        addSuffix: true,
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {confirmDeleteId === event.id && (
                                <div className="mt-3 pt-3 border-t border-rose-100 flex items-center justify-between gap-3">
                                  <p className="text-[11px] text-rose-700 font-medium">
                                    Delete this event? This cannot be undone.
                                  </p>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(event.id)}
                                      className="px-2 py-1 text-[11px] rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-3 pt-3 border-t border-slate-100">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{format(dateObj, "MMM d, yyyy")}</span>
                                <span className="mx-1">•</span>
                                <Clock className="w-3.5 h-3.5" />
                                <span>{format(dateObj, "h:mm a")}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

