import { describe, expect, it } from "vitest";
import { WEEKS, myTimetable, weekly } from "./fixtures/mytimetable";
import { baseUrl, importCalendar, makeTimetable } from "./http";

// Overlays stay live: an import is announced on the SSE stream, which open
// overlays listen to. (After a deploy, CI also checks the stream answers.)
// The event says who changed and nothing about what, since anyone can
// listen.

describe("the live stream", () => {
  it("announces who re-imported, without their classes", async () => {
    const friend = await makeTimetable("Streamer");

    const stream = await fetch(new URL("/api/events", baseUrl));
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const reader = stream.body?.getReader();
    if (!reader) throw new Error("no response body");

    await importCalendar(
      friend,
      myTimetable(
        weekly(
          { course: "COMP4020", title: "Agentic Coding Studio", activity: "TutA", group: "04", start: "1030", end: "1200" },
          WEEKS.wed,
        ),
      ),
    );

    const decoder = new TextDecoder();
    let received = "";
    while (!received.includes("data: ")) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended before the event arrived");
      received += decoder.decode(value, { stream: true });
    }
    await reader.cancel();
    const event = JSON.parse(received.split("data: ")[1].split("\n")[0]);
    expect(Object.keys(event)).toEqual(["personId"]);
    expect(received).not.toContain("COMP4020");
  }, 10_000);
});
