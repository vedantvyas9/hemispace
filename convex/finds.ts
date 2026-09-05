import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    sessionId: v.id("sessions"),
    t: v.number(),
    targetId: v.string(),
    azimuth: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("finds", args);
    return null;
  },
});
