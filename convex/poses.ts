import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Written at 3 Hz from the client — see CONTRACT.md. Do not raise that rate.
export const record = mutation({
  args: {
    sessionId: v.id("sessions"),
    t: v.number(),
    yaw: v.number(),
    pitch: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("poses", args);
    return null;
  },
});
