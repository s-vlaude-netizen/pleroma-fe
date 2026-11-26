import sum from 'hash-sum'
import {
  merge as _merge,
  clamp,
  cloneDeep,
  findLastIndex,
  get,
  groupBy,
  isEqual,
  last,
  set,
  take,
  uniqWith,
  unset,
} from 'lodash-es'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { toRaw } from 'vue'

import { CURRENT_UPDATE_COUNTER } from 'src/components/update_notification/update_notification.js'

import { useLocalConfigStore } from 'src/stores/local_config.js'
import { useOAuthStore } from 'src/stores/oauth.js'
import { useUsersStore } from 'src/stores/users.js'

import { updateProfileJSON } from 'src/api/user.js'
import { storage } from 'src/lib/storage.js'
import {
  makeUndefined,
  ROOT_CONFIG,
  ROOT_CONFIG_DEFINITIONS,
  validateSetting,
} from 'src/modules/default_config_state.js'
import { oldDefaultConfigSync } from 'src/modules/old_default_config_state.js'

export const VERSION = 2
export const NEW_USER_DATE = new Date('2026-03-16') // date of writing this, basically

export const COMMAND_TRIM_FLAGS = 1000
export const COMMAND_TRIM_FLAGS_AND_RESET = 1001
export const COMMAND_WIPE_JOURNAL = 1010
export const COMMAND_WIPE_JOURNAL_AND_STORAGE = 1011

export const defaultState = {
  // do we need to update data on server?
  dirty: false,
  // storage of flags - stuff that can only be set and incremented
  flagStorage: {
    updateCounter: 0, // Counter for most recent update notification seen
    reset: 0, // special flag that can be used to force-reset all data, debug purposes only
    // special reset codes:
    // 1000: trim keys to those known by currently running FE
    // 1001: same as above + reset everything to 0
  },
  prefsStorage: {
    _journal: [],
    simple: {
      muteFilters: {},

      ...makeUndefined({ ...ROOT_CONFIG }),
    },
    collections: {
      pinnedStatusActions: ['reply', 'retweet', 'favorite', 'emoji'],
      pinnedNavItems: ['home', 'dms', 'chats'],
    },
  },
  // raw data
  raw: null,
  // local cache
  cache: null,
}

export const newUserFlags = {
  ...defaultState.flagStorage,
  updateCounter: CURRENT_UPDATE_COUNTER, // new users don't need to see update notification
}

export const _moveItemInArray = (array, value, movement) => {
  const oldIndex = array.indexOf(value)
  const newIndex = oldIndex + movement
  const newArray = [...array]
  // remove old
  newArray.splice(oldIndex, 1)
  // add new
  newArray.splice(clamp(newIndex, 0, newArray.length + 1), 0, value)
  return newArray
}

const _wrapData = (data, userName) => {
  return {
    ...data,
    _user: userName,
    _timestamp: Date.now(),
    _version: VERSION,
  }
}

const _checkValidity = (data) => data._timestamp > 0 && data._version > 0

const _verifyPrefs = (state) => {
  state.prefsStorage = state.prefsStorage || {
    simple: {},
    collections: {},
  }

  // Simple
  Object.entries(defaultState.prefsStorage.simple).forEach(([k, v]) => {
    if (v === undefined) return
    if (typeof v === 'number' || typeof v === 'boolean') return
    if (typeof v === 'object') return
    console.warn(
      `Preference simple.${k} as invalid type ${typeof v}, reinitializing`,
    )
    set(state.prefsStorage.simple, k, defaultState.prefsStorage.simple[k])
  })

  // Collections
  Object.entries(defaultState.prefsStorage.collections).forEach(([k, v]) => {
    if (Array.isArray(v)) return
    console.warn(
      `Preference collections.${k} as invalid type ${typeof v}, reinitializing`,
    )
    set(
      state.prefsStorage.collections,
      k,
      defaultState.prefsStorage.collections[k],
    )
  })
}

