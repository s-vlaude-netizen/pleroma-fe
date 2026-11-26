/* global process */

import vClickOutside from 'click-outside-vue3'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import VueVirtualScroller from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

import InstancePicker from 'src/components/instance_picker/instance_picker.vue'
import RichContent from 'src/components/rich_content/rich_content.jsx'
import Status from 'src/components/status/status.vue'
import StillImage from 'src/components/still-image/still-image.vue'

import { config } from '@fortawesome/fontawesome-svg-core'
import {
  FontAwesomeIcon,
  FontAwesomeLayers,
} from '@fortawesome/vue-fontawesome'

config.autoAddCss = false

import App from '../App.vue'
import FaviconService from '../services/favicon_service/favicon_service.js'
import { applyStyleConfig } from '../services/style_setter/style_setter.js'
import { initServiceWorker, updateFocus } from '../services/sw/sw.js'
import {
  windowHeight,
  windowWidth,
} from '../services/window_utils/window_utils'

import { useAuthFlowStore } from 'src/stores/auth_flow'
import { useChatsStore } from 'src/stores/chats.js'
import { useEmojiStore } from 'src/stores/emoji.js'
import { useI18nStore } from 'src/stores/i18n'
import { useInstanceStore } from 'src/stores/instance.js'
import { useInstanceCapabilitiesStore } from 'src/stores/instance_capabilities.js'
import { useInterfaceStore } from 'src/stores/interface.js'
import { useLocalConfigStore } from 'src/stores/local_config.js'
import { useMergedConfigStore } from 'src/stores/merged_config.js'
import { useNotificationsStore } from 'src/stores/notifications.js'
import { useOAuthStore } from 'src/stores/oauth.js'
import { useStatusesStore } from 'src/stores/statuses.js'
import { useSyncConfigStore } from 'src/stores/sync_config.js'
import { useUserHighlightStore } from 'src/stores/user_highlight.js'
import { useUsersStore } from 'src/stores/users.js'

import { apiUrl, setApiBase } from 'src/api/api_base.js'
import { getRoutes } from 'src/boot/routes.js'
import VBodyScrollLock from 'src/directives/body_scroll_lock'
import { withTimeout } from 'src/lib/with_timeout.js'
import {
  INSTANCE_DEFAULT_CONFIG_DEFINITIONS,
  INSTANCE_IDENTITY_DEFAULT_DEFINITIONS,
  INSTANCE_IDENTIY_EXTERNAL,
} from 'src/modules/default_config_state.js'
import {
  chosenInstance,
  instanceConfig,
  isHosted,
} from 'src/services/hosted/hosted.js'

// A locked or damaged browser database may never answer, and the app can't
// start without its settings. Past this it starts with the defaults instead.
const STORAGE_LOAD_TIMEOUT = 10000

let staticInitialResults = null

const parsedInitialResults = () => {
  if (!document.getElementById('initial-results')) {
    return null
  }
  if (!staticInitialResults) {
    staticInitialResults = JSON.parse(
      document.getElementById('initial-results').textContent,
    )
  }
  return staticInitialResults
}

const decodeUTF8Base64 = (data) => {
  const rawData = atob(data)
  const array = Uint8Array.from([...rawData].map((char) => char.codePointAt(0)))
  const text = new TextDecoder().decode(array)
  return text
}

const preloadFetch = async (request) => {
  const data = parsedInitialResults()
  if (!data?.[request]) {
    return window.fetch(apiUrl(request))
  }
  const decoded = decodeUTF8Base64(data[request])
  const requestData = JSON.parse(decoded)
  return {
    ok: true,
    json: () => requestData,
    text: () => requestData,
  }
}

