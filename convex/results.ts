import { query } from "./_generated/server";
import { v } from "convex/values";

// Everything needed to render one session in the live view: the session row
// plus its full pose trace and find events, keyed for the neglect vs. clean
// comparison chart.
export const forSession = query({
  args: { sessionId: v.id("sessions") },
  returns: v.union(
    v.null(),
    v.object({
      session: v.object({
        _id: v.id("sessions"),
        _creationTime: v.number(),
        code: v.string(),
        run: v.union(v.literal("clean"), v.literal("neglect")),
        startedAt: v.number(),
        finishedAt: v.optional(v.number()),
      }),
      poses: v.array(v.object({
        _id: v.id("poses"),
        _creationTime: v.number(),
        sessionId: v.id("sessions"),
        t: v.number(),
        yaw: v.number(),
        pitch: v.number(),
      })),
      finds: v.array(v.object({
        _id: v.id("finds"),
        _creationTime: v.number(),
        sessionId: v.id("sessions"),
        t: v.number(),
        targetId: v.string(),
        azimuth: v.number(),
      })),
    }),
  ),
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get("sessions", sessionId);
    if (!session) return null;
    const [poses, finds] = await Promise.all([
      ctx.db.query("poses").withIndex("by_session", (q) => q.eq("sessionId", sessionId)).collect(),
      ctx.db.query("finds").withIndex("by_session", (q) => q.eq("sessionId", sessionId)).collect(),
    ]);
    return { session, poses, finds };
  },
});

// One row per (clean, neglect) pair sharing a participant code, for the
// results-view table.
export const forCode = query({
  args: { code: v.string() },
  returns: v.array(v.object({
    session: v.object({
      _id: v.id("sessions"),
      _creationTime: v.number(),
      code: v.string(),
      run: v.union(v.literal("clean"), v.literal("neglect")),
      startedAt: v.number(),
      finishedAt: v.optional(v.number()),
    }),
    poseCount: v.number(),
    findCount: v.number(),
  })),
  handler: async (ctx, { code }) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q) => q.eq("code", code))
      .collect();
    return await Promise.all(
      sessions.map(async (session) => {
        const [poses, finds] = await Promise.all([
          ctx.db.query("poses").withIndex("by_session", (q) => q.eq("sessionId", session._id)).collect(),
          ctx.db.query("finds").withIndex("by_session", (q) => q.eq("sessionId", session._id)).collect(),
        ]);
        return { session, poseCount: poses.length, findCount: finds.length };
      }),
    );
  },
});
