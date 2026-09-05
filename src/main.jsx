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

createRoot(document.getElementById("root")).render(
  <ConvexProvider client={convex}>
    <Root />
  </ConvexProvider>,
);