const getInstanceConfig = async ({ store }) => {
  try {
    const res = await preloadFetch('/api/v1/instance')
    if (res.ok) {
      const data = await res.json()
      const textLimit = data.max_toot_chars
      const vapidPublicKey = data.pleroma.vapid_public_key

      useInstanceCapabilitiesStore().set(
        'pleromaExtensionsAvailable',
        data.pleroma,
      )
      useInstanceStore().set({
        path: 'limits.textLimit',
        value: textLimit,
      })
      useInstanceStore().set({
        path: 'accountApprovalRequired',
        value: data.approval_required,
      })
      useInstanceStore().set({
        path: 'birthdayRequired',
        value: !!data.pleroma?.metadata.birthday_required,
      })
      useInstanceStore().set({
        path: 'birthdayMinAge',
        value: data.pleroma?.metadata.birthday_min_age || 0,
      })

      if (vapidPublicKey) {
        useInstanceStore().set({
          path: 'vapidPublicKey',
          value: vapidPublicKey,
        })
      }
    } else {
      throw res
    }
  } catch (error) {
    console.error('Could not load instance config, potentially fatal')
    console.error(error)
  }
  // We should check for scrobbles support here but it requires userId
  // so instead we check for it where it's fetched (statuses.js)
}

const getBackendProvidedConfig = async () => {
  try {
    const res = await window.fetch(
      apiUrl('/api/pleroma/frontend_configurations'),
    )
    if (res.ok) {
      const data = await res.json()
      return data.pleroma_fe
    } else {
      throw res
    }
  } catch (error) {
    console.error(
      'Could not load backend-provided frontend config, potentially fatal',
    )
    console.error(error)
  }
}

const getStaticConfig = async () => {
  try {
    const res = await window.fetch('/static/config.json')
    if (res.ok) {
      return res.json()
    } else {
      throw res
    }
  } catch (error) {
    console.warn(
      'Failed to load static/config.json, continuing without it.',
      error,
    )
    return {}
  }
}

const setSettings = async ({ apiConfig, staticConfig, store }) => {
  const overrides = window.___pleromafe_dev_overrides || {}
  const env = window.___pleromafe_mode.NODE_ENV

  // This takes static config and overrides properties that are present in apiConfig
  let config = {}
  if (overrides.staticConfigPreference && env === 'development') {
    console.warn('OVERRIDING API CONFIG WITH STATIC CONFIG')
    config = { ...apiConfig, ...staticConfig }
  } else {
    config = { ...staticConfig, ...apiConfig }
  }

  Object.keys(INSTANCE_IDENTITY_DEFAULT_DEFINITIONS).forEach((source) => {
    if (source === 'name') return
    if (INSTANCE_IDENTIY_EXTERNAL.has(source)) return
    useInstanceStore().set({
      value:
        config[source] ?? INSTANCE_IDENTITY_DEFAULT_DEFINITIONS[source].default,
      path: `instanceIdentity.${source}`,
    })
  })

  Object.keys(INSTANCE_DEFAULT_CONFIG_DEFINITIONS).forEach((source) =>
    useInstanceStore().set({
      value:
        config[source] ?? INSTANCE_DEFAULT_CONFIG_DEFINITIONS[source].default,
      path: `prefsStorage.${source}`,
    }),
  )

  useAuthFlowStore().setInitialStrategy(config.loginMethod)
}

const getTOS = async ({ store }) => {
  try {
    const res = await window.fetch(apiUrl('/static/terms-of-service.html'))
    if (res.ok) {
      const html = await res.text()
      useInstanceStore().set({ path: 'instanceIdentity.tos', value: html })
    } else {
      throw res
    }
  } catch (e) {
    console.warn("Can't load TOS\n", e)
  }
}

const getInstancePanel = async ({ store }) => {
  try {
    const res = await preloadFetch('/instance/panel.html')
    if (res.ok) {
      const html = await res.text()
      useInstanceStore().set({
        path: 'instanceIdentity.instanceSpecificPanelContent',
        value: html,
      })
    } else {
      throw res
    }
  } catch (e) {
    console.warn("Can't load instance panel\n", e)
  }
}

const getStickers = async ({ store }) => {
  try {
    // the instance's sticker packs (hosted: on the instance)
    const res = await window.fetch(apiUrl('/static/stickers.json'))
    if (res.ok) {
      const values = await res.json()
      const stickers = (
        await Promise.all(
          Object.entries(values).map(async ([name, packPath]) => {
            const path = apiUrl(packPath)
            const resPack = await window.fetch(path + 'pack.json')
            let meta = {}
            if (resPack.ok) {
              meta = await resPack.json()
            }
            return {
              pack: name,
              path,
              meta,
            }
          }),
        )
      ).sort((a, b) => {
        return a.meta.title.localeCompare(b.meta.title)
      })
      useEmojiStore().setStickers(stickers)
    } else {
      throw res
    }
  } catch (e) {
    console.warn("Can't load stickers\n", e)
  }
}

