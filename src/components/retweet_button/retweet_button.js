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
    const maxScope = this.status.visibility
    const defaultScope = this.$store.state.users.currentUser.default_scope
    return {
      animated: false,
      showingConfirmDialog: false,
      retweetVisibility: scopeUtils.negotiate(defaultScope, maxScope)
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
      let action
      if (!this.status.repeated) {
        action = this.$store.dispatch('retweet', { id: this.status.id, visibility: this.retweetVisibility })
      } else {
        action = this.$store.dispatch('unretweet', { id: this.status.id })
      }
      this.animated = true
      this.hideConfirmDialog()

      action.then(() => {
        this.animated = false
        this.$store.dispatch('fetchRepeats', this.status.id)
      })
      .finally(() => {
        this.animated = false
      })
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
  }
}

export default RetweetButton
