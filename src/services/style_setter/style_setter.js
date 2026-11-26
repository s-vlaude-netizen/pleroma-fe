import sum from 'hash-sum'
import localforage from 'localforage'
import { chunk, throttle } from 'lodash-es'

import { getCssRules } from '../theme_data/css_utils.js'
import { getEngineChecksum, init } from '../theme_data/theme_data_3.service.js'

import { useMergedConfigStore } from 'src/stores/merged_config.js'
import { useSyncConfigStore } from 'src/stores/sync_config.js'

import { promisedRequest } from 'src/api/helpers.js'
import { withTimeout } from 'src/lib/with_timeout.js'
import { ROOT_CONFIG } from 'src/modules/default_config_state.js'

// On platforms where this is not supported, it will return undefined
// Otherwise it will return an array
const supportsAdoptedStyleSheets = !!document.adoptedStyleSheets

const stylesheets = {}

export const createStyleSheet = (id, priority = 1000) => {
  if (stylesheets[id]) return stylesheets[id]
  const newStyleSheet = {
    rules: [],
    ready: false,
    priority,
    clear() {
      this.rules = []
    },
    addRule(rule) {
      let newRule = rule
      if (!CSS.supports?.('backdrop-filter', 'blur()')) {
        newRule = newRule.replaceAll(/backdrop-filter:[^;]+;/g, '') // Remove backdrop-filter
      }

      if (newRule.startsWith('::-webkit')) {
        if (typeof CSS.supports !== 'function') return
        // firefox doesn't like invalid selectors
        const fullWebkitScrollbarSupport =
          CSS.supports('selector(::-webkit-scrollbar)') &&
          CSS.supports('selector(::-webkit-scrollbar-button)') &&
          CSS.supports('selector(::-webkit-resizer)') &&
          CSS.supports('selector(::-webkit-scrollbar-thumb)')
        if (!fullWebkitScrollbarSupport) return
      }

      this.rules.push(
        newRule.replaceAll(/var\(--shadowFilter\)[^;]*;/g, ''), // Remove shadowFilter references
      )
    },
  }

  stylesheets[id] = newStyleSheet
  return newStyleSheet
}

export const adoptStyleSheets = throttle(() => {
  if (supportsAdoptedStyleSheets) {
    document.adoptedStyleSheets = Object.values(stylesheets)
      .filter((x) => x.ready)
      .sort((a, b) => a.priority - b.priority)
      .map((sheet) => {
        const css = new CSSStyleSheet()
        sheet.rules.forEach((r) => {
          try {
            css.insertRule(r)
          } catch (e) {
            console.warn('Error inserting rule:', e, r)
          }
        })
        return css
      })
  } else {
    const holder = document.getElementById('custom-styles-holder')

    for (let i = holder.sheet.cssRules.length - 1; i >= 0; --i) {
      holder.sheet.deleteRule(i)
    }

    Object.values(stylesheets)
      .filter((x) => x.ready)
      .sort((a, b) => a.priority - b.priority)
      .forEach((sheet) => {
        sheet.rules.forEach((r) => holder.sheet.insertRule(r))
      })
  }
  // Some older browsers do not support document.adoptedStyleSheets.
  // In this case, we use the <style> elements.
  // Since the <style> elements we need are already in the DOM, there
  // is nothing to do here.
}, 500)

const EAGER_STYLE_ID = 'pleroma-eager-styles'
const LAZY_STYLE_ID = 'pleroma-lazy-styles'

export const hasInvalidCachedThemeRules = (data) =>
  data
    .flat()
    .some((rule) => /--(?:mono)?font:\s*\[object Object\](?:;|$)/i.test(rule))

