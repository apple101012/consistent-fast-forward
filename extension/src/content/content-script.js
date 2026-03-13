(function initConsistentFastForward(global) {
  'use strict';

  var core = global.ConsistentSeekCore;
  var browserApi = global.browser || global.chrome;

  if (!core || !browserApi || !browserApi.storage || !browserApi.storage.local) {
    return;
  }

  var settings = core.mergeSettings();
  var ready = false;
  var lastInteractedVideo = null;
  var reassertionDelaysMs = [0, 28, 120];
  var seekRevisionByVideo = new WeakMap();

  function logDebug() {
    if (!settings.debugMode) {
      return;
    }
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Consistent Fast Forward]');
    console.debug.apply(console, args);
  }

  function promisifyStorageGet(key) {
    return new Promise(function (resolve) {
      try {
        var maybePromise = browserApi.storage.local.get(key, function (result) {
          if (browserApi.runtime && browserApi.runtime.lastError) {
            resolve({});
            return;
          }
          resolve(result || {});
        });

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(function (result) {
            resolve(result || {});
          }).catch(function () {
            resolve({});
          });
        }
      } catch (_error) {
        resolve({});
      }
    });
  }

  function getVideoCandidatesFromDocument(doc, out, visited, depth) {
    if (!doc || visited.has(doc) || depth > 2) {
      return;
    }

    visited.add(doc);

    var videos = doc.querySelectorAll('video');
    for (var i = 0; i < videos.length; i += 1) {
      out.push(videos[i]);
    }

    var iframes = doc.querySelectorAll('iframe');
    for (var j = 0; j < iframes.length; j += 1) {
      var frame = iframes[j];
      try {
        if (frame.contentDocument) {
          getVideoCandidatesFromDocument(frame.contentDocument, out, visited, depth + 1);
        }
      } catch (_error) {
      }
    }
  }

  function getVideoCandidates() {
    var out = [];
    getVideoCandidatesFromDocument(document, out, new Set(), 0);
    return out;
  }

  function trackVideoInteraction(event) {
    var target = event.target;
    if (target && target.tagName && target.tagName.toLowerCase() === 'video') {
      lastInteractedVideo = target;
    }
  }

  function applySeekForEvent(event) {
    if (!ready || !settings.enabled || event.isComposing) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (core.isEventFromEditableTarget(event)) {
      return;
    }

    var hostConfig = core.resolveSiteRule(global.location.hostname, settings.siteRules, settings);
    if (hostConfig.blocked) {
      return;
    }

    var delta = core.getDeltaForKey(event.key, hostConfig);
    if (!delta) {
      return;
    }

    var targetVideo = core.selectTargetVideo(getVideoCandidates(), lastInteractedVideo);
    if (!targetVideo) {
      return;
    }

    var targetTime = core.calculateSeekTarget(targetVideo, delta);
    if (targetTime === null) {
      return;
    }

    blockEvent(event);
    core.seekTo(targetVideo, targetTime);
    scheduleReassertions(targetVideo, targetTime);
    lastInteractedVideo = targetVideo;
  }

  function blockEvent(event) {
    event.preventDefault();
    event.stopPropagation();

    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
  }

  function scheduleReassertions(video, targetTime) {
    if (!video) {
      return;
    }

    var revision = (seekRevisionByVideo.get(video) || 0) + 1;
    seekRevisionByVideo.set(video, revision);

    for (var i = 0; i < reassertionDelaysMs.length; i += 1) {
      (function (delay) {
        global.setTimeout(function () {
          if (seekRevisionByVideo.get(video) !== revision) {
            return;
          }

          if (Math.abs(video.currentTime - targetTime) <= 0.12) {
            return;
          }

          core.seekTo(video, targetTime);
        }, delay);
      })(reassertionDelaysMs[i]);
    }
  }

  function onStorageChanged(changes, areaName) {
    if (areaName !== 'local' || !changes[core.STORAGE_KEY]) {
      return;
    }

    settings = core.mergeSettings(changes[core.STORAGE_KEY].newValue);
    logDebug('Settings updated from storage listener.');
  }

  async function loadSettings() {
    var raw = await promisifyStorageGet(core.STORAGE_KEY);
    settings = core.mergeSettings(raw[core.STORAGE_KEY]);
    ready = true;
    logDebug('Settings loaded.', settings);
  }

  document.addEventListener('play', trackVideoInteraction, true);
  document.addEventListener('pointerdown', trackVideoInteraction, true);
  window.addEventListener('keydown', function (event) {
    try {
      applySeekForEvent(event);
    } catch (error) {
      logDebug('Unhandled keydown error:', error);
    }
  }, true);

  if (browserApi.storage.onChanged && typeof browserApi.storage.onChanged.addListener === 'function') {
    browserApi.storage.onChanged.addListener(onStorageChanged);
  }

  loadSettings();
})(typeof globalThis !== 'undefined' ? globalThis : this);
