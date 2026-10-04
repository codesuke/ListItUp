import { createHash } from "node:crypto";

export type DemoNotificationFlags = {
  readAt: boolean;
  bookmarkedAt: boolean;
  archivedAt: boolean;
};

export type DemoNotificationPlan = {
  assigneeAdded: DemoNotificationFlags;
  stateChanged: DemoNotificationFlags;
  noteAdded: DemoNotificationFlags;
  mentioned: DemoNotificationFlags;
  dueDateReminder: DemoNotificationFlags;
  minutesAgo: {
    assigneeAdded: number;
    stateChanged: number;
    noteAdded: number;
    mentioned: number;
    dueDateReminder: number;
  };
};

// How long ago (in minutes) each seeded notification was "created", before
// rotation below reassigns these across the five slots per User. Spread
// across roughly a day and a half so the Activity feed reads as a string of
// events that happened over time, not one simultaneous batch drop.
export const DEMO_NOTIFICATION_MINUTE_OFFSETS = [5, 95, 340, 720, 1500] as const;

// Three hand-picked read/bookmarked/archived combinations. Every pattern
// still exercises every tab (an unread entry, a read one, a bookmark, an
// archived entry, per #41/#49) — only which notification plays which role
// changes, so a fresh sign-up doesn't see the exact same shape as everyone
// else's Demo Workspace.
const PATTERNS: readonly Omit<DemoNotificationPlan, "minutesAgo">[] = [
  {
    assigneeAdded: { readAt: false, bookmarkedAt: false, archivedAt: false },
    stateChanged: { readAt: true, bookmarkedAt: false, archivedAt: false },
    noteAdded: { readAt: true, bookmarkedAt: true, archivedAt: false },
    mentioned: { readAt: false, bookmarkedAt: false, archivedAt: false },
    dueDateReminder: { readAt: true, bookmarkedAt: false, archivedAt: true },
  },
  {
    assigneeAdded: { readAt: true, bookmarkedAt: false, archivedAt: false },
    stateChanged: { readAt: false, bookmarkedAt: false, archivedAt: false },
    noteAdded: { readAt: false, bookmarkedAt: true, archivedAt: false },
    mentioned: { readAt: true, bookmarkedAt: false, archivedAt: true },
    dueDateReminder: { readAt: true, bookmarkedAt: false, archivedAt: false },
  },
  {
    assigneeAdded: { readAt: false, bookmarkedAt: true, archivedAt: false },
    stateChanged: { readAt: true, bookmarkedAt: false, archivedAt: true },
    noteAdded: { readAt: true, bookmarkedAt: false, archivedAt: false },
    mentioned: { readAt: false, bookmarkedAt: false, archivedAt: false },
    dueDateReminder: { readAt: false, bookmarkedAt: false, archivedAt: false },
  },
];

// Deterministic on userId (not Math.random()) so provisioning stays
// reproducible for a given User and this stays unit-testable without
// flakiness — variety comes from hashing a different id, not from re-rolling
// on every call.
function stableIndex(key: string, modulus: number): number {
  const digest = createHash("sha256").update(key).digest();
  return digest[0] % modulus;
}

export function pickDemoNotificationPlan(userId: string): DemoNotificationPlan {
  const pattern = PATTERNS[stableIndex(userId, PATTERNS.length)];
  const rotation = stableIndex(`${userId}:stagger`, DEMO_NOTIFICATION_MINUTE_OFFSETS.length);
  const offsets = [
    ...DEMO_NOTIFICATION_MINUTE_OFFSETS.slice(rotation),
    ...DEMO_NOTIFICATION_MINUTE_OFFSETS.slice(0, rotation),
  ];

  return {
    ...pattern,
    minutesAgo: {
      assigneeAdded: offsets[0],
      stateChanged: offsets[1],
      noteAdded: offsets[2],
      mentioned: offsets[3],
      dueDateReminder: offsets[4],
    },
  };
}
