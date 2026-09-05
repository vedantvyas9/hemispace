import { useState } from "react";
import Experience from "./Experience";
import Training from "./Training";

export default function App() {
  const [mode, setMode] = useState("home");

  if (mode === "experience") return <Experience onExit={() => setMode("home")} />;
  if (mode === "training") return <Training onExit={() => setMode("home")} />;

  return (
    <div className="home">
      <div className="home-inner">
        <h1>Hemispace</h1>
        <p className="tagline">
          After a stroke on the right side of the brain, the left half of the world can
          stop existing — and the person has no idea. Not blindness. Attention.
        </p>

        <div className="cards">
          <button className="card" onClick={() => setMode("experience")}>
            <span className="tag">For everyone</span>
            <h2>See it happen</h2>
            <p>
              Search a room twice. The second time, half of it is not part of your world.
              Then the camera lifts and shows you what you walked past.
            </p>
            <span className="go">Start →</span>
          </button>

          <button className="card" onClick={() => setMode("training")}>
            <span className="tag">For patients</span>
            <h2>Scanning practice</h2>
            <p>
              Every round begins on your left. Targets move further out as your reach
              grows, and the prompts are taken away as you stop needing them.
            </p>
            <span className="go">Practise →</span>
          </button>
        </div>

        <p className="disclaimer">
          Awareness and practice only. Not a medical device, not diagnostic, not a
          treatment. Scanning practice follows the standard clinical approach, but the
          Cochrane review finds the effectiveness of neglect rehabilitation unproven.
        </p>
      </div>
    </div>
  );
}
