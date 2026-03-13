const seekCore = require('../extension/src/shared/seek-core.js');

function createVideo({ currentTime = 10, duration = 100, paused = false, ended = false, width = 320, height = 180 } = {}) {
  const video = document.createElement('video');
  video.currentTime = currentTime;
  Object.defineProperty(video, 'duration', { value: duration, configurable: true });
  Object.defineProperty(video, 'paused', { value: paused, configurable: true });
  Object.defineProperty(video, 'ended', { value: ended, configurable: true });
  video.getBoundingClientRect = () => ({ width, height, top: 0, left: 0, right: width, bottom: height });
  return video;
}

describe('seek-core.mergeSettings', () => {
  it('applies defaults for empty settings', () => {
    const merged = seekCore.mergeSettings();
    expect(merged).toEqual({
      enabled: true,
      backwardSeconds: 5,
      forwardSeconds: 5,
      debugMode: false,
      siteRules: []
    });
  });

  it('normalizes invalid values', () => {
    const merged = seekCore.mergeSettings({
      enabled: 0,
      backwardSeconds: 0,
      forwardSeconds: 999,
      debugMode: 1,
      siteRules: [{ host: '.Example.com', mode: 'allow', customIntervalSeconds: 80 }, { host: '', mode: 'allow' }]
    });

    expect(merged.enabled).toBe(false);
    expect(merged.backwardSeconds).toBe(1);
    expect(merged.forwardSeconds).toBe(60);
    expect(merged.debugMode).toBe(true);
    expect(merged.siteRules).toEqual([{ host: 'example.com', mode: 'allow', customIntervalSeconds: 80 }]);
  });
});

describe('seek-core.resolveSiteRule', () => {
  it('uses block rule when block and allow have equal specificity', () => {
    const result = seekCore.resolveSiteRule('video.example.com', [
      { host: 'example.com', mode: 'allow', customIntervalSeconds: 7 },
      { host: 'example.com', mode: 'block' }
    ]);

    expect(result.blocked).toBe(true);
  });

  it('applies custom interval for best allow match', () => {
    const result = seekCore.resolveSiteRule('videos.school.edu', [
      { host: 'school.edu', mode: 'allow', customIntervalSeconds: 9 }
    ], { backwardSeconds: 5, forwardSeconds: 5 });

    expect(result.blocked).toBe(false);
    expect(result.backwardSeconds).toBe(9);
    expect(result.forwardSeconds).toBe(9);
  });
});

describe('seek-core editable detection', () => {
  it('detects input descendants', () => {
    document.body.innerHTML = '<input id="title" />';
    const input = document.getElementById('title');
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true });
    Object.defineProperty(event, 'target', { value: input, configurable: true });

    expect(seekCore.isEventFromEditableTarget(event)).toBe(true);
  });

  it('detects code editor classes', () => {
    document.body.innerHTML = '<div class="monaco-editor"><div id="cursor"></div></div>';
    const cursor = document.getElementById('cursor');
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true });
    Object.defineProperty(event, 'target', { value: cursor, configurable: true });

    expect(seekCore.isEventFromEditableTarget(event)).toBe(true);
  });
});

describe('seek-core video targeting and seek', () => {
  it('prefers playing video with largest visible area', () => {
    const pausedVideo = createVideo({ paused: true, width: 640, height: 360 });
    const playingSmall = createVideo({ paused: false, width: 320, height: 180 });
    const playingLarge = createVideo({ paused: false, width: 800, height: 450 });

    const selected = seekCore.selectTargetVideo([pausedVideo, playingSmall, playingLarge]);
    expect(selected).toBe(playingLarge);
  });

  it('uses last interacted video when still valid', () => {
    const a = createVideo({ paused: false, width: 200, height: 100 });
    const b = createVideo({ paused: false, width: 400, height: 300 });
    const selected = seekCore.selectTargetVideo([a, b], a);
    expect(selected).toBe(a);
  });

  it('clamps seek boundaries', () => {
    const video = createVideo({ currentTime: 2, duration: 20 });
    const back = seekCore.seekBy(video, -10);
    expect(back).toBe(true);
    expect(video.currentTime).toBe(0);

    const forward = seekCore.seekBy(video, 999);
    expect(forward).toBe(true);
    expect(video.currentTime).toBe(20);
  });

  it('computes and enforces a fixed target time', () => {
    const video = createVideo({ currentTime: 50, duration: 120 });
    const target = seekCore.calculateSeekTarget(video, 5);
    expect(target).toBe(55);

    const moved = seekCore.seekTo(video, target);
    expect(moved).toBe(true);
    expect(video.currentTime).toBe(55);

    video.currentTime = 65; // simulate a site also applying its own +10s handler
    const corrected = seekCore.seekTo(video, target);
    expect(corrected).toBe(true);
    expect(video.currentTime).toBe(55);
  });

  it('maps key to delta', () => {
    expect(seekCore.getDeltaForKey('ArrowLeft', { backwardSeconds: 7 })).toBe(-7);
    expect(seekCore.getDeltaForKey('ArrowRight', { forwardSeconds: 6 })).toBe(6);
    expect(seekCore.getDeltaForKey('Enter', { forwardSeconds: 6 })).toBe(0);
  });
});
