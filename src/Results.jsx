import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

/** Live view: recent sessions, drill into one participant code to compare clean vs. neglect. */
export default function Results() {
  const [code, setCode] = useState("");
  const recent = useQuery(api.sessions.listRecent, {});
  const pair = useQuery(api.results.forCode, code ? { code } : "skip");

  return (
    <div className="overlay results-view">
      <h2>Sessions</h2>
      <table>
        <thead><tr><th>Code</th><th>Run</th><th>Started</th><th>Finished</th></tr></thead>
        <tbody>
          {(recent ?? []).map((s) => (
            <tr key={s._id} onClick={() => setCode(s.code)} className={s.code === code ? "selected" : ""}>
              <td>{s.code}</td>
              <td>{s.run}</td>
              <td>{new Date(s.startedAt).toLocaleTimeString()}</td>
              <td>{s.finishedAt ? new Date(s.finishedAt).toLocaleTimeString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {code && (
        <>
          <h2>Code {code}</h2>
          <table>
            <thead><tr><th>Run</th><th>Poses</th><th>Finds</th></tr></thead>
            <tbody>
              {(pair ?? []).map((r) => (
                <tr key={r.session._id}>
                  <td>{r.session.run}</td>
                  <td>{r.poseCount}</td>
                  <td>{r.findCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