const resolveStaffAccounts = ({ store, accounts }) => {
  const nicknames = accounts.map((uri) => uri.split('/').pop())
  useInstanceStore().set({
    path: 'staffAccounts',
    value: nicknames,
  })
}

const getNodeInfo = async ({ store }) => {
  try {
    let res = await preloadFetch('/nodeinfo/2.1.json')
    if (!res.ok) res = await preloadFetch('/nodeinfo/2.0.json')
    if (res.ok) {
      const data = await res.json()
      const metadata = data.metadata
      const features = metadata.features
      useInstanceStore().set({
        path: 'instanceIdentity.name',
        value: metadata.nodeName,
      })
      useInstanceStore().set({
        path: 'registrationOpen',
        value: data.openRegistrations,
      })
      useInstanceCapabilitiesStore().set(
        'mediaProxyAvailable',
        features.includes('media_proxy'),
      )
      useInstanceCapabilitiesStore().set(
        'safeDM',
        features.includes('safe_dm_mentions'),
      )
      useInstanceCapabilitiesStore().set(
        'shoutAvailable',
        features.includes('chat'),
      )
      useInstanceCapabilitiesStore().set(
        'pleromaChatMessagesAvailable',
        features.includes('pleroma_chat_messages'),
      )
      useInstanceCapabilitiesStore().set(
        'pleromaCustomEmojiReactionsAvailable',

        features.includes('pleroma_custom_emoji_reactions') ||
          features.includes('custom_emoji_reactions'),
      )
      useInstanceCapabilitiesStore().set(
        'pleromaBookmarkFoldersAvailable',
        features.includes('pleroma:bookmark_folders'),
      )
      useInstanceCapabilitiesStore().set(
        'gopherAvailable',
        features.includes('gopher'),
      )
      useInstanceCapabilitiesStore().set(
        'pollsAvailable',
        features.includes('polls'),
      )
      useInstanceCapabilitiesStore().set(
        'editingAvailable',
        features.includes('editing'),
      )
      useInstanceCapabilitiesStore().set(
        'mailerEnabled',
        metadata.mailerEnabled,
      )
      useInstanceCapabilitiesStore().set(
        'quotingAvailable',
        features.includes('quote_posting'),
      )
      useInstanceCapabilitiesStore().set(
        'groupActorAvailable',
        features.includes('pleroma:group_actors'),
      )
      useInstanceCapabilitiesStore().set(
        'blockExpiration',
        features.includes('pleroma:block_expiration'),
      )
      useInstanceStore().set({
        path: 'localBubbleInstances',
        value: metadata.localBubbleInstances ?? [],
      })
      useInstanceCapabilitiesStore().set(
        'localBubble',
        (metadata.localBubbleInstances ?? []).length > 0,
      )

      useInstanceStore().set({
        path: 'limits.pollLimits',
        value: metadata.pollLimits,
      })
      const uploadLimits = metadata.uploadLimits
      useInstanceStore().set({
        path: 'limits.uploadlimit',
        value: Number.parseInt(uploadLimits.general),
      })
      useInstanceStore().set({
        path: 'limits.avatarlimit',
        value: Number.parseInt(uploadLimits.avatar),
      })
      useInstanceStore().set({
        path: 'limits.backgroundlimit',
        value: Number.parseInt(uploadLimits.background),
      })
      useInstanceStore().set({
        path: 'limits.bannerlimit',
        value: Number.parseInt(uploadLimits.banner),
      })
      useInstanceStore().set({
        path: 'limits.fieldsLimits',
        value: metadata.fieldsLimits,
      })

      useInstanceStore().set({
        path: 'restrictedNicknames',
        value: metadata.restrictedNicknames,
      })
      useInstanceCapabilitiesStore().set('postFormats', metadata.postFormats)

      const suggestions = metadata.suggestions
      useInstanceCapabilitiesStore().set(
        'suggestionsEnabled',
        suggestions.enabled,
      )
      // this is unused, why?
      useInstanceCapabilitiesStore().set('suggestionsWeb', suggestions.web)

      const software = data.software
      useInstanceStore().set({
        path: 'backendVersion',
        value: software.version,
      })
      useInstanceStore().set({
        path: 'backendRepository',
        value: software.repository,
      })

      const priv = metadata.private
      useInstanceStore().set({ path: 'privateMode', value: priv })

      const frontendVersion = window.___pleromafe_commit_hash
      useInstanceStore().set({
        path: 'frontendVersion',
        value: frontendVersion,
      })

      const federation = metadata.federation

      useInstanceCapabilitiesStore().set(
        'tagPolicyAvailable',
        federation.mrf_policies === undefined
          ? false
          : metadata.federation.mrf_policies.includes('TagPolicy'),
      )

      useInstanceStore().set({
        path: 'federationPolicy',
        value: federation,
      })
      useInstanceStore().set({
        path: 'federating',
        value: federation.enabled === undefined ? true : federation.enabled,
      })

      const accountActivationRequired = metadata.accountActivationRequired
      useInstanceStore().set({
        path: 'accountActivationRequired',
        value: accountActivationRequired,
      })

      const accounts = metadata.staffAccounts
      resolveStaffAccounts({ store, accounts })
    } else {
      throw res
    }
  } catch (e) {
    console.warn('Could not load nodeinfo', e)
  }
}