export const _getRecentData = (cache, live, isTest) => {
  const result = { recent: null, stale: null, needUpload: false }
  const cacheValid = _checkValidity(cache || {})
  const liveValid = _checkValidity(live || {})
  if (!liveValid && cacheValid) {
    result.needUpload = true
    console.debug(
      'Nothing valid stored on server, assuming cache to be source of truth',
    )
    result.recent = cache
    result.stale = live
  } else if (!cacheValid && liveValid) {
    console.debug(
      'Valid storage on server found, no local cache found, using live as source of truth',
    )
    result.recent = live
    result.stale = cache
  } else if (cacheValid && liveValid) {
    console.debug('Both sources have valid data, figuring things out...')
    if (
      live._timestamp === cache._timestamp &&
      live._version === cache._version
    ) {
      console.debug(
        'Same version/timestamp on both sources, source of truth irrelevant',
      )
      result.recent = cache
      result.stale = live
    } else {
      console.debug(
        'Different timestamp or version, figuring out which one is more recent',
      )
      if (live._timestamp < cache._timestamp) {
        result.recent = cache
        result.stale = live
      } else {
        result.recent = live
        result.stale = cache
      }
    }
  } else {
    console.debug('Both sources are invalid, start from scratch')
    result.needUpload = true
  }

  const merge = (a, b) => {
    return {
      _user: a._user ?? b._user,
      _version: a._version ?? b._version,
      _timestamp: a._timestamp ?? b._timestamp,
      needUpload: b.needUpload ?? a.needUpload,
      prefsStorage: _merge(cloneDeep(a.prefsStorage), b.prefsStorage),
      flagStorage: _merge(a.flagStorage, b.flagStorage),
    }
  }

  result.recent = isTest
    ? result.recent
    : result.recent && merge(defaultState, result.recent)

  result.stale = isTest
    ? result.stale
    : result.stale && merge(defaultState, result.stale)

  return result
}

export const _getAllFlags = (recent, stale) => {
  const recentStorage = toRaw(recent?.flagStorage)
  const staleStorage = toRaw(stale?.flagStorage)

  return Array.from(
    new Set([
      ...Object.keys(recentStorage || {}),
      ...Object.keys(staleStorage || {}),
    ]),
  )
}

export const _mergeFlags = (recent, stale, allFlagKeys) => {
  if (!stale.flagStorage) return recent.flagStorage
  if (!recent.flagStorage) return stale.flagStorage
  return Object.fromEntries(
    allFlagKeys.map((flag) => {
      const recentFlag = recent.flagStorage[flag]
      const staleFlag = stale.flagStorage[flag]
      // use flag that is of higher value
      return [
        flag,
        Number((recentFlag > staleFlag ? recentFlag : staleFlag) || 0),
      ]
    }),
  )
}

export const _mergeJournal = (...journals) => {
  // Ignore invalid journal entries
  const allJournals = journals
    .map((j) => (Array.isArray(j) ? j : []))
    .flat()
    .filter(
      (entry) =>
        Object.hasOwn(entry, 'path') &&
        Object.hasOwn(entry, 'operation') &&
        Object.hasOwn(entry, 'args') &&
        Object.hasOwn(entry, 'timestamp'),
    )
  const grouped = groupBy(allJournals, 'path')
  const trimmedGrouped = Object.entries(grouped).map(([path, rawJournal]) => {
    const journal = rawJournal
      .map((data, index) => ({ data, index }))
      .toSorted(({ data: a, index: ai }, { data: b, index: bi }) => {
        if (a.timestamp === b.timestamp) {
          return ai - bi
        } else {
          return a.timestamp > b.timestamp ? 1 : -1
        }
      })
      .map((x) => x.data)

    if (path.startsWith('collections')) {
      const lastRemoveIndex = findLastIndex(
        journal,
        ({ operation }) => operation === 'removeFromCollection',
      )
      // everything before last remove is unimportant
      let remainder
      if (lastRemoveIndex > 0) {
        remainder = journal.slice(lastRemoveIndex)
      } else {
        // everything else doesn't need trimming
        remainder = journal
      }
      return uniqWith(remainder, (a, b) => {
        if (a.path !== b.path) {
          return false
        }
        if (a.operation !== b.operation) {
          return false
        }
        if (a.operation === 'addToCollection') {
          return a.args[0] === b.args[0]
        }
        return false
      })
    } else if (path.startsWith('simple')) {
      // Only the last record is important
      return [last(journal)]
    } else {
      return journal
    }
  })

  const flat = trimmedGrouped
    .flat()
    .map((data, index) => ({ data, index }))
    .toSorted(({ data: a, index: ai }, { data: b, index: bi }) => {
      if (a.timestamp === b.timestamp) {
        return ai - bi
      } else {
        return a.timestamp > b.timestamp ? 1 : -1
      }
    })
    .map((x) => x.data)
  return take(flat, 500)
}

