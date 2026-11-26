import { beforeAll } from 'vitest'

const RECOVERY_KEY = 'pleroma-fe-boot-recovery'

let guardSource

// The guard is a plain script outside the bundle, so it's run the way the page
// does: inside of a document that looks like index.html while loading. What it
// touches (storages, caches, databases, service workers) is faked, as the real
// ones belong to the test runner too and the guard is made to wipe them.
const memoryStorage = () => {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  }
}

const memoryCaches = () => {
  const names = new Set()
  return {
    open: async (name) => names.add(name),
    keys: async () => [...names],
    delete: async (name) => names.delete(name),
  }
}

const fakeIndexedDB = (names = [], answers = true) => {
  const deleteDatabase = vi.fn(() => {
    const request = {}
    if (answers) setTimeout(() => request.onsuccess?.(), 0)
    return request
  })
  return {
    deleteDatabase,
    databases: async () => names.map((name) => ({ name })),
  }
}

const define = (target, name, value) =>
  Object.defineProperty(target, name, { value, configurable: true })

const startPage = async (config = {}) => {
  const frame = document.createElement('iframe')
  frame.srcdoc = `<!doctype html><html><head></head><body>
    <div id="splash" class="initial-hidden">
      <div id="status"></div><code id="statusError"></code><pre id="statusStack"></pre>
    </div>
    <div id="app" class="hidden"></div>
  </body></html>`
  document.body.append(frame)
  await new Promise((resolve) => {
    frame.addEventListener('load', resolve, { once: true })
  })

  const win = frame.contentWindow
  const doc = win.document
  const reload = vi.fn()
  const registrations = [{ unregister: vi.fn(async () => true) }]
  win.__bootGuardConfig = {
    timeoutMs: 400,
    pollMs: 20,
    clearTimeoutMs: 300,
    reload,
    ...config,
  }
  win.confirm = vi.fn(() => true)
  define(win, 'localStorage', memoryStorage())
  define(win, 'sessionStorage', memoryStorage())
  define(win, 'caches', memoryCaches())
  define(win, 'indexedDB', fakeIndexedDB())
  define(win.navigator, 'serviceWorker', {
    getRegistrations: async () => registrations,
  })

  const script = doc.createElement('script')
  script.textContent = guardSource
  doc.head.append(script)

  return {
    frame,
    win,
    doc,
    reload,
    registrations,
    guard: win.__bootGuard,
    panel: () => doc.getElementById('boot-guard'),
    buttons: () => [...doc.querySelectorAll('#boot-guard button')],
    button: (label) =>
      [...doc.querySelectorAll('#boot-guard button')].find((b) =>
        b.textContent.startsWith(label),
      ),
    // what the app does when it has started
    appStarts: () => {
      doc.getElementById('splash').remove()
      doc.getElementById('app').classList.remove('hidden')
    },
    failToLoadScript: () => {
      const script = doc.createElement('script')
      // a type the browser neither fetches nor runs: only the failure is wanted,
      // not a real one arriving later on its own
      script.type = 'text/x-failed-module'
      script.src = '/static/js/main.gone.js'
      doc.head.append(script)
      script.dispatchEvent(new win.Event('error'))
    },
  }
}

