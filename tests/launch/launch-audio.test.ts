import { describe, expect, it } from "vitest";
import { launchAudio } from "@/lib/launch-audio";

describe("launchAudio", () => {
  it("round-trips the mute flag", () => {
    launchAudio.setMuted(true);
    expect(launchAudio.getMuted()).toBe(true);
    launchAudio.setMuted(false);
    expect(launchAudio.getMuted()).toBe(false);
  });

  it("never throws when there is no audio context available", () => {
    launchAudio.setMuted(false);
    expect(() => launchAudio.unlock()).not.toThrow();
    expect(() => launchAudio.playTick()).not.toThrow();
    expect(() => launchAudio.playCurtainSweep()).not.toThrow();
    expect(() => launchAudio.playLaunchFanfare()).not.toThrow();
    expect(() => launchAudio.playTestTone()).not.toThrow();
  });

  it("stays silent when muted", () => {
    launchAudio.setMuted(true);
    expect(() => launchAudio.playLaunchFanfare()).not.toThrow();
    launchAudio.setMuted(false);
  });
});