export const _mergePrefs = (recent, stale) => {
  if (!stale) return recent
  if (!recent) return stale
  const { _journal: recentJournal, ...recentData } = recent
  const { _journal: staleJournal } = stale
  /** Journal entry format:
   * path: path to entry in prefsStorage
   * timestamp: timestamp of the change
   * operation: operation type
   * arguments: array of arguments, depends on operation type
   *
   * currently only supported operation type is "set" which just sets the value
   * to requested one. Intended only to be used with simple preferences (boolean, number)
   * shouldn't be used with collections!
   */
  const resultOutput = { ...recentData }
  const totalJournal = _mergeJournal(staleJournal, recentJournal)
  totalJournal
    .filter(({ path, operation, args }) => {
      const entry = path.split('.')[1]
      if (operation === 'unset') return ROOT_CONFIG[entry] !== undefined

      if (operation !== 'set') return true

      const definition = path.startsWith('simple.muteFilters')
        ? { default: {} }
        : ROOT_CONFIG_DEFINITIONS[entry]

      const finalValue = validateSetting({
        path,
        value: args[0],
        definition,
        throwError: false,
        defaultState: ROOT_CONFIG,
      })

      return finalValue !== undefined
    })
    .forEach(({ path, operation, args }) => {
      if (path.startsWith('_')) {
        throw new Error(
          `journal contains entry to edit internal (starts with _) field '${path}', something is incorrect here, ignoring.`,
        )
      }
      switch (operation) {
        case 'set': {
          if (path.startsWith('collections')) {
            return console.error('Illegal operation "set" on a collection')
          }
          if (path.split(/\./g).length <= 1) {
            return console.error(
              `Calling set on depth <= 1 (path: ${path}) is not allowed`,
            )
          }
          set(resultOutput, path, args[0])
          break
        }
        case 'unset':
          if (path.startsWith('collections')) {
            return console.error('Illegal operation "unset" on a collection')
          }
          if (path.split(/\./g).length <= 2) {
            return console.error(
              `Calling unset on depth <= 2 (path: ${path})  is not allowed`,
            )
          }
          unset(resultOutput, path)
          break
        case 'addToCollection':
          if (!path.startsWith('collections')) {
            return console.error(
              'Illegal operation "addToCollection" on a non-collection',
            )
          }
          set(
            resultOutput,
            path,
            Array.from(new Set(get(resultOutput, path)).add(args[0])),
          )
          break
        case 'removeFromCollection': {
          if (!path.startsWith('collections')) {
            return console.error(
              'Illegal operation "removeFromCollection" on a non-collection',
            )
          }
          const newSet = new Set(get(resultOutput, path))
          newSet.delete(args[0])
          set(resultOutput, path, Array.from(newSet))
          break
        }
        case 'reorderCollection': {
          const [value, movement] = args
          set(
            resultOutput,
            path,
            _moveItemInArray(get(resultOutput, path), value, movement),
          )
          break
        }
        default:
          return console.error(
            `Unknown journal operation: '${operation}', did we forget to run reverse migrations beforehand?`,
          )
      }
    })
  return { ...resultOutput, _journal: totalJournal }
}

export const _resetFlags = (
  totalFlags,
  knownKeys = defaultState.flagStorage,
) => {
  let result = { ...totalFlags }
  const allFlagKeys = Object.keys(totalFlags)
  // flag reset functionality
  if (
    totalFlags.reset >= COMMAND_TRIM_FLAGS &&
    totalFlags.reset <= COMMAND_TRIM_FLAGS_AND_RESET
  ) {
    console.debug('Received command to trim the flags')
    const knownKeysSet = new Set(Object.keys(knownKeys))

    // Trim
    result = {}
    allFlagKeys.forEach((flag) => {
      if (knownKeysSet.has(flag)) {
        result[flag] = totalFlags[flag]
      }
    })

    // Reset
    if (totalFlags.reset === COMMAND_TRIM_FLAGS_AND_RESET) {
      // 1001 - and reset everything to 0
      console.debug('Received command to reset the flags')
      Object.keys(knownKeys).forEach((flag) => {
        result[flag] = 0
      })
    }
  }
  result.reset = 0
  return result
}

