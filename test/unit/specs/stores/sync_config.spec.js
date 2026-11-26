import { cloneDeep } from 'lodash-es'
import { createPinia, setActivePinia } from 'pinia'

import { useLocalConfigStore } from 'src/stores/local_config.js'
import {
  _getAllFlags,
  _getRecentData,
  _mergeFlags,
  _mergePrefs,
  _moveItemInArray,
  _resetFlags,
  COMMAND_TRIM_FLAGS,
  COMMAND_TRIM_FLAGS_AND_RESET,
  defaultState,
  newUserFlags,
  useSyncConfigStore,
  VERSION,
} from 'src/stores/sync_config.js'

import { storage } from 'src/lib/storage.js'

describe('The SyncConfig store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('mutations', () => {
    describe('initSyncConfig', () => {
      const user = {
        created_at: new Date('1999-02-09'),
        storage: {},
      }

      it('should initialize storage if none present', async () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        await store.initSyncConfig({ ...user })
        expect(store.cache._version).to.eql(VERSION)
        expect(store.cache._timestamp).to.be.a('number')
        expect(store.cache.flagStorage).to.eql(defaultState.flagStorage)
        expect(store.cache.prefsStorage).to.eql(defaultState.prefsStorage)
      })

      it('should initialize storage with proper flags for new users if none present', async () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        await store.initSyncConfig({ ...user, created_at: new Date() })
        expect(store.cache._version).to.eql(VERSION)
        expect(store.cache._timestamp).to.be.a('number')
        expect(store.cache.flagStorage).to.eql(newUserFlags)
        expect(store.cache.prefsStorage).to.eql(defaultState.prefsStorage)
      })

      it('should merge flags even if remote timestamp is older', async () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        store.cache = {
          _timestamp: Date.now(),
          _version: VERSION,
          ...cloneDeep(defaultState),
        }

        await store.initSyncConfig({
          ...user,
          storage: {
            _timestamp: 123,
            _version: VERSION,
            flagStorage: {
              ...defaultState.flagStorage,
              updateCounter: 1,
            },
            prefsStorage: {
              ...defaultState.prefsStorage,
            },
          },
        })

        expect(store.flagStorage).to.eql({
          ...defaultState.flagStorage,
          updateCounter: 1,
        })
      })

      it('should trim journal to 500 entries', async () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        store.cache = {
          _timestamp: Date.now(),
          _version: VERSION,
          ...cloneDeep(defaultState),
        }
        const largeJournal = []
        for (let value = 0; value < 1000; value++) {
          largeJournal.push({
            path: 'simple.palette' + value,
            operation: 'set',
            args: [value],
            // should have A timestamp, we don't really care what it is
            timestamp: 123456,
          })
        }

        await store.initSyncConfig({
          ...user,
          storage: {
            _timestamp: 123,
            _version: VERSION,
            flagStorage: {
              ...defaultState.flagStorage,
              updateCounter: 1,
            },
            prefsStorage: {
              ...defaultState.prefsStorage,
              _journal: largeJournal,
            },
          },
        })

        expect(store.prefsStorage._journal).to.have.length(500)
      })

      it('should reset local timestamp to remote if contents are the same', async () => {
        const store = useSyncConfigStore()
        store.cache = null
        store.pushSyncConfig = vi.fn()

        await store.initSyncConfig({
          ...user,
          storage: {
            _timestamp: 123,
            _version: VERSION,
            flagStorage: {
              ...defaultState.flagStorage,
              updateCounter: 999,
            },
          },
        })
        expect(store.cache._timestamp).to.eql(123)
        expect(store.flagStorage.updateCounter).to.eql(999)
        expect(store.cache.flagStorage.updateCounter).to.eql(999)
      })

      it('should use remote version if local missing', async () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        await store.initSyncConfig(store, user)
        expect(store.cache._version).to.eql(VERSION)
        expect(store.cache._timestamp).to.be.a('number')
        expect(store.cache.flagStorage).to.eql(defaultState.flagStorage)
      })

      it('should recover legacy preferences marked as migrated', async () => {
        vi.spyOn(storage, 'getItem').mockResolvedValue({
          config: {
            _syncMigration: ['modalOnUnfollow'],
            modalOnUnfollow: true,
          },
        })
        vi.spyOn(storage, 'setItem').mockResolvedValue()
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()

        await store.initSyncConfig({ ...user })

        expect(store.prefsStorage.simple.modalOnUnfollow).to.eql(true)
        expect(store.cache.prefsStorage.simple.modalOnUnfollow).to.eql(true)
        expect(store.prefsStorage._journal).to.deep.include({
          path: 'simple.modalOnUnfollow',
          operation: 'set',
          args: [true],
          timestamp: store.prefsStorage._journal[0].timestamp,
        })
        expect(store.dirty).to.eql(true)
        expect(store.pushSyncConfig).toHaveBeenCalledOnce()
        expect(defaultState.prefsStorage.simple.modalOnUnfollow).to.eql(
          undefined,
        )
      })

      it('should preserve an explicit synced preference during recovery', async () => {
        vi.spyOn(storage, 'getItem').mockResolvedValue({
          config: {
            _syncMigration: ['modalOnRepeat'],
            modalOnRepeat: true,
          },
        })
        vi.spyOn(storage, 'setItem').mockResolvedValue()
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()

        await store.initSyncConfig({
          ...user,
          storage: {
            _timestamp: 1,
            _version: VERSION,
            flagStorage: cloneDeep(defaultState.flagStorage),
            prefsStorage: {
              ...cloneDeep(defaultState.prefsStorage),
              simple: {
                ...cloneDeep(defaultState.prefsStorage.simple),
                modalOnRepeat: false,
              },
            },
          },
        })

        expect(store.prefsStorage.simple.modalOnRepeat).to.eql(false)
      })

      it('should preserve a journaled preference removal during recovery', async () => {
        vi.spyOn(storage, 'getItem').mockResolvedValue({
          config: {
            _syncMigration: ['modalOnMute'],
            modalOnMute: true,
          },
        })
        vi.spyOn(storage, 'setItem').mockResolvedValue()
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()

        await store.initSyncConfig({
          ...user,
          storage: {
            _timestamp: 1,
            _version: VERSION,
            flagStorage: cloneDeep(defaultState.flagStorage),
            prefsStorage: {
              ...cloneDeep(defaultState.prefsStorage),
              _journal: [
                {
                  path: 'simple.modalOnMute',
                  operation: 'unset',
                  args: [],
                  timestamp: 1,
                },
              ],
            },
          },
        })

        expect(store.prefsStorage.simple.modalOnMute).to.eql(undefined)
      })

      it('should preserve a journaled nested preference during recovery', async () => {
        vi.spyOn(storage, 'getItem').mockResolvedValue({
          config: {
            _syncMigration: ['notificationVisibility'],
            notificationVisibility: {
              ...cloneDeep(
                defaultState.prefsStorage.simple.notificationVisibility,
              ),
              likes: false,
            },
          },
        })
        vi.spyOn(storage, 'setItem').mockResolvedValue()
        const store = useSyncConfigStore()
        const setPreference = vi.spyOn(store, 'setPreference')
        store.pushSyncConfig = vi.fn()

        await store.initSyncConfig({
          ...user,
          storage: {
            _timestamp: 1,
            _version: VERSION,
            flagStorage: cloneDeep(defaultState.flagStorage),
            prefsStorage: {
              ...cloneDeep(defaultState.prefsStorage),
              _journal: [
                {
                  path: 'simple.notificationVisibility.likes',
                  operation: 'unset',
                  args: [],
                  timestamp: 1,
                },
              ],
            },
          },
        })

        expect(setPreference).not.toHaveBeenCalled()
      })

      it('should recover with a malformed synced journal', async () => {
        vi.spyOn(storage, 'getItem').mockResolvedValue({
          config: {
            _syncMigration: ['modalOnUnfollow'],
            modalOnUnfollow: true,
          },
        })
        vi.spyOn(storage, 'setItem').mockResolvedValue()
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()

        await store.initSyncConfig({
          ...user,
          storage: {
            _timestamp: 1,
            _version: VERSION,
            flagStorage: cloneDeep(defaultState.flagStorage),
            prefsStorage: {
              ...cloneDeep(defaultState.prefsStorage),
              _journal: [{ path: 1, operation: 'set' }],
            },
          },
        })

        expect(store.prefsStorage.simple.modalOnUnfollow).to.eql(true)
      })

      it('should not replay local theme migration during recovery', async () => {
        vi.spyOn(storage, 'getItem').mockResolvedValue({
          config: {
            _syncMigration: ['theme3hacks'],
            theme3hacks: {
              underlay: 'grid',
              fonts: {
                interface: 'Legacy interface',
                input: 'Legacy input',
                post: 'Legacy posts',
                monospace: 'Legacy monospace',
              },
            },
          },
        })
        vi.spyOn(storage, 'setItem').mockResolvedValue()
        const localStore = useLocalConfigStore()
        localStore.set({ path: 'fontInterface', value: 'Current interface' })
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()

        await store.initSyncConfig({ ...user })

        expect(store.prefsStorage.simple.underlay).to.eql('grid')
        expect(localStore.prefsStorage.fontInterface).to.eql(
          'Current interface',
        )
      })
    })
    describe('pushSyncConfig', () => {
      it('should neither throw nor push while nobody is logged in', () => {
        const store = useSyncConfigStore()
        store.updateCache = vi.fn()
        store.setPreference({ path: 'simple.themeChecksum', value: 'abc' })
        expect(store.dirty).toBe(true)

        expect(() => store.pushSyncConfig()).not.toThrow()
        expect(() => store.pushSyncConfig({ force: true })).not.toThrow()

        expect(store.updateCache).not.toHaveBeenCalled()
        // the change is not lost, it is pushed once there is somebody to push for
        expect(store.dirty).toBe(true)
      })

      it('should let a preference be saved while nobody is logged in', () => {
        const store = useSyncConfigStore()

        expect(() =>
          store.setSimplePrefAndSave({ path: 'themeChecksum', value: 'abc' }),
        ).not.toThrow()

        expect(store.prefsStorage.simple.themeChecksum).toBe('abc')
      })
    })

    describe('setPreference', () => {
      it('should set preference and update journal log accordingly', () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        store.setPreference({ path: 'simple.palette', value: '1' })
        expect(store.prefsStorage.simple.palette).to.eql('1')
        expect(store.prefsStorage._journal).to.have.length(1)
        expect(store.prefsStorage._journal[0]).to.eql({
          path: 'simple.palette',
          operation: 'set',
          args: ['1'],
          // should have A timestamp, we don't really care what it is
          timestamp: store.prefsStorage._journal[0].timestamp,
        })
      })

      it('should keep journal to a minimum', () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        store.setPreference({ path: 'simple.palette', value: 1 })
        store.setPreference({ path: 'simple.palette', value: 2 })
        store.addCollectionPreference({ path: 'collections.palette', value: 2 })
        store.removeCollectionPreference({
          path: 'collections.palette',
          value: 2,
        })
        store.updateCache({ username: 'test' })
        expect(store.prefsStorage.simple.palette).to.eql(2)
        expect(store.prefsStorage.collections.palette).to.eql([])
        expect(store.prefsStorage._journal).to.have.length(2)
        expect(store.prefsStorage._journal[0]).to.eql({
          path: 'simple.palette',
          operation: 'set',
          args: [2],
          // should have A timestamp, we don't really care what it is
          timestamp: store.prefsStorage._journal[0].timestamp,
        })
        expect(store.prefsStorage._journal[1]).to.eql({
          path: 'collections.palette',
          operation: 'removeFromCollection',
          args: [2],
          // should have A timestamp, we don't really care what it is
          timestamp: store.prefsStorage._journal[1].timestamp,
        })
      })

      it('should remove duplicate entries from journal', () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        store.setPreference({ path: 'simple.palette', value: 1 })
        store.setPreference({ path: 'simple.palette', value: 1 })
        store.addCollectionPreference({ path: 'collections.palette', value: 2 })
        store.addCollectionPreference({ path: 'collections.palette', value: 2 })
        store.updateCache({ username: 'test' })
        expect(store.prefsStorage.simple.palette).to.eql(1)
        expect(store.prefsStorage.collections.palette).to.eql([2])
        expect(store.prefsStorage._journal).to.have.length(2)
      })

      // TODO We need a proper test for object-based stores
      it.skip('should remove depth = 3 set/unset entries from journal', () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        store.setPreference({ path: 'simple.fontInput', value: 'test' })
        store.unsetPreference({ path: 'simple.fontInput' })
        store.updateCache(store, { username: 'test' })
        expect(store.prefsStorage.simple.fontInput).to.not.have.property(
          'family',
        )
        expect(store.prefsStorage._journal).to.have.length(1)
      })

      it('should not allow unsetting depth <= 2', () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        store.setPreference({ path: 'simple.object.foo', value: 1 })
        expect(() => store.unsetPreference({ path: 'simple' })).to.throw()
        expect(() =>
          store.unsetPreference({ path: 'simple.object' }),
        ).to.throw()
      })

      it('should not allow (un)setting depth > 3', () => {
        const store = useSyncConfigStore()
        store.pushSyncConfig = vi.fn()
        store.setPreference({ path: 'simple.object', value: {} })
        expect(() =>
          store.setPreference({ path: 'simple.object.lv3', value: 1 }),
        ).to.not.throw()
        expect(() =>
          store.setPreference({ path: 'simple.object.lv3.lv4', value: 1 }),
        ).to.throw()
        expect(() =>
          store.unsetPreference({ path: 'simple.object.lv3', value: 1 }),
        ).to.not.throw()
        expect(() =>
          store.unsetPreference({ path: 'simple.object.lv3.lv4', value: 1 }),
        ).to.throw()
      })
    })
  })

  describe('helper functions', () => {
    describe('_moveItemInArray', () => {
      it('should move item according to movement value', () => {
        expect(_moveItemInArray([1, 2, 3, 4], 4, -1)).to.eql([1, 2, 4, 3])
        expect(_moveItemInArray([1, 2, 3, 4], 1, 2)).to.eql([2, 3, 1, 4])
      })
      it('should clamp movement to within array', () => {
        expect(_moveItemInArray([1, 2, 3, 4], 4, -10)).to.eql([4, 1, 2, 3])
        expect(_moveItemInArray([1, 2, 3, 4], 3, 99)).to.eql([1, 2, 4, 3])
      })
    })
    describe('_getRecentData', () => {
      it('should handle nulls correctly', () => {
        expect(_getRecentData(null, null, true)).to.eql({
          recent: null,
          stale: null,
          needUpload: true,
        })
      })

      it("doesn't choke on invalid data", () => {
        expect(_getRecentData({ a: 1 }, { b: 2 }, true)).to.eql({
          recent: null,
          stale: null,
          needUpload: true,
        })
      })

      it('should prefer the valid non-null correctly, needUpload works properly', () => {
        const nonNull = { _version: VERSION, _timestamp: 1 }
        expect(_getRecentData(nonNull, null, true)).to.eql({
          recent: nonNull,
          stale: null,
          needUpload: true,
        })
        expect(_getRecentData(null, nonNull, true)).to.eql({
          recent: nonNull,
          stale: null,
          needUpload: false,
        })
      })

      it('should prefer the one with higher timestamp', () => {
        const a = { _version: VERSION, _timestamp: 1 }
        const b = { _version: VERSION, _timestamp: 2 }

        expect(_getRecentData(a, b, true)).to.eql({
          recent: b,
          stale: a,
          needUpload: false,
        })
        expect(_getRecentData(b, a, true)).to.eql({
          recent: b,
          stale: a,
          needUpload: false,
        })
      })

      it('case where both are same', () => {
        const a = { _version: VERSION, _timestamp: 3 }
        const b = { _version: VERSION, _timestamp: 3 }

        expect(_getRecentData(a, b, true)).to.eql({
          recent: b,
          stale: a,
          needUpload: false,
        })
        expect(_getRecentData(b, a, true)).to.eql({
          recent: b,
          stale: a,
          needUpload: false,
        })
      })
    })

    describe('_getAllFlags', () => {
      it('should handle nulls properly', () => {
        expect(_getAllFlags(null, null)).to.eql([])
      })
      it('should output list of keys if passed single object', () => {
        expect(
          _getAllFlags({ flagStorage: { a: 1, b: 1, c: 1 } }, null),
        ).to.eql(['a', 'b', 'c'])
      })
      it('should union keys of both objects', () => {
        expect(
          _getAllFlags(
            { flagStorage: { a: 1, b: 1, c: 1 } },
            { flagStorage: { c: 1, d: 1 } },
          ),
        ).to.eql(['a', 'b', 'c', 'd'])
      })
    })

    describe('_mergeFlags', () => {
      it('should handle merge two flag sets correctly picking higher numbers', () => {
        expect(
          _mergeFlags(
            { flagStorage: { a: 0, b: 3 } },
            { flagStorage: { b: 1, c: 4, d: 9 } },
            ['a', 'b', 'c', 'd'],
          ),
        ).to.eql({ a: 0, b: 3, c: 4, d: 9 })
      })
    })

    describe('_mergePrefs', () => {
      it('should prefer recent and apply journal to it', () => {
        expect(
          _mergePrefs(
            // RECENT
            {
              simple: { theme: '1', style: '0', hideISP: true },
              _journal: [
                {
                  path: 'simple.style',
                  operation: 'set',
                  args: ['0'],
                  timestamp: 2,
                },
                {
                  path: 'simple.hideISP',
                  operation: 'set',
                  args: [true],
                  timestamp: 4,
                },
              ],
            },
            // STALE
            {
              simple: { theme: '1', style: '1', hideISP: false },
              _journal: [
                {
                  path: 'simple.theme',
                  operation: 'set',
                  args: ['1'],
                  timestamp: 1,
                },
                {
                  path: 'simple.style',
                  operation: 'set',
                  args: ['1'],
                  timestamp: 3,
                },
              ],
            },
          ),
        ).to.eql({
          simple: { theme: '1', style: '1', hideISP: true },
          _journal: [
            {
              path: 'simple.theme',
              operation: 'set',
              args: ['1'],
              timestamp: 1,
            },
            {
              path: 'simple.style',
              operation: 'set',
              args: ['1'],
              timestamp: 3,
            },
            {
              path: 'simple.hideISP',
              operation: 'set',
              args: [true],
              timestamp: 4,
            },
          ],
        })
      })

      it('should allow setting falsy values', () => {
        expect(
          _mergePrefs(
            // RECENT
            {
              simple: { theme: '1', style: '0', hideISP: false },
              _journal: [
                {
                  path: 'simple.style',
                  operation: 'set',
                  args: ['0'],
                  timestamp: 2,
                },
                {
                  path: 'simple.hideISP',
                  operation: 'set',
                  args: [false],
                  timestamp: 4,
                },
              ],
            },
            // STALE
            {
              simple: { theme: '0', style: '0', hideISP: true },
              _journal: [
                {
                  path: 'simple.theme',
                  operation: 'set',
                  args: ['0'],
                  timestamp: 1,
                },
                {
                  path: 'simple.style',
                  operation: 'set',
                  args: ['0'],
                  timestamp: 3,
                },
              ],
            },
          ),
        ).to.eql({
          simple: { theme: '0', style: '0', hideISP: false },
          _journal: [
            {
              path: 'simple.theme',
              operation: 'set',
              args: ['0'],
              timestamp: 1,
            },
            {
              path: 'simple.style',
              operation: 'set',
              args: ['0'],
              timestamp: 3,
            },
            {
              path: 'simple.hideISP',
              operation: 'set',
              args: [false],
              timestamp: 4,
            },
          ],
        })
      })

      it('should work with strings', () => {
        expect(
          _mergePrefs(
            // RECENT
            {
              simple: { theme: 'foo' },
              _journal: [
                {
                  path: 'simple.theme',
                  operation: 'set',
                  args: ['foo'],
                  timestamp: 2,
                },
              ],
            },
            // STALE
            {
              simple: { theme: 'bar' },
              _journal: [
                {
                  path: 'simple.theme',
                  operation: 'set',
                  args: ['bar'],
                  timestamp: 4,
                },
              ],
            },
          ),
        ).to.eql({
          simple: { theme: 'bar' },
          _journal: [
            {
              path: 'simple.theme',
              operation: 'set',
              args: ['bar'],
              timestamp: 4,
            },
          ],
        })
      })

      it('should work with objects', () => {
        expect(
          _mergePrefs(
            // RECENT
            {
              simple: { fontInput: { lv3: 'foo' } },
              _journal: [
                {
                  path: 'simple.fontInput.lv3',
                  operation: 'set',
                  args: ['foo'],
                  timestamp: 2,
                },
              ],
            },
            // STALE
            {
              simple: { fontInput: { lv3: 'bar' } },
              _journal: [
                {
                  path: 'simple.fontInput.lv3',
                  operation: 'set',
                  args: ['bar'],
                  timestamp: 4,
                },
              ],
            },
          ),
        ).to.eql({
          simple: { fontInput: { lv3: 'bar' } },
          _journal: [
            {
              path: 'simple.fontInput.lv3',
              operation: 'set',
              args: ['bar'],
              timestamp: 4,
            },
          ],
        })
      })

      it('should work with unset', () => {
        expect(
          _mergePrefs(
            // RECENT
            {
              simple: { fontInput: { lv3: 'foo' } },
              _journal: [
                {
                  path: 'simple.fontInput.lv3',
                  operation: 'set',
                  args: ['foo'],
                  timestamp: 2,
                },
              ],
            },
            // STALE
            {
              simple: { fontInput: {} },
              _journal: [
                {
                  path: 'simple.fontInput.lv3',
                  operation: 'unset',
                  args: [],
                  timestamp: 4,
                },
              ],
            },
          ),
        ).to.eql({
          simple: { fontInput: {} },
          _journal: [
            {
              path: 'simple.fontInput.lv3',
              operation: 'unset',
              args: [],
              timestamp: 4,
            },
          ],
        })
      })
    })

    describe('_resetFlags', () => {
      it('should trim all flags to known when reset is set to 1000', () => {
        const totalFlags = { a: 0, b: 3, c: 33, reset: COMMAND_TRIM_FLAGS }

        expect(_resetFlags(totalFlags, { a: 0, b: 0, reset: 0 })).to.eql({
          a: 0,
          b: 3,
          reset: 0,
        })
      })
      it('should trim all flags to known and reset when reset is set to 1001', () => {
        const totalFlags = {
          a: 0,
          b: 3,
          c: 33,
          reset: COMMAND_TRIM_FLAGS_AND_RESET,
        }

        expect(_resetFlags(totalFlags, { a: 0, b: 0, reset: 0 })).to.eql({
          a: 0,
          b: 0,
          reset: 0,
        })
      })
    })
  })
})
