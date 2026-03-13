(function attachSeekCore(global) {
  'use strict';

  var STORAGE_KEY = 'cffSettings';
  var DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    backwardSeconds: 5,
    forwardSeconds: 5,
    debugMode: false,
    siteRules: []
  });

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeSeconds(value, fallback, min, max) {
    var parsed = Math.round(toNumber(value, fallback));
    return clamp(parsed, min, max);
  }

  function normalizeHost(host) {
    if (typeof host !== 'string') {
      return '';
    }
    return host.trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '');
  }

  function normalizeRule(rule) {
    if (!rule || typeof rule !== 'object') {
      return null;
    }

    var mode = rule.mode === 'block' ? 'block' : rule.mode === 'allow' ? 'allow' : null;
    var host = normalizeHost(rule.host);

    if (!mode || !host) {
      return null;
    }

    var normalized = {
      host: host,
      mode: mode
    };

    if (rule.customIntervalSeconds !== undefined && rule.customIntervalSeconds !== null) {
      normalized.customIntervalSeconds = normalizeSeconds(rule.customIntervalSeconds, 5, 1, 600);
    }

    return normalized;
  }

  function mergeSettings(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var mergedRules = [];

    if (Array.isArray(source.siteRules)) {
      for (var i = 0; i < source.siteRules.length; i += 1) {
        var normalizedRule = normalizeRule(source.siteRules[i]);
        if (normalizedRule) {
          mergedRules.push(normalizedRule);
        }
      }
    }

    return {
      enabled: source.enabled !== undefined ? Boolean(source.enabled) : DEFAULT_SETTINGS.enabled,
      backwardSeconds: normalizeSeconds(source.backwardSeconds, DEFAULT_SETTINGS.backwardSeconds, 1, 60),
      forwardSeconds: normalizeSeconds(source.forwardSeconds, DEFAULT_SETTINGS.forwardSeconds, 1, 60),
      debugMode: source.debugMode !== undefined ? Boolean(source.debugMode) : DEFAULT_SETTINGS.debugMode,
      siteRules: mergedRules
    };
  }

  function hostMatchesRule(hostname, ruleHost) {
    if (!hostname || !ruleHost) {
      return false;
    }
    if (ruleHost === '*') {
      return true;
    }
    return hostname === ruleHost || hostname.endsWith('.' + ruleHost);
  }

  function resolveSiteRule(hostname, siteRules, baseSettings) {
    var normalizedHost = normalizeHost(hostname);
    var merged = mergeSettings(baseSettings);
    var rules = Array.isArray(siteRules) ? siteRules : merged.siteRules;
    var winner = null;

    for (var i = 0; i < rules.length; i += 1) {
      var rule = normalizeRule(rules[i]);
      if (!rule || !hostMatchesRule(normalizedHost, rule.host)) {
        continue;
      }

      var specificity = rule.host === '*' ? 0 : rule.host.length;
      var modePriority = rule.mode === 'block' ? 2 : 1;

      if (!winner) {
        winner = { rule: rule, specificity: specificity, modePriority: modePriority };
        continue;
      }

      if (specificity > winner.specificity || (specificity === winner.specificity && modePriority > winner.modePriority)) {
        winner = { rule: rule, specificity: specificity, modePriority: modePriority };
      }
    }

    var result = {
      blocked: false,
      backwardSeconds: merged.backwardSeconds,
      forwardSeconds: merged.forwardSeconds
    };

    if (!winner) {
      return result;
    }

    if (winner.rule.mode === 'block') {
      result.blocked = true;
      return result;
    }

    if (winner.rule.customIntervalSeconds !== undefined) {
      result.backwardSeconds = winner.rule.customIntervalSeconds;
      result.forwardSeconds = winner.rule.customIntervalSeconds;
    }

    return result;
  }

  function isLikelyCodeEditor(element) {
    if (!element || !element.className) {
      return false;
    }

    var value = String(element.className).toLowerCase();
    return value.includes('monaco-editor') || value.includes('cm-editor') || value.includes('codemirror') || value.includes('ace_editor');
  }

  function normalizeElement(target) {
    if (!target) {
      return null;
    }
    if (target.nodeType === 1) {
      return target;
    }
    if (target.nodeType === 3) {
      return target.parentElement || null;
    }
    return null;
  }

  function isEditableElement(target) {
    var element = normalizeElement(target);
    if (!element) {
      return false;
    }

    if (isLikelyCodeEditor(element)) {
      return true;
    }

    if (element.isContentEditable) {
      return true;
    }

    var tag = element.tagName ? element.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return true;
    }

    if (element.getAttribute && element.getAttribute('role') === 'textbox') {
      return true;
    }

    if (typeof element.closest === 'function') {
      var editableAncestor = element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], .monaco-editor, .cm-editor, .CodeMirror, .ace_editor');
      return Boolean(editableAncestor);
    }

    return false;
  }

  function isEventFromEditableTarget(event) {
    if (!event) {
      return false;
    }

    if (typeof event.composedPath === 'function') {
      var path = event.composedPath();
      for (var i = 0; i < path.length; i += 1) {
        if (isEditableElement(path[i])) {
          return true;
        }
      }
    }

    return isEditableElement(event.target);
  }

  function videoArea(video) {
    if (!video || typeof video.getBoundingClientRect !== 'function') {
      return 0;
    }

    var rect = video.getBoundingClientRect();
    var width = Math.max(0, rect.width || 0);
    var height = Math.max(0, rect.height || 0);
    return width * height;
  }

  function isUsableVideo(video) {
    return Boolean(video && typeof video.currentTime === 'number' && !Number.isNaN(video.currentTime));
  }

  function getSeekBounds(video) {
    var minTime = 0;
    var maxTime = Number.MAX_SAFE_INTEGER;

    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      maxTime = video.duration;
    }

    return {
      minTime: minTime,
      maxTime: maxTime
    };
  }

  function selectTargetVideo(videos, lastInteractedVideo) {
    if (!Array.isArray(videos) || videos.length === 0) {
      return null;
    }

    var usable = videos.filter(isUsableVideo);
    if (usable.length === 0) {
      return null;
    }

    if (lastInteractedVideo && usable.indexOf(lastInteractedVideo) >= 0) {
      return lastInteractedVideo;
    }

    var playing = usable.filter(function (video) {
      return !video.paused && !video.ended;
    });

    var candidates = playing.length > 0 ? playing : usable;
    var best = candidates[0];
    var bestScore = videoArea(best);

    for (var i = 1; i < candidates.length; i += 1) {
      var score = videoArea(candidates[i]);
      if (score > bestScore) {
        best = candidates[i];
        bestScore = score;
      }
    }

    return best;
  }

  function seekBy(video, deltaSeconds) {
    var target = calculateSeekTarget(video, deltaSeconds);
    if (target === null) {
      return false;
    }

    return seekTo(video, target);
  }

  function calculateSeekTarget(video, deltaSeconds) {
    if (!isUsableVideo(video)) {
      return null;
    }

    var delta = toNumber(deltaSeconds, 0);
    if (!delta) {
      return null;
    }

    var bounds = getSeekBounds(video);
    return clamp(video.currentTime + delta, bounds.minTime, bounds.maxTime);
  }

  function seekTo(video, targetSeconds) {
    if (!isUsableVideo(video)) {
      return false;
    }

    var target = toNumber(targetSeconds, video.currentTime);
    var bounds = getSeekBounds(video);
    target = clamp(target, bounds.minTime, bounds.maxTime);

    if (Math.abs(target - video.currentTime) < 0.01) {
      return false;
    }

    try {
      video.currentTime = target;
      return true;
    } catch (_error) {
      return false;
    }
  }

  function getDeltaForKey(key, hostConfig) {
    var config = hostConfig || DEFAULT_SETTINGS;

    if (key === 'ArrowLeft') {
      return -Math.abs(config.backwardSeconds || DEFAULT_SETTINGS.backwardSeconds);
    }

    if (key === 'ArrowRight') {
      return Math.abs(config.forwardSeconds || DEFAULT_SETTINGS.forwardSeconds);
    }

    return 0;
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    clamp: clamp,
    mergeSettings: mergeSettings,
    normalizeHost: normalizeHost,
    hostMatchesRule: hostMatchesRule,
    resolveSiteRule: resolveSiteRule,
    isEditableElement: isEditableElement,
    isEventFromEditableTarget: isEventFromEditableTarget,
    selectTargetVideo: selectTargetVideo,
    calculateSeekTarget: calculateSeekTarget,
    seekTo: seekTo,
    seekBy: seekBy,
    getDeltaForKey: getDeltaForKey
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.ConsistentSeekCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