const _resetPrefs = (
  totalPrefs,
  totalFlags,
  knownKeys = defaultState.flagStorage,
) => {
  // prefs reset functionality
  if (
    totalFlags.reset >= COMMAND_WIPE_JOURNAL &&
    totalFlags.reset <= COMMAND_WIPE_JOURNAL_AND_STORAGE
  ) {
    console.debug('Received command to reset journals')
    this.flagStorage.reset = COMMAND_WIPE_JOURNAL
    this.prefsStorage._journal = []
    this.cache.prefsStorage._journal = []
    this.raw.prefsStorage._journal = []
    this.pushSyncConfig()
    if (totalFlags.reset === COMMAND_WIPE_JOURNAL_AND_STORAGE) {
      console.debug('Received command to reset storage')
      return cloneDeep(defaultState)
    }
  }
  return totalPrefs
}

const _doMigrations = async (data, setPreference) => {
  if (data._version < VERSION) {
    console.debug(
      'Data has older version, seeing if there any migrations that can be applied',
    )
  }

  if (data._version > VERSION) {
    console.debug(
      'Data has newer version, seeing if there any reverse migrations that can be applied',
    )

    // no reverse migrations right now but we leave a possibility of loading a hotpatch if need be
    if (window._PLEROMA_HOTPATCH) {
      if (window._PLEROMA_HOTPATCH.reverseMigrations) {
        console.debug('Found hotpatch migration, applying')
        return window._PLEROMA_HOTPATCH.reverseMigrations.call(
          {},
          'syncConfigStore',
          { from: data._version, to: VERSION },
          data,
        )
      }
    }
  }

  return data
}

