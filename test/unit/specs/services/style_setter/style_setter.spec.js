import { createTestingPinia } from '@pinia/testing'
import localforage from 'localforage'
import { setActivePinia } from 'pinia'

import { useMergedConfigStore } from 'src/stores/merged_config.js'
import { useSyncConfigStore } from 'src/stores/sync_config.js'

import {
  applyTheme,
  getResourcesIndex,
  hasInvalidCachedThemeRules,
  tryLoadCache,
} from 'src/services/style_setter/style_setter.js'
import { getEngineChecksum } from 'src/services/theme_data/theme_data_3.service.js'

describe('resource index', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('ignores an HTML fallback returned for a missing custom index', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ builtin: { version: 1 } }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response('<!doctype html><title>Pleroma</title>', {
            headers: { 'Content-Type': 'text/html' },
          }),
        ),
    )

    const resources = await getResourcesIndex('/static/styles.json')

    expect(Object.keys(resources)).to.deep.equal(['builtin'])
    expect(resources.builtin()).to.deep.equal({ version: 1 })
  })
})

describe('style setter cache', () => {
  it('rejects cached rules containing serialized objects', () => {
    expect(
      hasInvalidCachedThemeRules([
        ['html { --font: [object Object]; }'],
        ['.post { --font: sans-serif; }'],
      ]),
    ).to.equal(true)
  })

  it('accepts cached rules containing valid font families', () => {
    expect(
      hasInvalidCachedThemeRules([
        ['html { --font: sans-serif; }'],
        [
          '.post { --font: "Atkinson Hyperlegible"; }',
          '.post::after { content: "[object Object]"; }',
        ],
      ]),
    ).to.equal(false)
  })
})

describe('theme cache in the storage', () => {
  const cacheKey = 'pleromafe-theme-cache'
  const validCache = () => ({
    checksum: 'checksum',
    engineChecksum: getEngineChecksum(),
    data: [['html { --bg: #000; }'], ['.post { color: red; }']],
  })

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    useMergedConfigStore().mergedConfig = { themeChecksum: 'checksum' }
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(localforage, 'removeItem').mockImplementation(() =>
      Promise.resolve(),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('tryLoadCache', () => {
    it('has nothing to load before the theme was ever compiled', async () => {
      vi.spyOn(localforage, 'getItem').mockImplementation(() =>
        Promise.resolve(null),
      )

      expect(await tryLoadCache()).to.equal(null)
      expect(localforage.removeItem).not.toHaveBeenCalled()
    })

    it('loads a cache that matches the engine and the saved checksum', async () => {
      vi.spyOn(localforage, 'getItem').mockImplementation(() =>
        Promise.resolve(validCache()),
      )

      expect(await tryLoadCache()).to.equal(true)
      expect(localforage.removeItem).not.toHaveBeenCalled()
    })

    it.each([
      ['an older engine', { engineChecksum: 'old engine' }],
      ['another saved checksum', { checksum: 'something else' }],
    ])('clears the cache made by %s where it is stored', async (_, change) => {
      vi.spyOn(localforage, 'getItem').mockImplementation(() =>
        Promise.resolve({ ...validCache(), ...change }),
      )

      expect(await tryLoadCache()).to.not.equal(true)
      // it is kept by localforage, not in the localStorage
      expect(localforage.removeItem).toHaveBeenCalledWith(cacheKey)
    })

    it('goes on without the cache when the storage fails', async () => {
      vi.spyOn(localforage, 'getItem').mockImplementation(() =>
        Promise.reject(new Error('Internal error opening backing store')),
      )

      expect(await tryLoadCache()).to.equal(false)
    })

    it('goes on without the cache when the storage never answers', async () => {
      vi.useFakeTimers()
      vi.spyOn(localforage, 'getItem').mockImplementation(
        () => new Promise(() => undefined),
      )

      const result = tryLoadCache()
      await vi.advanceTimersByTimeAsync(3000)

      expect(await result).to.equal(false)
    })
  })

  describe('applyTheme', () => {
    const compile = () =>
      new Promise((resolve) => {
        applyTheme([], undefined, resolve)
      })

    beforeEach(() => {
      vi.spyOn(localforage, 'setItem').mockImplementation(() =>
        Promise.resolve(),
      )
    })

    it('finishes and stores the cache while nobody is logged in', async () => {
      const cache = await compile()

      expect(localforage.setItem).toHaveBeenCalledWith(cacheKey, cache)
      // and the cache can be recognized by the checksum saved with it
      expect(useSyncConfigStore().prefsStorage.simple.themeChecksum).to.equal(
        cache.checksum,
      )
    })

    it('finishes and stores the cache when the checksum cannot be saved', async () => {
      useSyncConfigStore().setSimplePrefAndSave = () => {
        throw new Error('cannot save')
      }

      const cache = await compile()

      expect(localforage.setItem).toHaveBeenCalledWith(cacheKey, cache)
    })
  })
})
