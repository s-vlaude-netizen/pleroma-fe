import UserAvatar from '../user_avatar/user_avatar.vue'
import RemoteFollow from '../remote_follow/remote_follow.vue'
import ProgressButton from '../progress_button/progress_button.vue'
import FollowButton from '../follow_button/follow_button.vue'
import ModerationTools from '../moderation_tools/moderation_tools.vue'
import AccountActions from '../account_actions/account_actions.vue'
import Select from '../select/select.vue'
import RichContent from 'src/components/rich_content/rich_content.jsx'
import ConfirmModal from '../confirm_modal/confirm_modal.vue'
import generateProfileLink from 'src/services/user_profile_link_generator/user_profile_link_generator'
import { mapGetters } from 'vuex'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faBell,
  faImages,
  faRss,
  faSearchPlus,
  faExternalLinkAlt,
  faEdit
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faRss,
  faBell,
  faImages,
  faSearchPlus,
  faExternalLinkAlt,
  faEdit
)

export default {
  props: [
    'userId', 'switcher', 'selected', 'hideBio', 'rounded', 'bordered', 'allowZoomingAvatar', 'showMediaButton'
  ],
  data () {
    return {
      followRequestInProgress: false,
      betterShadow: this.$store.state.interface.browserSupport.cssFilter,
      showingConfirmMute: false
    }
  },
  created () {
    this.$store.dispatch('fetchUserRelationship', this.user.id)
  },
  computed: {
    user () {
      return this.$store.getters.findUser(this.userId)
    },
    relationship () {
      return this.$store.getters.relationship(this.userId)
    },
    classes () {
      return [{
        'user-card-rounded-t': this.rounded === 'top', // set border-top-left-radius and border-top-right-radius
        'user-card-rounded': this.rounded === true, // set border-radius for all sides
        'user-card-bordered': this.bordered === true // set border for all sides
      }]
    },
    isOtherUser () {
      return this.user.id !== this.$store.state.users.currentUser.id
    },
    subscribeUrl () {
       
      const serverUrl = new URL(this.user.statusnet_profile_url)
      return `${serverUrl.protocol}//${serverUrl.host}/main/ostatus`
    },
    feedUrl () {
      return (this.user.akkoma?.web_feed || (this.user.statusnet_profile_url + '.rss'))
    },
    loggedIn () {
      return this.$store.state.users.currentUser
    },
    dailyAvg () {
      const days = Math.ceil((new Date() - new Date(this.user.created_at)) / (60 * 60 * 24 * 1000))
      return Math.round(this.user.statuses_count / days)
    },
    userHighlightType: {
      get () {
        const data = this.$store.getters.mergedConfig.highlight[this.user.screen_name]
        return (data && data.type) || 'disabled'
      },
      set (type) {
        const data = this.$store.getters.mergedConfig.highlight[this.user.screen_name]
        if (type !== 'disabled') {
          this.$store.dispatch('setHighlight', { user: this.user.screen_name, color: (data && data.color) || '#FFFFFF', type })
        } else {
          this.$store.dispatch('setHighlight', { user: this.user.screen_name, color: undefined })
        }
      },
      ...mapGetters(['mergedConfig'])
    },
    userHighlightColor: {
      get () {
        const data = this.$store.getters.mergedConfig.highlight[this.user.screen_name]
        return data && data.color
      },
      set (color) {
        this.$store.dispatch('setHighlight', { user: this.user.screen_name, color })
      }
    },
    visibleRole () {
      const rights = this.user.rights
      if (!rights) { return }
      const validRole = rights.admin || rights.moderator
      const roleTitle = rights.admin ? 'admin' : 'moderator'
      return validRole && roleTitle
    },
    hideFollowsCount () {
      return this.isOtherUser && this.user.hide_follows_count
    },
    hideFollowersCount () {
      return this.isOtherUser && this.user.hide_followers_count
    },
    shouldConfirmMute () {
      return this.mergedConfig.modalOnMute
    },
    compactUserInfo () {
      return this.$store.getters.mergedConfig.compactUserInfo
        && (this.$store.state.interface.layoutType !== 'mobile')
        && this.switcher
    },
    hasProfileMedia() {
      const user = this.user
      return (user && (user.profile_image_url_original || user.cover_photo || user.background_image))
    },
    ...mapGetters(['mergedConfig'])
  },
  components: {
    UserAvatar,
    RemoteFollow,
    ModerationTools,
    AccountActions,
    ProgressButton,
    FollowButton,
    Select,
    RichContent,
    ConfirmModal
  },
  methods: {
    refetchRelationship () {
      return this.$store.dispatch('fetchUserRelationship', this.user.id)
    },
    showConfirmMute () {
      this.showingConfirmMute = true
    },
    hideConfirmMute () {
      this.showingConfirmMute = false
    },
    muteUser () {
      if (!this.shouldConfirmMute) {
        this.doMuteUser()
      } else {
        this.showConfirmMute()
      }
    },
    doMuteUser () {
      this.$store.dispatch('muteUser', this.user.id)
      this.hideConfirmMute()
    },
    unmuteUser () {
      this.$store.dispatch('unmuteUser', this.user.id)
    },
    subscribeUser () {
      return this.$store.dispatch('subscribeUser', this.user.id)
    },
    unsubscribeUser () {
      return this.$store.dispatch('unsubscribeUser', this.user.id)
    },
    setProfileView (v) {
      if (this.switcher) {
        const store = this.$store
        store.commit('setProfileView', { v })
      }
    },
    linkClicked ({ target }) {
      if (target.tagName === 'SPAN') {
        target = target.parentNode
      }
      if (target.tagName === 'A') {
        window.open(target.href, '_blank')
      }
    },
    userProfileLink (user) {
      return generateProfileLink(
        user.id, user.screen_name,
        this.$store.state.instance.restrictedNicknames
      )
    },
    openProfileTab () {
      this.$store.dispatch('openSettingsModalTab', 'profile')
    },
    zoomAvatar () {
      const attachment = {
        url: this.user.profile_image_url_original,
        description: this.user.avatar_description,
        mimetype: 'image'
      }
      this.$store.dispatch('setMedia', [attachment])
      this.$store.dispatch('setCurrentMedia', attachment)
    },
    makeMediaObject(link, altText) {
      // Pseudo media attachment object with just the fields relevant for gallery display
      return {
        type: "image",
        mimetype: "image/something",
        url: link,
        // proper media attachments omit field if no alt, but Mastodon decided in
        // user responses to return empty string for "no alt". Normalise this here
        description: altText || undefined
      }
    },
    showProfileMedia () {
      const user = this.user
      const media = []
      let startMedia = undefined

      if (user.profile_image_url_original) {
        const avatar = this.makeMediaObject(user.profile_image_url_original, user.avatar_description)
        media.push(avatar)
        if (!startMedia) startMedia = avatar
      }

      if (user.cover_photo) {
        const header = this.makeMediaObject(user.cover_photo, user.header_description)
        media.push(header)
        if (!startMedia) startMedia = header
      }

      if (user.background_image) {
        const background = this.makeMediaObject(user.background_image, user.pleroma?.background_image_description)
        media.push(background)
        if (!startMedia) startMedia = background
      }

      if (startMedia) {
        this.$store.dispatch('setMedia', media)
        this.$store.dispatch('setCurrentMedia', startMedia)
      }
    },
    mentionUser () {
      this.$store.dispatch('openPostStatusModal', { repliedUser: this.user })
    }
  }
}