export const useSyncConfigStore = defineStore('sync_config', {
  state() {
    return cloneDeep(defaultState)
  },
  actions: {
    setFlag({ flag, value }) {
      this.flagStorage[flag] = value
      this.dirty = true
    },
    setSimplePrefAndSave({ path, value }) {
      this.setPreference({ path: `simple.${path}`, value })
      this.pushSyncConfig()
    },
    unsetSimplePrefAndSave({ path }) {
      this.unsetPreference({ path: `simple.${path}` })
      this.pushSyncConfig()
    },
    setPreference({ path, value }) {
      if (path.startsWith('_')) {
        throw new Error(
          `Tried to edit internal (starts with _) field '${path}', ignoring.`,
        )
      }
      if (path.startsWith('collections')) {
        throw new Error(
          `Invalid operation 'set' for collection field '${path}', ignoring.`,
        )
      }
      if (path.split(/\./g).length <= 1) {
        throw new Error(
          `Calling set on depth <= 1 (path: ${path}) is not allowed`,
        )
      }
      if (path.split(/\./g).length > 3) {
        throw new Error(
          `Calling set on depth > 3 (path: ${path})  is not allowed`,
        )
      }

      if (path.startsWith('collections.')) return value

      const definition = path.startsWith('simple.muteFilters')
        ? { default: {} }
        : ROOT_CONFIG_DEFINITIONS[path.split('.')[1]]

      const finalValue = validateSetting({
        path,
        value,
        definition,
        throwError: false,
        defaultState: ROOT_CONFIG,
      })

      if (finalValue !== undefined) set(this.prefsStorage, path, finalValue)

      this.prefsStorage._journal = [
        ...this.prefsStorage._journal,
        { operation: 'set', path, args: [value], timestamp: Date.now() },
      ]
      this.dirty = true
    },
    unsetPreference({ path, value }) {
      if (path.startsWith('_')) {
        throw new Error(
          `Tried to edit internal (starts with _) field '${path}', ignoring.`,
        )
      }
      if (path.startsWith('collections')) {
        throw new Error(
          `Invalid operation 'unset' for collection field '${path}', ignoring.`,
        )
      }
      if (path.split(/\./g).length <= 2) {
        throw new Error(
          `Calling unset on depth <= 2 (path: ${path})  is not allowed`,
        )
      }
      if (path.split(/\./g).length > 3) {
        throw new Error(
          `Calling unset on depth > 3 (path: ${path})  is not allowed`,
        )
      }
      unset(this.prefsStorage, path)
      this.prefsStorage._journal = [
        ...this.prefsStorage._journal,
        { operation: 'unset', path, args: [], timestamp: Date.now() },
      ]
      this.dirty = true
    },
    addCollectionPreference({ path, value }) {
      if (path.startsWith('_')) {
        throw new Error(
          `tried to edit internal (starts with _) field '${path}'`,
        )
      }
      if (path.startsWith('collections')) {
        const collection = new Set(get(this.prefsStorage, path))
        collection.add(value)
        set(this.prefsStorage, path, [...collection])
      }
      this.prefsStorage._journal = [
        ...this.prefsStorage._journal,
        {
          operation: 'addToCollection',
          path,
          args: [value],
          timestamp: Date.now(),
        },
      ]
      this.dirty = true
    },
    removeCollectionPreference({ path, value }) {
      if (path.startsWith('_')) {
        throw new Error(
          `tried to edit internal (starts with _) field '${path}', ignoring.`,
        )
      }

      const { _key } = value
      if (path.startsWith('collection')) {
        const collection = new Set(get(this.prefsStorage, path))
        collection.delete(value)
        set(this.prefsStorage, path, [...collection])

        this.prefsStorage._journal = [
          ...this.prefsStorage._journal,
          {
            operation: 'removeFromCollection',
            path,
            args: [value],
            timestamp: Date.now(),
          },
        ]
        this.dirty = true
      }
    },
    reorderCollectionPreference({ path, value, movement }) {
      if (path.startsWith('_')) {
        throw new Error(
          `tried to edit internal (starts with _) field '${path}', ignoring.`,
        )
      }
      const collection = get(this.prefsStorage, path)
      const newCollection = _moveItemInArray(collection, value, movement)
      set(this.prefsStorage, path, newCollection)
      this.prefsStorage._journal = [
        ...this.prefsStorage._journal,
        {
          operation: 'arrangeCollection',
          path,
          args: [value],
          timestamp: Date.now(),
        },
      ]
      this.dirty = true
    },
    updateCache({ username }) {
      this.prefsStorage._journal = _mergeJournal(this.prefsStorage._journal)
      this.cache = _wrapData(
        {
          flagStorage: toRaw(this.flagStorage),
          prefsStorage: toRaw(this.prefsStorage),
        },
        username,
      )
    },
    clearSyncConfig() {
      const blankState = { ...cloneDeep(defaultState) }
      Object.keys(this).forEach((k) => {
        this[k] = blankState[k]
      })
      this.flagStorage.reset = COMMAND_WIPE_JOURNAL_AND_STORAGE
    },
    async initSyncConfig(userData) {
      const live = userData.storage
      this.raw = live
      let cache = this.cache
      if (cache?._user !== userData.fqn) {
        console.warn(
          'Cache belongs to another user! reinitializing local cache!',
        )
        cache = null
      }

      let { recent, stale, needUpload } = _getRecentData(cache, live)

      const userNew = userData.created_at > NEW_USER_DATE
      const flagsTemplate = userNew ? newUserFlags : defaultState.flagStorage
      let dirty = false

      if (recent === null) {
        console.debug(
          `Data is empty, initializing for ${userNew ? 'new' : 'existing'} user`,
        )
        recent = _wrapData({
          flagStorage: { ...flagsTemplate },
          prefsStorage: cloneDeep(defaultState.prefsStorage),
        })
      }

      recent = recent && (await _doMigrations(recent, this.setPreference))
      stale = stale && (await _doMigrations(stale, this.setPreference))

      if (!needUpload && recent && stale) {
        console.debug('Checking if data needs merging...')
        // discarding timestamps and versions
        const { _timestamp: _0, _version: _1, ...recentData } = recent
        const { _timestamp: _2, _version: _3, ...staleData } = stale
        dirty = sum(recentData) !== sum(staleData)
        console.debug(`Data ${dirty ? 'needs' : "doesn't need"} merging`)
      }

      const allFlagKeys = _getAllFlags(recent, stale)
      let totalFlags
      let totalPrefs
      if (dirty) {
        // Merge the flags
        console.debug('Merging the data...')
        totalFlags = _mergeFlags(recent, stale, allFlagKeys)
        _verifyPrefs(recent)
        _verifyPrefs(stale)
        totalPrefs = _mergePrefs(recent.prefsStorage, stale.prefsStorage)
      } else {
        totalFlags = recent.flagStorage
        totalPrefs = recent.prefsStorage
      }

      totalPrefs = _resetPrefs(totalPrefs, totalFlags)
      totalFlags = _resetFlags(totalFlags)

      recent.flagStorage = { ...flagsTemplate, ...totalFlags }
      recent.prefsStorage = { ...defaultState.prefsStorage, ...totalPrefs }

      this.cache = recent
      this.flagStorage = this.cache.flagStorage
      this.prefsStorage = this.cache.prefsStorage
      if (!Array.isArray(this.prefsStorage._journal)) {
        this.prefsStorage._journal = []
      }

      // Various migrations
      console.debug('Migrating from old config')
      const vuexState = (await storage.getItem('vuex-lz')) ?? {}
      const config = vuexState.config ?? {}

      const migratedEntries = new Set(config._syncMigration ?? [])
      console.debug(
        `Already migrated Values: ${[...migratedEntries].join() || '[none]'}`,
      )

      Object.entries(oldDefaultConfigSync).forEach(([key, value]) => {
        const oldValue = config[key]
        const defaultValue = value
        const migrated = migratedEntries.has(key)
        const preferencePath =
          key === 'theme3hacks' ? 'simple.underlay' : `simple.${key}`

        const present = oldValue !== undefined
        const different = !isEqual(oldValue, defaultValue)
        const preferenceHandled =
          get(this.prefsStorage, preferencePath) !== undefined ||
          this.prefsStorage._journal.some(
            (entry) =>
              entry?.path === preferencePath ||
              entry?.path?.startsWith?.(`${preferencePath}.`),
          )

        if (present && different && !preferenceHandled) {
          console.debug(`Migrating config ${key}: ${oldValue}`)
          if (key === 'theme3hacks') {
            if (!migrated) {
              useLocalConfigStore().set({
                path: 'fontInterface',
                value: oldValue.fonts.interface,
              })
              useLocalConfigStore().set({
                path: 'fontInput',
                value: oldValue.fonts.input,
              })
              useLocalConfigStore().set({
                path: 'fontPosts',
                value: oldValue.fonts.post,
              })
              useLocalConfigStore().set({
                path: 'fontMonospace',
                value: oldValue.fonts.monospace,
              })
            }
            this.setPreference({
              path: 'simple.underlay',
              value: oldValue.underlay,
            })
          } else if (key == 'muteWords') {
            oldValue.forEach((word, order) => {
              const uniqueId = uuidv4()

              this.setPreference({
                path: 'simple.muteFilters.' + uniqueId,
                value: {
                  type: 'word',
                  value: word,
                  name: word,
                  enabled: true,
                  expires: null,
                  hide: false,
                  order,
                },
              })
            })
          } else {
            this.setPreference({ path: preferencePath, value: oldValue })
          }
          migratedEntries.add(key)
          needUpload = true
        }
      })

      config._syncMigration = [...migratedEntries]
      vuexState.config = config
      storage.setItem('vuex-lz', vuexState)

      this.dirty = dirty || needUpload
      // set local timestamp to smaller one if we don't have any changes
      if (stale && recent && !this.dirty) {
        this.cache._timestamp = Math.min(stale._timestamp, recent._timestamp)
      }
      this.pushSyncConfig()
    },
    pushSyncConfig({ force = false } = {}) {
      const needPush = this.dirty || force
      if (!needPush) return
      // There is nobody to push for while logged out (or until the user is
      // loaded at startup). The changes stay marked as dirty for later.
      const { currentUser } = useUsersStore()
      if (!currentUser) return
      this.updateCache({ username: currentUser.fqn })
      const params = { pleroma_settings_store: { 'pleroma-fe': this.cache } }
      updateProfileJSON({
        params,
        credentials: useOAuthStore().token,
      })
    },
  },
  persist: {
    afterLoad(state) {
      console.debug('Validating persisted state of SyncConfig')
      const newState = { ...state }
      newState.prefsStorage = newState.prefsStorage || {}
      const newEntries = Object.entries(ROOT_CONFIG).map(([path, value]) => {
        const definition = ROOT_CONFIG_DEFINITIONS[path]
        const finalValue = validateSetting({
          path,
          value: newState.prefsStorage.simple?.[path],
          definition,
          throwError: false,
          validateObjects: false,
          defaultState: ROOT_CONFIG,
        })

        return finalValue === undefined
          ? [path, definition.default]
          : [path, finalValue]
      })
      newState.prefsStorage.simple = Object.fromEntries(
        newEntries.filter(Boolean),
      )
      return newState
    },
  },
})
