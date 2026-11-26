import { throttle } from 'lodash-es'
import { mapState } from 'pinia'
import { defineAsyncComponent, provide } from 'vue'

import DesktopNav from 'src/components/desktop_nav/desktop_nav.vue'
import FeaturesPanel from 'src/components/features_panel/features_panel.vue'
import GlobalError from 'src/components/global_error/global_error.vue'
import GlobalNoticeList from 'src/components/global_notice_list/global_notice_list.vue'
import InstanceSpecificPanel from 'src/components/instance_specific_panel/instance_specific_panel.vue'
import MobileNav from 'src/components/mobile_nav/mobile_nav.vue'
import MobilePostStatusButton from 'src/components/mobile_post_status_button/mobile_post_status_button.vue'
import NavPanel from 'src/components/nav_panel/nav_panel.vue'
import UserPanel from 'src/components/user_panel/user_panel.vue'
import { getOrCreateServiceWorker } from './services/sw/sw'
import { windowHeight, windowWidth } from './services/window_utils/window_utils'

import { useEmojiStore } from 'src/stores/emoji.js'
import { useI18nStore } from 'src/stores/i18n.js'
import { useInstanceStore } from 'src/stores/instance.js'
import { useInstanceCapabilitiesStore } from 'src/stores/instance_capabilities.js'
import { useInterfaceStore } from 'src/stores/interface.js'
import { useMergedConfigStore } from 'src/stores/merged_config.js'
import { useShoutStore } from 'src/stores/shout.js'
import { useUsersStore } from 'src/stores/users.js'

import { useBodyScroller } from 'src/composables/useBodyScroller.js'
import { useScrollPosition } from 'src/composables/useScrollPosition.js'
import { useWindowScroll } from 'src/composables/useWindowScroll.js'
import { useWindowSize } from 'src/composables/useWindowSize.js'

// Helper to unwrap reactive proxies
window.toValue = (x) => JSON.parse(JSON.stringify(x))