const generateTheme = (inputRuleset, callbacks, debug) => {
  const {
    onNewRule = () => {
      /* no-op */
    },
    onLazyFinished = () => {
      /* no-op */
    },
    onEagerFinished = () => {
      /* no-op */
    },
  } = callbacks

  const themes3 = init({
    inputRuleset,
    debug,
  })

  getCssRules(themes3.eager, debug).forEach((rule) => {
    // Hacks to support multiple selectors on same component
    onNewRule(rule, false)
  })
  onEagerFinished()

  // Optimization - instead of processing all lazy rules in one go, process them in small chunks
  // so that UI can do other things and be somewhat responsive while less important rules are being
  // processed
  let counter = 0
  const chunks = chunk(themes3.lazy, 200)
  // let t0 = performance.now()
  const processChunk = () => {
    const chunk = chunks[counter]
    Promise.all(chunk.map((x) => x())).then((result) => {
      getCssRules(result.filter(Boolean), debug).forEach((rule) => {
        onNewRule(rule, true)
      })
      // const t1 = performance.now()
      // console.debug('Chunk ' + counter + ' took ' + (t1 - t0) + 'ms')
      // t0 = t1
      counter += 1
      if (counter < chunks.length) {
        setTimeout(processChunk, 0)
      } else {
        onLazyFinished()
      }
    })
  }

  return { lazyProcessFunc: processChunk }
}

const THEME_CACHE_KEY = 'pleromafe-theme-cache'
// The cache only saves time, the theme is compiled when it can't be had quickly
const THEME_CACHE_TIMEOUT = 3000

export const tryLoadCache = async () => {
  console.info('Trying to load compiled theme data from cache')
  // Storage that fails or never answers must not keep the theme from being
  // applied: the interface stays hidden until it is
  try {
    const cache = await withTimeout(
      localforage.getItem(THEME_CACHE_KEY),
      THEME_CACHE_TIMEOUT,
      'the theme cache',
    )
    if (!cache) return null

    if (
      cache.engineChecksum === getEngineChecksum() &&
      cache.checksum !== undefined &&
      cache.checksum === useMergedConfigStore().mergedConfig.themeChecksum &&
      !hasInvalidCachedThemeRules(cache.data)
    ) {
      const eagerStyles = createStyleSheet(EAGER_STYLE_ID, 10)
      const lazyStyles = createStyleSheet(LAZY_STYLE_ID, 20)

      cache.data[0].forEach((rule) => eagerStyles.addRule(rule))
      cache.data[1].forEach((rule) => lazyStyles.addRule(rule))

      eagerStyles.ready = true
      lazyStyles.ready = true

      console.info(`Loaded theme from cache`)
      return true
    }

    console.warn("Checksums don't match, cache not usable, clearing")
    // it is replaced once the theme is compiled, no need to wait for this
    localforage.removeItem(THEME_CACHE_KEY).catch((e) => {
      console.warn('Could not clear theme cache:', e)
    })
    return null
  } catch (e) {
    console.error('Failed to load theme cache:', e)
    return false
  }
}

export const applyTheme = (
  input,
  onEagerFinish = () => {
    /* no-op */
  },
  onFinish = () => {
    /* no-op */
  },
  debug = false,
) => {
  const eagerStyles = createStyleSheet(EAGER_STYLE_ID, 10)
  const lazyStyles = createStyleSheet(LAZY_STYLE_ID, 20)

  eagerStyles.clear()
  lazyStyles.clear()

  const { lazyProcessFunc } = generateTheme(
    input,
    {
      onNewRule(rule, isLazy) {
        if (isLazy) {
          lazyStyles.addRule(rule)
        } else {
          eagerStyles.addRule(rule)
        }
      },
      onEagerFinished() {
        eagerStyles.ready = true
        adoptStyleSheets()
        onEagerFinish()
        console.info(
          'Eager part of theme finished, waiting for lazy part to finish to store cache',
        )
      },
      onLazyFinished() {
        lazyStyles.ready = true
        adoptStyleSheets()
        const data = [eagerStyles.rules, lazyStyles.rules]
        const checksum = sum(data)
        const cache = {
          checksum,
          engineChecksum: getEngineChecksum(),
          data,
        }
        try {
          useSyncConfigStore().setSimplePrefAndSave({
            path: 'themeChecksum',
            value: checksum,
          })
        } catch (e) {
          // the theme is applied whether or not its checksum could be saved
          console.error('Could not save theme checksum:', e)
        }
        onFinish(cache)
        localforage
          .setItem(THEME_CACHE_KEY, cache)
          .then(() => console.info('Theme cache stored'))
          .catch((e) => console.error('Could not store theme cache:', e))
      },
    },
    debug,
  )

  setTimeout(lazyProcessFunc, 0)
}

