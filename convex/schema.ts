import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    code: v.string(),
    run: v.union(v.literal("clean"), v.literal("neglect")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_code", ["code"]),

  // Written at 3 Hz. One row per tick; interpolate in the viewer.
  poses: defineTable({
    sessionId: v.id("sessions"),
    t: v.number(),
    yaw: v.number(),
    pitch: v.number(),
  }).index("by_session", ["sessionId"]),

  finds: defineTable({
    sessionId: v.id("sessions"),
    t: v.number(),
    targetId: v.string(),
    azimuth: v.number(),
  }).index("by_session", ["sessionId"]),
});
