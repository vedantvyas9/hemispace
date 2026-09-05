import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL;
export const convex = url ? new ConvexReactClient(url) : null;
