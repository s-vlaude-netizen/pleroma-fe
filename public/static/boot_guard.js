/*
 * Boot guard
 *
 * A plain script outside of the app bundle on purpose: it has to work when the
 * bundle can't. Files that are gone or out of date (a site or a CDN that is
 * partway through an update, an old copy kept by the browser), browser storage
 * that never answers... Without this all that is left is a blank page or a
 * loading screen that never ends, and the only way out is to wipe the browser data.
 *
 * It watches how the app starts. If it fails, or takes far too long, it brings
 * up a screen with ways out: reload, forget the cached files (service worker
 * and its caches) and, as the last resort, forget the saved data too.
 * Missing or outdated files are tried to be recovered from once, automatically.
 *
 * It's a separate file and not inline in index.html because instances forbid
 * inline scripts (CSP). Settings can be overridden by defining
 * window.__bootGuardConfig before it runs.
 */
;(() => {
  const config = {
    // how long the app may take to start before it's called stuck
    timeoutMs: 20000,
    pollMs: 500,
    // one automatic recovery per this time, so a failure that can't be
    // recovered from doesn't reload the page over and over
    autoRecoveryIntervalMs: 120000,
    // how long to wait for the browser to forget the data before reloading
    clearTimeoutMs: 5000,
    // reloads, and makes sure the page itself isn't taken from the HTTP cache again
    reload: () => {
      fetch(location.href, { cache: 'reload', credentials: 'same-origin' })
        .catch(() => undefined)
        .finally(() => location.reload())
    },
    ...window.__bootGuardConfig,
  }

  const RECOVERY_KEY = 'pleroma-fe-boot-recovery'
  const MODULE_FAILURE =
    /dynamically imported module|importing a module script failed|unable to preload|loading (css )?chunk/i
  const started = Date.now()

  let failure = null
  let lastError = null
  let panel = null
  let detailsElement = null
  let recovering = false
  let done = false
  let timer = null

  const byId = (id) => document.getElementById(id)

  const isReady = () => {
    // wait for the page, there is nothing to judge before its elements exist
    if (document.readyState === 'loading') return false
    // the app removes the splash screen when it's up
    if (!byId('splash')) return true
    const app = byId('app')
    return (
      !!app &&
      !app.classList.contains('hidden') &&
      getComputedStyle(app).display !== 'none'
    )
  }

  // The app shows what failed on its splash screen by itself
  const splashError = () => {
    const status = byId('statusError')
    const stack = byId('statusStack')
    const message = status ? status.textContent.trim() : ''
    if (!message) return null
    return stack && stack.textContent.trim()
      ? `${message}\n${stack.textContent.trim()}`
      : message
  }

  // --- recovery ----------------------------------------------------------

  const clearCachedFiles = () => {
    const jobs = []
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      jobs.push(
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(registrations.map((r) => r.unregister())),
          ),
      )
    }
    if (window.caches && caches.keys) {
      jobs.push(
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
      )
    }
    return Promise.allSettled(jobs)
  }

  const deleteDatabase = (name) =>
    new Promise((resolve) => {
      try {
        const request = indexedDB.deleteDatabase(name)
        // When blocked the database goes away once this page is gone, i.e. on reload
        request.onsuccess =
          request.onerror =
          request.onblocked =
            () => resolve()
      } catch {
        resolve()
      }
    })

  const clearSavedData = () => {
    try {
      localStorage.clear()
    } catch {
      // not available, then there is nothing saved in it either
    }
    try {
      sessionStorage.clear()
    } catch {
      // same
    }
    const databaseNames = indexedDB.databases
      ? indexedDB.databases().then((databases) => databases.map((d) => d.name))
      : Promise.resolve(['localforage'])
    const databases = databaseNames
      .catch(() => ['localforage'])
      .then((names) => Promise.all(names.map(deleteDatabase)))

    // a damaged database may never answer, don't wait for it forever
    const giveUp = new Promise((resolve) =>
      setTimeout(resolve, config.clearTimeoutMs),
    )
    return Promise.race([
      Promise.allSettled([clearCachedFiles(), databases]),
      giveUp,
    ])
  }

  // Files that are missing or out of date are the usual reason and forgetting
  // the cached ones is harmless, so that's tried once without asking anyone.
  const tryAutoRecover = () => {
    if (navigator.onLine === false) return false
    try {
      const last = Number(sessionStorage.getItem(RECOVERY_KEY))
      if (last && Date.now() - last < config.autoRecoveryIntervalMs) {
        return false
      }
      sessionStorage.setItem(RECOVERY_KEY, String(Date.now()))
    } catch {
      // can't tell whether it has been tried already, not worth a reload loop
      return false
    }
    recovering = true
    clearCachedFiles().then(() => config.reload())
    return true
  }

  // --- the screen --------------------------------------------------------

  const detailsText = () => {
    const parts = []
    if (failure && failure.detail) parts.push(failure.detail)
    if (lastError && (!failure || !failure.detail.includes(lastError))) {
      parts.push(lastError)
    }
    return parts.join('\n').slice(0, 1200)
  }

  // shown only when there is something to show, which can come after the screen
  const updateDetails = () => {
    if (!detailsElement) return
    const text = detailsText()
    detailsElement.textContent = text
    detailsElement.style.display = text ? 'block' : 'none'
  }

  const messages = {
    script: [
      "The app couldn't start",
      'Files needed to run it could not be loaded. This usually means the site was just updated and the browser still has the old ones.',
    ],
    error: [
      "The app couldn't start",
      'Something went wrong while starting up.',
    ],
    stalled: [
      'Still loading…',
      'The app is taking much longer to start than it should. You can wait a bit more or try one of these.',
    ],
  }

  const element = (tag, style, text) => {
    const node = document.createElement(tag)
    Object.assign(node.style, style)
    if (text !== undefined) node.textContent = text
    return node
  }

  const button = (label, onClick) => {
    const node = element(
      'button',
      {
        padding: '0.5em 1em',
        background: '#182230',
        color: '#b9b9ba',
        border: '1px solid #2f3b4c',
        borderRadius: '0.3em',
        cursor: 'pointer',
        font: 'inherit',
      },
      label,
    )
    node.type = 'button'
    node.addEventListener('click', () => {
      for (const other of node.parentNode.children) other.disabled = true
      // it is on its way to a reload, nothing else is to start another one
      recovering = true
      onClick()
    })
    return node
  }

  const buildPanel = () => {
    const [title, message] = messages[failure.reason]
    const root = element('div', {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'grid',
      placeItems: 'center',
      overflow: 'auto',
      padding: '1em',
      boxSizing: 'border-box',
      background: '#0f161e',
      color: '#b9b9ba',
      fontFamily: 'sans-serif',
      lineHeight: '1.4',
    })
    root.id = 'boot-guard'
    root.setAttribute('role', 'alert')

    const inner = element('div', { maxWidth: '34em', textAlign: 'center' })
    inner.append(
      element('h1', { fontSize: '1.5em', color: '#e2e2e3' }, title),
      element('p', {}, message),
    )

    detailsElement = element('pre', {
      textAlign: 'left',
      maxHeight: '8em',
      overflow: 'auto',
      padding: '0.6em',
      background: '#182230',
      borderRadius: '0.3em',
      fontSize: '0.8em',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      userSelect: 'text',
    })
    inner.append(detailsElement)
    updateDetails()

    const buttons = element('div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.6em',
      justifyContent: 'center',
      margin: '1em 0',
    })
    buttons.append(
      button('Reload', () => config.reload()),
      button('Clear cached files and reload', () => {
        clearCachedFiles().then(() => config.reload())
      }),
      button('Reset saved data and reload', () => {
        const sure = window.confirm(
          'This removes the settings and drafts saved in this browser. Your account and your posts are not affected.\n\nContinue?',
        )
        if (!sure) {
          recovering = false
          for (const other of buttons.children) other.disabled = false
          return
        }
        clearSavedData().then(() => config.reload())
      }),
    )
    inner.append(
      buttons,
      element(
        'p',
        { fontSize: '0.8em', opacity: '0.8' },
        'Resetting saved data removes the settings and drafts saved in this browser. Your account and your posts are not affected.',
      ),
    )
    root.append(inner)
    return root
  }

  const showPanel = () => {
    if (done || recovering) return
    if (panel) {
      updateDetails()
      return
    }
    // the page may not have a body yet when something fails very early
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', showPanel, { once: true })
      return
    }
    panel = buildPanel()
    document.body.append(panel)
  }

  // --- watching ----------------------------------------------------------

  const rank = { stalled: 0, error: 1, script: 2 }

  const fail = (reason, detail) => {
    if (done || recovering) return
    if (!failure || rank[reason] > rank[failure.reason]) {
      const rebuild = !!panel && !!failure && failure.reason !== reason
      failure = { reason, detail }
      if (rebuild) {
        panel.remove()
        panel = null
      }
    }
    if (reason === 'script' && tryAutoRecover()) return
    showPanel()
  }

  const onError = (event) => {
    const target = event.target
    if (target && target !== window && target.tagName === 'SCRIPT') {
      fail('script', `Could not load ${target.src || 'a script'}`)
    } else if (!target || target === window) {
      lastError = String(event.message || 'Unknown error').slice(0, 300)
    }
  }

  const onRejection = (event) => {
    const reason = event.reason
    const message = String((reason && reason.message) || reason).slice(0, 300)
    lastError = message
    if (MODULE_FAILURE.test(message)) fail('script', message)
  }

  const finish = () => {
    done = true
    clearInterval(timer)
    window.removeEventListener('error', onError, true)
    window.removeEventListener('unhandledrejection', onRejection)
    if (panel) panel.remove()
    panel = null
  }

  const poll = () => {
    if (done) return
    if (isReady()) {
      finish()
      return
    }
    const shown = splashError()
    if (shown) {
      fail('error', shown)
    } else if (Date.now() - started > config.timeoutMs) {
      fail('stalled', '')
    }
  }

  window.addEventListener('error', onError, true)
  window.addEventListener('unhandledrejection', onRejection)
  timer = setInterval(poll, config.pollMs)

  // for tests and for finding out what it thinks
  window.__bootGuard = {
    poll,
    state: () => ({
      done,
      recovering,
      failure: failure && failure.reason,
      panelShown: !!panel,
    }),
  }
})()