const setConfig = async ({ store, staticConfig, backendConfig }) => {
  // hosted: the instance's paths point at the instance, login redirects
  const apiConfig = isHosted(staticConfig)
    ? instanceConfig(await getBackendProvidedConfig(), apiUrl)
    : backendConfig

  await setSettings({ store, apiConfig, staticConfig })
}

// Hosted mode with no instance chosen yet: ask for one instead of starting
// the app. The theme is applied first so the question looks like the app.
const showInstancePicker = async ({ pinia, i18n }) => {
  try {
    await useInterfaceStore().applyTheme()
  } catch (e) {
    console.warn('No theme for the instance picker', e)
  }
  const picker = createApp(InstancePicker)
  picker.use(pinia)
  picker.use(i18n)
  picker.component('FAIcon', FontAwesomeIcon)
  picker.mount('#app')
  document.querySelector('#splash')?.remove()
  document.querySelector('#app').classList.remove('hidden')
}

const checkOAuthToken = async ({ store }) => {
  const oauth = useOAuthStore()
  if (oauth.userToken) {
    return useUsersStore().loginUser(oauth.userToken)
  }
}

const afterStoreSetup = async ({ pinia, store, storageError, i18n }) => {
  const app = createApp(App)
  // Must have app use pinia before we do anything that touches the store
  // https://pinia.vuejs.org/core-concepts/plugins.html#Introduction
  // "Plugins are only applied to stores created after the plugins themselves, and after pinia is passed to the app, otherwise they won't be applied."
  app.use(pinia)

  app.config.errorHandler = (error, instance, info) => {
    console.error(
      'Global Vue Error Handler caught an error:',
      error,
      instance,
      info,
    )
    useInterfaceStore().setGlobalError({ error, instance, info })
  }

  const waitForAllStoresToLoad = async () => {
    // the stores that do not persist technically do not need to be awaited here,
    // but that involves either hard-coding the stores in some place (prone to errors)
    // or writing another vite plugin to analyze which stores needs persisting (++load time)
    const allStores = import.meta.glob('../stores/*.js', { eager: true })
    if (process.env.NODE_ENV === 'development') {
      // do some checks to avoid common errors
      if (!Object.keys(allStores).length) {
        throw new TypeError(
          'No stores are available. Check the code in src/boot/after_store.js',
        )
      }
    }
    await Promise.all(
      Object.entries(allStores).map(async ([name, mod]) => {
        const isStoreName = (name) => name.startsWith('use')
        if (process.env.NODE_ENV === 'development') {
          if (Object.keys(mod).filter(isStoreName).length !== 1) {
            throw new TypeError(
              'Each store file must export exactly one store as a named export. Check your code in src/stores/',
            )
          }
        }
        const storeFuncName = Object.keys(mod).find(isStoreName)
        if (storeFuncName && typeof mod[storeFuncName] === 'function') {
          const p = mod[storeFuncName]().$persistLoaded
          if (!(p instanceof Promise)) {
            throw new TypeError(
              `${name} store's $persistLoaded is not a Promise. The persist plugin is not applied.`,
            )
          }
          await p
        } else {
          throw new TypeError(
            `Store module ${name} does not export a 'use...' function`,
          )
        }
      }),
    )
  }

  let newStorageError
  try {
    await withTimeout(
      waitForAllStoresToLoad(),
      STORAGE_LOAD_TIMEOUT,
      'the browser storage',
    )
  } catch (e) {
    console.error('Cannot load stores:', e)
    newStorageError = e
  }

  if (storageError || newStorageError) {
    useInterfaceStore().pushGlobalNotice({
      messageKey: 'errors.storage_unavailable',
      level: 'error',
    })
  }

  useInterfaceStore().setLayoutWidth(windowWidth())
  useInterfaceStore().setLayoutHeight(windowHeight())

  window.syncConfig = useSyncConfigStore()
  window.mergedConfig = useMergedConfigStore()
  window.localConfig = useLocalConfigStore()
  window.highlightConfig = useUserHighlightStore()

  FaviconService.initFaviconService()
  initServiceWorker(useNotificationsStore())

  window.addEventListener('focus', () => updateFocus())

  // both at once; a hosted site asks the chosen instance again in setConfig
  const [staticConfig, backendConfig] = await Promise.all([
    getStaticConfig(),
    getBackendProvidedConfig(),
  ])
  const hosted = isHosted(staticConfig)
  if (hosted && !chosenInstance()) {
    await showInstancePicker({ pinia, i18n })
    return app
  }
  if (hosted) setApiBase(chosenInstance())
  useInstanceStore().set({ path: 'hosted', value: hosted })

  const overrides = window.___pleromafe_dev_overrides || {}
  const server = hosted
    ? chosenInstance()
    : overrides.target !== undefined
      ? overrides.target
      : window.location.origin
  useInstanceStore().set({ path: 'server', value: server })

  await setConfig({ store, staticConfig, backendConfig })
  try {
    await useInterfaceStore().applyTheme()
  } catch (e) {
    // The interface stays hidden until a theme is applied, so a theme that
    // can't be would leave nothing but the loading screen. Show it as it is.
    console.error('Error setting theme', e)
    useInterfaceStore().setThemeApplied()
    useInterfaceStore().pushGlobalNotice({
      messageKey: 'errors.theme_failed',
      level: 'error',
    })
  }

  applyStyleConfig(useMergedConfigStore().mergedConfig, i18n.global)

  // Now we can try getting the server settings and logging in
  // Most of these are preloaded into the index.html so blocking is minimized
  await Promise.all([
    checkOAuthToken({ store }),
    getInstancePanel({ store }),
    getNodeInfo({ store }),
    getInstanceConfig({ store }),
  ])

  getTOS({ store })
  getStickers({ store })

  const router = createRouter({
    history: createWebHistory(),
    routes: getRoutes(store),
    scrollBehavior: (to, _from, savedPosition) => {
      if (to.matched.some((m) => m.meta.dontScroll)) {
        return {}
      }
      return savedPosition || { left: 0, top: 0 }
    },
  })

  useI18nStore().setI18n(i18n)

  // Global WS handlers
  useChatsStore().attachSocket()
  useInterfaceStore().attachSocket()
  useStatusesStore().attachSocket()

  app.use(router)
  app.use(store)
  app.use(i18n)

  // Little thing to get out of invalid theme state
  window.resetThemes = () => {
    useInterfaceStore().resetThemeV3()
    useInterfaceStore().resetThemeV3Palette()
    useInterfaceStore().resetThemeV2()
  }

  app.use(vClickOutside)
  app.use(VBodyScrollLock)
  app.use(VueVirtualScroller)

  app.component('FAIcon', FontAwesomeIcon)
  app.component('FALayers', FontAwesomeLayers)
  app.component('Status', Status)
  app.component('RichContent', RichContent)
  app.component('StillImage', StillImage)

  // remove after vue 3.3
  app.config.unwrapInjectedRef = true

  app.mount('#app')
  return app
}

export default afterStoreSetup