const extractStyleConfig = ({
  sidebarColumnWidth,
  contentColumnWidth,
  notifsColumnWidth,
  themeEditorMinWidth,
  emojiReactionsScale,
  emojiSize,
  navbarSize,
  panelHeaderSize,
  textSize,
  forcedRoundness,
}) => {
  const result = {
    sidebarColumnWidth,
    contentColumnWidth,
    notifsColumnWidth,
    themeEditorMinWidth:
      Number.parseInt(themeEditorMinWidth) === 0
        ? 'fit-content'
        : themeEditorMinWidth,
    emojiReactionsScale,
    emojiSize,
    navbarSize,
    panelHeaderSize,
    textSize,
  }

  switch (forcedRoundness) {
    case 'disable':
      break
    case '0':
      result.forcedRoundness = '0'
      break
    case '1':
      result.forcedRoundness = '1px'
      break
    case '2':
      result.forcedRoundness = '0.4rem'
      break
    default:
  }

  return result
}

const defaultStyleConfig = extractStyleConfig(ROOT_CONFIG)

export const applyStyleConfig = (input) => {
  const config = extractStyleConfig(input)

  if (config === defaultStyleConfig) {
    return
  }

  const rules = Object.entries(config)
    .filter(([, v]) => v)
    .map(([k, v]) => `--${k}: ${v}`)
    .join(';')

  const styleSheet = createStyleSheet('theme-holder', 30)

  styleSheet.clear()
  styleSheet.addRule(`:root { ${rules} }`)

  // TODO find a way to make this not apply to theme previews
  if (Object.hasOwn(config, 'forcedRoundness')) {
    styleSheet.addRule(` *:not(.preview-block) {
        --roundness: var(--forcedRoundness) !important;
    }`)
  }
  styleSheet.ready = true
  adoptStyleSheets()
}

const noop = (x) => x

export const getResourcesIndex = async (url, parser = noop) => {
  const cache = 'no-store'
  const customUrl = url.replace(/\.(\w+)$/, '.custom.$1')
  let builtin
  let custom

  const resourceTransform = (resources) => {
    return Object.entries(resources).map(([k, v]) => {
      if (typeof v === 'object') {
        return [k, () => v]
      } else if (typeof v === 'string') {
        return [
          k,
          () =>
            promisedRequest({
              url: v,
              cache,
              forceContentType: parser === noop ? null : 'text/plain',
            })
              .then(({ data: text }) => parser(text))
              .catch((e) => {
                console.error(e)
                return null
              }),
        ]
      } else {
        console.error(`Unknown resource format - ${k} is a ${typeof v}`)
        return [k, null]
      }
    })
  }

  try {
    const { data: builtinData } = await promisedRequest({
      url,
      cache,
      forceContentType: 'application/json',
    })
    builtin = resourceTransform(builtinData)
  } catch {
    builtin = []
    console.warn(`Builtin resources at ${url} unavailable`)
  }

  try {
    const { data: customData } = await promisedRequest({
      url: customUrl,
      cache,
      forceContentType: 'application/json',
    })
    custom = resourceTransform(customData)
  } catch {
    custom = []
    console.warn(`Custom resources at ${customUrl} unavailable`)
  }

  const total = [...custom, ...builtin]
  if (total.length === 0) {
    throw new Error(
      `Resource at ${url} and ${customUrl} completely unavailable. Panicking`,
    )
  }
  return Object.fromEntries(total)
}
