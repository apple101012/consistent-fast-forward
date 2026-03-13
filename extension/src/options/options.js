(function initOptionsPage(global) {
  'use strict';

  var core = global.ConsistentSeekCore;
  var browserApi = global.browser || global.chrome;

  if (!core || !browserApi || !browserApi.storage || !browserApi.storage.local) {
    return;
  }

  var statusElement = document.getElementById('status');
  var enabledInput = document.getElementById('enabled');
  var backwardInput = document.getElementById('backward-seconds');
  var forwardInput = document.getElementById('forward-seconds');
  var debugInput = document.getElementById('debug-mode');
  var saveButton = document.getElementById('save');
  var resetButton = document.getElementById('reset');

  function setStatus(message, isError) {
    statusElement.textContent = message;
    statusElement.style.color = isError ? '#9f1239' : '#1f4ea3';
  }

  function promisifyStorageGet(key) {
    return new Promise(function (resolve, reject) {
      try {
        var maybePromise = browserApi.storage.local.get(key, function (result) {
          if (browserApi.runtime && browserApi.runtime.lastError) {
            reject(browserApi.runtime.lastError);
            return;
          }
          resolve(result || {});
        });

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(function (result) {
            resolve(result || {});
          }).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function promisifyStorageSet(value) {
    return new Promise(function (resolve, reject) {
      try {
        var maybePromise = browserApi.storage.local.set(value, function () {
          if (browserApi.runtime && browserApi.runtime.lastError) {
            reject(browserApi.runtime.lastError);
            return;
          }
          resolve();
        });

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function formToSettings() {
    var backward = Number(backwardInput.value);
    var forward = Number(forwardInput.value);

    if (!Number.isFinite(backward) || backward < 1 || backward > 60) {
      throw new Error('Backward seek must be between 1 and 60 seconds.');
    }

    if (!Number.isFinite(forward) || forward < 1 || forward > 60) {
      throw new Error('Forward seek must be between 1 and 60 seconds.');
    }

    return core.mergeSettings({
      enabled: enabledInput.checked,
      backwardSeconds: backward,
      forwardSeconds: forward,
      debugMode: debugInput.checked
    });
  }

  function settingsToForm(settings) {
    enabledInput.checked = Boolean(settings.enabled);
    backwardInput.value = String(settings.backwardSeconds);
    forwardInput.value = String(settings.forwardSeconds);
    debugInput.checked = Boolean(settings.debugMode);
  }

  async function loadSettings() {
    try {
      var stored = await promisifyStorageGet(core.STORAGE_KEY);
      var settings = core.mergeSettings(stored[core.STORAGE_KEY]);
      settingsToForm(settings);
      setStatus('Loaded settings.', false);
    } catch (_error) {
      settingsToForm(core.DEFAULT_SETTINGS);
      setStatus('Loaded defaults (storage unavailable).', true);
    }
  }

  async function saveSettings() {
    try {
      var settings = formToSettings();
      await promisifyStorageSet((function () {
        var payload = {};
        payload[core.STORAGE_KEY] = settings;
        return payload;
      })());
      setStatus('Saved.', false);
    } catch (error) {
      setStatus(error.message || 'Could not save settings.', true);
    }
  }

  async function resetDefaults() {
    settingsToForm(core.DEFAULT_SETTINGS);
    await saveSettings();
  }

  saveButton.addEventListener('click', saveSettings);
  resetButton.addEventListener('click', resetDefaults);

  loadSettings();
})(typeof globalThis !== 'undefined' ? globalThis : this);
