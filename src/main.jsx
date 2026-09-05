import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { convex } from "./convexClient";
import App from "./App";
import Results from "./Results";
import "./styles.css";

function Root() {
  const [showResults, setShowResults] = useState(location.hash === "#results");
  useEffect(() => {
    const onHash = () => setShowResults(location.hash === "#results");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return showResults ? <Results /> : <App />;
}

// The spectator view needs Convex; the experience itself does not. Without a
// deployment URL the app still runs, so a missing env var can never be the
// thing that breaks a demo.
const root = createRoot(document.getElementById("root"));
root.render(
  convex ? <ConvexProvider client={convex}><Root /></ConvexProvider> : <App />
);