export default {
  name: 'app',
  components: {
    UserPanel,
    NavPanel,
    Notifications: defineAsyncComponent(
      () => import('src/components/notifications/notifications.vue'),
    ),
    InstanceSpecificPanel,
    FeaturesPanel,
    WhoToFollowPanel: defineAsyncComponent(
      () =>
        import('src/components/who_to_follow_panel/who_to_follow_panel.vue'),
    ),
    ShoutPanel: defineAsyncComponent(
      () => import('src/components/shout_panel/shout_panel.vue'),
    ),
    MediaModal: defineAsyncComponent(
      () => import('src/components/media_modal/media_modal.vue'),
    ),
    MobilePostStatusButton,
    MobileNav,
    DesktopNav,
    FollowRequestConfirm: defineAsyncComponent(
      () =>
        import(
          'src/components/follow_request_confirm/follow_request_confirm.vue'
        ),
    ),
    SettingsModal: defineAsyncComponent(
      () => import('src/components/settings_modal/settings_modal.vue'),
    ),
    UpdateNotification: defineAsyncComponent(
      () =>
        import('src/components/update_notification/update_notification.vue'),
    ),
    PostStatusModal: defineAsyncComponent(
      () => import('src/components/post_status_modal/post_status_modal.vue'),
    ),
    UserReportingModal: defineAsyncComponent(
      () =>
        import('src/components/user_reporting_modal/user_reporting_modal.vue'),
    ),
    EditStatusModal: defineAsyncComponent(
      () => import('src/components/edit_status_modal/edit_status_modal.vue'),
    ),
    StatusHistoryModal: defineAsyncComponent(
      () =>
        import('src/components/status_history_modal/status_history_modal.vue'),
    ),
    GlobalError,
    GlobalNoticeList,
  },
  setup() {
    provide(
      'bodyScrollPosition',
      useScrollPosition(useBodyScroller(useWindowScroll(), useWindowSize())),
    )
  },
  data: () => ({
    mobileActivePanel: 'timeline',
    updateMobileState: null,
    updateScrollState: null,
  }),
  provide() {
    return {
      allowNonSquareEmoji: useMergedConfigStore().mergedConfig.nonSquareEmoji,
    }
  },
  watch: {
    themeApplied() {
      this.removeSplash()
    },
    currentTheme() {
      this.setThemeBodyClass()
    },
    layoutType() {
      document.getElementById('modal').classList = ['-' + this.layoutType]
    },
  },
  created() {
    // Load the locale from the storage
    const value = useMergedConfigStore().mergedConfig.interfaceLanguage
    useI18nStore().setLanguage(value)
    useEmojiStore().loadUnicodeEmojiData(value)

    document.getElementById('modal').classList = ['-' + this.layoutType]

    // Create bound handlers
    this.updateScrollState = throttle(this.scrollHandler, 200)
    this.updateMobileState = throttle(this.resizeHandler, 200)
  },
  mounted() {
    window.addEventListener('resize', this.updateMobileState)
    this.scrollParent.addEventListener('scroll', this.updateScrollState)

    if (this.themeApplied) {
      this.setThemeBodyClass()
      this.removeSplash()
    }
    getOrCreateServiceWorker()
  },
  unmounted() {
    window.removeEventListener('resize', this.updateMobileState)
    this.scrollParent.removeEventListener('scroll', this.updateScrollState)
  },
  computed: {
    currentTheme() {
      if (this.styleDataUsed) {
        const styleMeta = this.styleDataUsed.find(
          (x) => x.component === '@meta',
        )

        if (styleMeta !== undefined) {
          return styleMeta.directives.name.replaceAll(' ', '-').toLowerCase()
        }
      }

      return 'stock'
    },
    layoutModalClass() {
      return '-' + this.layoutType
    },
    classes() {
      return [
        {
          '-reverse': this.reverseLayout,
          '-no-sticky-headers': this.noSticky,
          '-has-new-post-button': this.newPostButtonShown,
        },
        '-' + this.layoutType,
      ]
    },
    navClasses() {
      const { navbarColumnStretch } = useMergedConfigStore().mergedConfig
      return [
        '-' + this.layoutType,
        ...(navbarColumnStretch ? ['-column-stretch'] : []),
      ]
    },
    userBackground() {
      return this.currentUser?.background_image
    },
    foreignProfileBackground() {
      return (
        useMergedConfigStore().mergedConfig.allowForeignUserBackground &&
        useInterfaceStore().foreignProfileBackground
      )
    },
    instanceBackground() {
      return useMergedConfigStore().mergedConfig.hideInstanceWallpaper
        ? null
        : this.instanceBackgroundUrl
    },
    background() {
      return (
        this.foreignProfileBackground ||
        this.userBackground ||
        this.instanceBackground
      )
    },
    bgStyle() {
      if (this.background) {
        return {
          '--body-background-image': `url(${this.background})`,
        }
      }
    },
    shoutJoined() {
      return useShoutStore().joined
    },
    isChats() {
      return (
        this.$route.name === 'chat' ||
        this.$route.name === 'chats' ||
        this.$route.name === 'conversation2'
      )
    },
    isListEdit() {
      return this.$route.name === 'lists-edit'
    },
    newPostButtonShown() {
      if (this.isChats) return false
      if (this.isListEdit) return false
      return (
        useMergedConfigStore().mergedConfig.alwaysShowNewPostButton ||
        this.layoutType === 'mobile'
      )
    },
    shoutboxPosition() {
      return (
        useMergedConfigStore().mergedConfig.alwaysShowNewPostButton || false
      )
    },
    hideShoutbox() {
      return this.isChats || useMergedConfigStore().mergedConfig.hideShoutbox
    },
    thirdColumnMode() {
      return this.mergedConfig.thirdColumnMode
    },
    reverseSetting() {
      return this.mergedConfig.sidebarRight
    },
    reverseLayout() {
      if (this.layoutType !== 'wide') {
        return this.reverseSetting
      } else {
        return this.thirdColumnMode === 'notifications'
          ? this.reverseSetting
          : !this.reverseSetting
      }
    },
    noSticky() {
      return this.mergedConfig.disableStickyHeaders
    },
    showScrollbars() {
      return this.mergedConfig.showScrollbars
    },
    scrollParent() {
      return window /* this.$refs.appContentRef */
    },
    showInstanceSpecificPanel() {
      return this.instanceSpecificPanelPresent && !this.mergedConfig.hideISP
    },
    ...mapState(useMergedConfigStore, ['mergedConfig']),
    ...mapState(useInterfaceStore, [
      'themeApplied',
      'styleDataUsed',
      'layoutType',
    ]),
    ...mapState(useUsersStore, ['currentUser']),
    ...mapState(useInstanceStore, ['styleDataUsed']),
    ...mapState(useInstanceCapabilitiesStore, [
      'suggestionsEnabled',
      'editingAvailable',
    ]),
    ...mapState(useInstanceStore, {
      instanceBackgroundUrl: (store) => store.instanceIdentity.background,
      showFeaturesPanel: (store) => store.instanceIdentity.showFeaturesPanel,
      instanceSpecificPanelPresent: (store) =>
        store.instanceIdentity.showInstanceSpecificPanel &&
        store.instanceIdentity.instanceSpecificPanelContent,
    }),
  },
  methods: {
    resizeHandler() {
      useInterfaceStore().setLayoutWidth(windowWidth())
      useInterfaceStore().setLayoutHeight(windowHeight())
    },
    scrollHandler() {
      const scrollPosition =
        this.scrollParent === window
          ? window.scrollY
          : this.scrollParent.scrollTop

      if (scrollPosition != 0) {
        this.$refs.appContentRef.classList.add(['-scrolled'])
      } else {
        this.$refs.appContentRef.classList.remove(['-scrolled'])
      }
    },
    setThemeBodyClass() {
      const themeName = this.currentTheme
      const classList = Array.from(document.body.classList)
      const oldTheme = classList.filter((c) => c.startsWith('theme-'))

      if (themeName !== null && themeName !== '') {
        const newTheme = `theme-${themeName.toLowerCase()}`

        // remove old theme reference if there are any
        if (oldTheme.length) {
          document.body.classList.replace(oldTheme[0], newTheme)
        } else {
          document.body.classList.add(newTheme)
        }
      } else {
        // remove theme reference if non-V3 theme is used
        document.body.classList.remove(...oldTheme)
      }
    },
    removeSplash() {
      // Nothing below may be able to keep the app hidden
      document.querySelector('#app')?.classList.remove('hidden')

      const status = document.querySelector('#status')
      if (status) {
        status.textContent = this.$t(
          'splash.fun_' + Math.ceil(Math.random() * 4),
        )
      }
      const splashscreenRoot = document.querySelector('#splash')
      if (!splashscreenRoot) return
      splashscreenRoot.addEventListener('transitionend', () => {
        splashscreenRoot.remove()
      })
      setTimeout(() => {
        splashscreenRoot.remove() // forcibly remove it, should fix my plasma browser widget t. HJ
      }, 600)
      splashscreenRoot.classList.add('hidden')
    },
  },
}
