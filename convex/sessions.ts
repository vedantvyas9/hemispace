import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const start = mutation({
  args: {
    code: v.string(),
    run: v.union(v.literal("clean"), v.literal("neglect")),
  },
  returns: v.id("sessions"),
  handler: async (ctx, { code, run }) => {
    return await ctx.db.insert("sessions", { code, run, startedAt: Date.now() });
  },
});

export const finish = mutation({
  args: { sessionId: v.id("sessions") },
  returns: v.null(),
  handler: async (ctx, { sessionId }) => {
    await ctx.db.patch("sessions", sessionId, { finishedAt: Date.now() });
    return null;
  },
});

export const listRecent = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("sessions"),
    _creationTime: v.number(),
    code: v.string(),
    run: v.union(v.literal("clean"), v.literal("neglect")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })),
  handler: async (ctx) => {
    return await ctx.db.query("sessions").order("desc").take(50);
  },
});

export const listByCode = query({
  args: { code: v.string() },
  returns: v.array(v.object({
    _id: v.id("sessions"),
    _creationTime: v.number(),
    code: v.string(),
    run: v.union(v.literal("clean"), v.literal("neglect")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })),
  handler: async (ctx, { code }) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_code", (q) => q.eq("code", code))
      .collect();
  },
});
