(function initPopup(global) {
  'use strict';

  var core = global.ConsistentSeekCore;
  var browserApi = global.browser || global.chrome;

  if (!core || !browserApi || !browserApi.storage || !browserApi.storage.local) {
    return;
  }

  var siteLabel = document.getElementById('site-label');
  var allowSiteInput = document.getElementById('allow-site');
  var openOptionsButton = document.getElementById('open-options');
  var statusElement = document.getElementById('status');

  var currentHost = '';
  var currentSettings = core.mergeSettings();

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

  function getActiveTab() {
    return new Promise(function (resolve, reject) {
      try {
        var maybePromise = browserApi.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (browserApi.runtime && browserApi.runtime.lastError) {
            reject(browserApi.runtime.lastError);
            return;
          }
          resolve((tabs && tabs[0]) || null);
        });

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(function (tabs) {
            resolve((tabs && tabs[0]) || null);
          }).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function hostFromTab(tab) {
    if (!tab || !tab.url) {
      return '';
    }

    try {
      var parsed = new URL(tab.url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return core.normalizeHost(parsed.hostname);
      }
    } catch (_error) {
    }

    return '';
  }

  function render() {
    if (!currentHost) {
      siteLabel.textContent = 'No supported website in current tab';
      allowSiteInput.checked = false;
      allowSiteInput.disabled = true;
      setStatus('Open an http/https tab to configure.', true);
      return;
    }

    siteLabel.textContent = 'Site: ' + currentHost;
    allowSiteInput.disabled = false;

    var ruleResult = core.resolveSiteRule(currentHost, currentSettings.siteRules, currentSettings);
    var allowedHere = !ruleResult.blocked;
    allowSiteInput.checked = allowedHere;
    setStatus(allowedHere ? 'Enabled for this site.' : 'Disabled for this site.', false);
  }

  async function saveSettings(nextSettings) {
    currentSettings = core.mergeSettings(nextSettings);
    var payload = {};
    payload[core.STORAGE_KEY] = currentSettings;
    await promisifyStorageSet(payload);
  }

  async function onAllowToggleChanged() {
    if (!currentHost) {
      return;
    }

    try {
      var nextRules = allowSiteInput.checked
        ? core.upsertSiteRule(currentSettings.siteRules, currentHost, 'allow')
        : core.removeSiteRule(currentSettings.siteRules, currentHost);

      await saveSettings({
        enabled: currentSettings.enabled,
        backwardSeconds: currentSettings.backwardSeconds,
        forwardSeconds: currentSettings.forwardSeconds,
        defaultMode: 'block',
        debugMode: currentSettings.debugMode,
        siteRules: nextRules
      });

      render();
    } catch (_error) {
      setStatus('Could not update site setting.', true);
      allowSiteInput.checked = !allowSiteInput.checked;
    }
  }

  async function load() {
    try {
      var stored = await promisifyStorageGet(core.STORAGE_KEY);
      currentSettings = core.mergeSettings(stored[core.STORAGE_KEY]);

      if (currentSettings.defaultMode !== 'block') {
        currentSettings.defaultMode = 'block';
        await saveSettings(currentSettings);
      }
    } catch (_error) {
      currentSettings = core.mergeSettings();
    }

    try {
      var tab = await getActiveTab();
      currentHost = hostFromTab(tab);
    } catch (_error2) {
      currentHost = '';
    }

    render();
  }

  allowSiteInput.addEventListener('change', onAllowToggleChanged);
  openOptionsButton.addEventListener('click', function () {
    if (browserApi.runtime && typeof browserApi.runtime.openOptionsPage === 'function') {
      browserApi.runtime.openOptionsPage();
    }
  });

  load();
})(typeof globalThis !== 'undefined' ? globalThis : this);