const eventually = (assertion) =>
  vi.waitFor(assertion, { timeout: 3000, interval: 20 })

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Boot guard', () => {
  let page

  beforeAll(async () => {
    guardSource = await (await fetch('/static/boot_guard.js')).text()
  })

  afterEach(() => {
    page?.frame.remove()
    page = null
  })

  describe('in index.html', () => {
    it('runs first, as a plain script', async () => {
      const html = await (await fetch('/index.html')).text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const scripts = [...doc.querySelectorAll('script')]
      const position = (suffix) =>
        scripts.findIndex((s) => s.getAttribute('src')?.endsWith(suffix))

      const guard = position('/static/boot_guard.js')
      const app = position('/src/main.js')

      expect(guard).to.be.at.least(0)
      expect(app).to.be.at.least(0)
      expect(guard).to.be.lessThan(app)
      // deferred or module scripts would run after the app had its chance to fail
      expect(scripts[guard].type).to.equal('')
      expect(scripts[guard].defer).to.equal(false)
      expect(scripts[guard].async).to.equal(false)
    })
  })

  describe('when the app starts', () => {
    it('stays out of the way', async () => {
      page = await startPage()
      await pause(100)

      page.appStarts()

      await eventually(() => expect(page.guard.state().done).to.equal(true))
      expect(page.panel()).to.equal(null)
      expect(page.reload).not.toHaveBeenCalled()
    })

    it('ignores failures that come after that', async () => {
      page = await startPage()
      page.appStarts()
      await eventually(() => expect(page.guard.state().done).to.equal(true))

      page.failToLoadScript()

      expect(page.panel()).to.equal(null)
      expect(page.reload).not.toHaveBeenCalled()
    })
  })

  describe('when a script of the app cannot be loaded', () => {
    it('forgets the cached files and reloads, once', async () => {
      page = await startPage()
      await page.win.caches.open('pleroma-fe')

      page.failToLoadScript()

      await eventually(() => expect(page.reload).toHaveBeenCalledOnce())
      expect(await page.win.caches.keys()).to.deep.equal([])
      expect(page.registrations[0].unregister).toHaveBeenCalledOnce()
      expect(page.win.sessionStorage.getItem(RECOVERY_KEY)).to.be.ok
      // it's on its way to a fresh page, nothing to show meanwhile
      expect(page.panel()).to.equal(null)
    })

    it('does not do that again right away, it offers a way out instead', async () => {
      page = await startPage()
      page.win.sessionStorage.setItem(RECOVERY_KEY, String(Date.now()))

      page.failToLoadScript()

      await eventually(() => expect(page.panel()).to.not.equal(null))
      expect(page.reload).not.toHaveBeenCalled()
      expect(page.panel().textContent).to.include("The app couldn't start")
      // what failed is shown, for whoever can make use of it
      expect(page.panel().textContent).to.include('/static/js/main.gone.js')
      expect(page.buttons().map((b) => b.textContent)).to.deep.equal([
        'Reload',
        'Clear cached files and reload',
        'Reset saved data and reload',
      ])
    })

    it('does that again once enough time has passed', async () => {
      page = await startPage()
      page.win.sessionStorage.setItem(
        RECOVERY_KEY,
        String(Date.now() - 10 * 60 * 1000),
      )

      page.failToLoadScript()

      await eventually(() => expect(page.reload).toHaveBeenCalledOnce())
    })

    it('treats several scripts failing as one failure', async () => {
      page = await startPage()

      page.failToLoadScript()
      page.failToLoadScript()
      page.failToLoadScript()

      await eventually(() => expect(page.reload).toHaveBeenCalledOnce())
      await pause(100)
      expect(page.reload).toHaveBeenCalledOnce()
    })

    it('does not try to recover when the browser is offline', async () => {
      page = await startPage()
      define(page.win.navigator, 'onLine', false)

      page.failToLoadScript()

      await eventually(() => expect(page.panel()).to.not.equal(null))
      expect(page.reload).not.toHaveBeenCalled()
    })

    it('does not try to recover when it cannot tell if it already has', async () => {
      page = await startPage()
      Object.defineProperty(page.win, 'sessionStorage', {
        get: () => {
          throw new DOMException('denied', 'SecurityError')
        },
        configurable: true,
      })

      page.failToLoadScript()

      await eventually(() => expect(page.panel()).to.not.equal(null))
      expect(page.reload).not.toHaveBeenCalled()
    })

    it('treats a chunk that cannot be imported as such a failure', async () => {
      page = await startPage()
      page.win.sessionStorage.setItem(RECOVERY_KEY, String(Date.now()))

      page.win.dispatchEvent(
        new page.win.PromiseRejectionEvent('unhandledrejection', {
          promise: new page.win.Promise(() => undefined),
          reason: new Error(
            'Failed to fetch dynamically imported module: /static/js/popover.gone.js',
          ),
        }),
      )

      await eventually(() => expect(page.panel()).to.not.equal(null))
      expect(page.panel().textContent).to.include('popover.gone.js')
    })
  })

  describe('when the app does not start', () => {
    it('says so after a while, and takes it back when the app starts after all', async () => {
      page = await startPage()
      expect(page.panel()).to.equal(null)

      await eventually(() => expect(page.panel()).to.not.equal(null))
      expect(page.panel().textContent).to.include('Still loading')
      // waiting is not a failure: nothing is reloaded behind anyone's back
      expect(page.reload).not.toHaveBeenCalled()

      page.appStarts()

      await eventually(() => expect(page.panel()).to.equal(null))
    })

    it('shows what went wrong when that becomes known only after the screen is up', async () => {
      page = await startPage()
      await eventually(() => expect(page.panel()).to.not.equal(null))
      const details = () => page.panel().querySelector('pre')
      expect(details().style.display).to.equal('none')

      page.doc.getElementById('statusError').textContent =
        'TypeError: late news'

      await eventually(() => {
        expect(details().style.display).to.equal('block')
        expect(details().textContent).to.include('late news')
      })
    })

    it('shows the failure the app itself reported', async () => {
      page = await startPage({ timeoutMs: 60000 })
      page.doc.getElementById('statusError').textContent =
        'TypeError: x is not a function'
      page.doc.getElementById('statusStack').textContent = 'at boot (main.js:1)'

      await eventually(() => expect(page.panel()).to.not.equal(null))

      expect(page.panel().textContent).to.include("The app couldn't start")
      expect(page.panel().textContent).to.include('x is not a function')
      expect(page.panel().textContent).to.include('at boot (main.js:1)')
      expect(page.reload).not.toHaveBeenCalled()
    })

    it('does not mistake an error nobody asked about for a failure to start', async () => {
      page = await startPage({ timeoutMs: 60000 })

      page.win.dispatchEvent(
        new page.win.ErrorEvent('error', { message: 'some unrelated error' }),
      )
      await pause(150)

      expect(page.panel()).to.equal(null)
      expect(page.reload).not.toHaveBeenCalled()
    })
  })

  describe('the ways out', () => {
    const failed = async () => {
      page = await startPage()
      page.win.sessionStorage.setItem(RECOVERY_KEY, String(Date.now()))
      page.failToLoadScript()
      await eventually(() => expect(page.panel()).to.not.equal(null))
    }

    it('reloads', async () => {
      await failed()

      page.button('Reload').click()

      expect(page.reload).toHaveBeenCalledOnce()
    })

    it('does not start anything on its own once one is chosen', async () => {
      await failed()
      page.button('Reload').click()
      // as if there were no sign of an earlier recovery anymore
      page.win.sessionStorage.clear()

      page.failToLoadScript()
      await pause(100)

      expect(page.reload).toHaveBeenCalledOnce()
    })

    it('forgets the cached files and reloads, keeping the saved data', async () => {
      await failed()
      await page.win.caches.open('pleroma-fe')
      await page.win.caches.open('pleroma-fe-emoji')
      page.win.localStorage.setItem('kept', 'yes')

      page.button('Clear cached files').click()

      await eventually(() => expect(page.reload).toHaveBeenCalledOnce())
      expect(await page.win.caches.keys()).to.deep.equal([])
      expect(page.registrations[0].unregister).toHaveBeenCalledOnce()
      expect(page.win.localStorage.getItem('kept')).to.equal('yes')
    })

    describe('forgetting the saved data', () => {
      it('asks first and does nothing when not agreed to', async () => {
        await failed()
        const databases = fakeIndexedDB(['localforage'])
        define(page.win, 'indexedDB', databases)
        page.win.confirm = vi.fn(() => false)
        page.win.localStorage.setItem('kept', 'yes')

        page.button('Reset saved data').click()
        await pause(100)

        expect(page.win.confirm).toHaveBeenCalledOnce()
        expect(databases.deleteDatabase).not.toHaveBeenCalled()
        expect(page.win.localStorage.getItem('kept')).to.equal('yes')
        expect(page.reload).not.toHaveBeenCalled()
        // and the choice is still there
        expect(page.buttons().every((b) => !b.disabled)).to.equal(true)
      })

      it('removes the databases, the storages and the cached files, then reloads', async () => {
        await failed()
        const databases = fakeIndexedDB(['localforage', 'other'])
        define(page.win, 'indexedDB', databases)
        await page.win.caches.open('pleroma-fe')
        page.win.localStorage.setItem('gone', 'yes')
        page.win.sessionStorage.setItem('gone', 'yes')

        page.button('Reset saved data').click()

        await eventually(() => expect(page.reload).toHaveBeenCalledOnce())
        expect(
          databases.deleteDatabase.mock.calls.map(([name]) => name),
        ).to.have.members(['localforage', 'other'])
        expect(page.win.localStorage.getItem('gone')).to.equal(null)
        expect(page.win.sessionStorage.getItem('gone')).to.equal(null)
        expect(await page.win.caches.keys()).to.deep.equal([])
      })

      it('falls back to the database the app uses when they cannot be listed', async () => {
        await failed()
        const databases = fakeIndexedDB()
        databases.databases = async () => {
          throw new Error('not allowed')
        }
        define(page.win, 'indexedDB', databases)

        page.button('Reset saved data').click()

        await eventually(() => expect(page.reload).toHaveBeenCalledOnce())
        expect(databases.deleteDatabase).toHaveBeenCalledWith('localforage')
      })

      it('does not wait for a database that never answers', async () => {
        await failed()
        define(page.win, 'indexedDB', fakeIndexedDB(['localforage'], false))

        page.button('Reset saved data').click()

        // gives up after clearTimeoutMs (300ms here) and reloads regardless
        await eventually(() => expect(page.reload).toHaveBeenCalledOnce())
      })
    })
  })
})
