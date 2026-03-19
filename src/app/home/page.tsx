"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  BellRing, 
  ArrowRight, 
  CheckCircle2, 
  CalendarDays, 
  Slack,
  Clock,
  Sparkles,
  AlertCircle
} from "lucide-react";

export default function HomeLanding() {
  const [mounted, setMounted] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-white text-slate-800 font-sans selection:bg-sky-200 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-sky-50 to-white -z-10" />
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-sky-50 blur-3xl opacity-50 -z-10" />
      <div className="absolute top-40 -left-40 w-[500px] h-[500px] rounded-full bg-emerald-50 blur-3xl opacity-50 -z-10" />

      <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-sm shadow-sky-200">
              <BellRing className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                NotifyFlow
              </p>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                Smart Alerts
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-4">
            <Link
              href="/schedule"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-md hover:shadow-slate-200 active:scale-95"
            >
              Schedule an Event
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-32 md:pb-32 grid gap-16 lg:grid-cols-[1.1fr_1fr] items-center relative">
        <div className="space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Never miss a deadline again
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
            Your schedule, seamlessly synced with <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-600">Slack</span>.
          </h1>
          
          <p className="text-base md:text-lg text-slate-600 max-w-xl leading-relaxed">
            NotifyFlow tracks your deadlines, meetings, and business trips. It automatically sends precise alerts to your Slack workspace exactly when you need them.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
            <Link
              href="/schedule"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-8 py-4 text-base font-bold text-white transition-all hover:bg-sky-600 hover:shadow-lg hover:shadow-sky-200 active:scale-95 w-full sm:w-auto"
            >
              Schedule an Event
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="text-sm text-slate-500 font-medium px-2">
              Free to use • No installation
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-8 border-t border-slate-200">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Smart Timing
              </div>
              <p className="text-sm text-slate-600">Alerts at 3d, 24h, 3h, 15m, and exact time.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Missed Follow-ups
              </div>
              <p className="text-sm text-slate-600">Urgent reminders 10m, 1h, and 24h after.</p>
            </div>
          </div>
        </div>

        {/* Interactive Preview Section */}
        <div className="relative w-full max-w-md mx-auto lg:max-w-none">
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-100 to-indigo-50 rounded-[2.5rem] transform rotate-3 scale-105 opacity-50 -z-10" />
          
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col h-[500px]">
            {/* Fake browser header */}
            <div className="h-12 border-b border-slate-100 bg-slate-50/50 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="mx-auto bg-white border border-slate-200 rounded-md h-6 w-1/2 flex items-center justify-center text-[10px] text-slate-400 font-medium">
                notifyflow.app/schedule
              </div>
            </div>

            {/* Interactive Demo Content */}
            <div className="flex-1 p-6 flex flex-col gap-6 relative">
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-sky-500" />
                  Upcoming Event
                </h3>
                <p className="text-sm text-slate-500">How the notification flow works</p>
              </div>

              {/* Demo Event Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-sky-500" />
                <h4 className="font-semibold text-slate-900">Project Launch</h4>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 15 minutes from now
                </p>
              </div>

              {/* Animated Slack Messages */}
              <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4 overflow-hidden relative">
                <div className="absolute top-2 right-4 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <Slack className="w-4 h-4" />
                  #general
                </div>

                <div className="pt-6 space-y-4">
                  {/* Step 0: 3 hours before */}
                  <div className={`transition-all duration-500 transform ${activeStep >= 0 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded bg-sky-500 flex items-center justify-center shrink-0">
                        <BellRing className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">NotifyFlow <span className="text-[10px] text-slate-400 font-normal ml-1">3 hours ago</span></p>
                        <p className="text-sm text-slate-700 mt-0.5">
                          Reminder: You have a meeting today. You have 3 hours left before the meeting.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 1: 15 minutes before */}
                  <div className={`transition-all duration-500 delay-100 transform ${activeStep >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded bg-sky-500 flex items-center justify-center shrink-0">
                        <BellRing className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">NotifyFlow <span className="text-[10px] text-slate-400 font-normal ml-1">Just now</span></p>
                        <p className="text-sm text-slate-700 mt-0.5">
                          Reminder: You have a meeting today. You have 0.25 hours left before the meeting.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Missed deadline */}
                  <div className={`transition-all duration-500 delay-200 transform ${activeStep >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded bg-rose-500 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">NotifyFlow <span className="text-[10px] text-slate-400 font-normal ml-1">In 10 mins</span></p>
                        <div className="mt-0.5 p-2 bg-rose-50 border border-rose-100 rounded-lg">
                          <p className="text-sm text-rose-800 font-medium">
                            Urgent Reminder: You missed the meeting.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fade out bottom to hide cut off text */}
                <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
