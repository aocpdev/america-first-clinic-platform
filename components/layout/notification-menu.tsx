"use client";

import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/app/notifications/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function NotificationMenu({
  notifications,
  unreadCount
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  return (
    <details className="group relative">
      <summary
        aria-label="Notifications"
        className={cn(buttonVariants({ size: "icon", variant: "outline" }), "relative cursor-pointer list-none [&::-webkit-details-marker]:hidden")}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-clinic-red px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 top-12 z-50 w-[min(92vw,24rem)] overflow-hidden rounded-[1.35rem] border border-border bg-white shadow-2xl shadow-slate-900/14">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.26em] text-slate-500">Notifications</p>
            <h2 className="mt-1 text-lg font-semibold text-clinic-ink">{unreadCount ? `${unreadCount} unread` : "All caught up"}</h2>
          </div>
          {unreadCount ? (
            <form action={markNotificationsRead}>
              <button className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-clinic-navy transition hover:bg-clinic-mist" type="submit">
                Mark read
              </button>
            </form>
          ) : null}
        </div>
        <div className="max-h-[28rem] overflow-y-auto p-2">
          {notifications.length ? (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "rounded-2xl px-4 py-3 transition hover:bg-clinic-mist",
                  !notification.readAt && "bg-sky-50/70"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn("mt-1 h-2 w-2 rounded-full", notification.readAt ? "bg-slate-300" : "bg-clinic-red")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-clinic-ink">{notification.title}</p>
                      <time className="shrink-0 text-xs font-semibold text-slate-400">{shortDate(notification.createdAt)}</time>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{notification.body}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-bold text-clinic-ink">No notifications yet</p>
              <p className="mt-1 text-sm text-slate-500">Approvals, sales, clinical updates, and commission events will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
