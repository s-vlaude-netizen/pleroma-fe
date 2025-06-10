import ConfirmModal from '../confirm_modal/confirm_modal.vue'
import ScopeSelector from '../scope_selector/scope_selector.vue'
import scopeUtils from 'src/lib/scope_utils.js'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faRetweet } from '@fortawesome/free-solid-svg-icons'

library.add(faRetweet)

const RetweetButton = {
  props: ['status', 'loggedIn', 'visibility'],
  components: {
    ConfirmModal,
    ScopeSelector
  },
  data () {
    return {
      animated: false,
      showingConfirmDialog: false,
      retweetVisibility: this.$store.state.users.currentUser.default_scope
    }
  },
  methods: {
    retweet () {
      if (!this.status.repeated && this.shouldConfirmRepeat) {
        this.showConfirmDialog()
      } else {
        this.doRetweet()
      }
    },
    doRetweet () {
      if (!this.status.repeated) {
        this.$store.dispatch('retweet', { id: this.status.id, visibility: this.retweetVisibility })
      } else {
        this.$store.dispatch('unretweet', { id: this.status.id })
      }
      this.animated = true
      setTimeout(() => {
        this.animated = false
      }, 500)
      this.hideConfirmDialog()
    },
    showConfirmDialog () {
      this.showingConfirmDialog = true
    },
    hideConfirmDialog () {
      this.showingConfirmDialog = false
    },
    changeVis (visibility) {
      this.retweetVisibility = visibility
    }
  },
  computed: {
    isOwn () {
      return this.status.user.id === this.$store.state.users.currentUser.id
    },
    mergedConfig () {
      return this.$store.getters.mergedConfig
    },
    shouldConfirmRepeat () {
      return this.mergedConfig.modalOnRepeat
    },
    remoteInteractionLink () {
      return this.$store.getters.remoteInteractionLink({ statusId: this.status.id })
    },
    userDefaultScope () {
      return this.$store.state.users.currentUser.default_scope
    },
    statusScope () {
      return this.status.visibility
    },
    initialScope () {
      return scopeUtils.negotiate(this.userDefaultScope, this.status.visibility)
    }
  }
}

export default RetweetButton
