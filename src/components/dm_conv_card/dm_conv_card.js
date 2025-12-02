import Status from '../status/status.vue'
import UserAvatar from '../user_avatar/user_avatar.vue'

const DMConvCard = {
  components: {
    Status,
    UserAvatar
  },
  props: {
    conversation: Object
  },
  data () {
    return {}
  },
  computed: {
    membersTruncated() {
      // XXX: this should ideally adapt to panel width
      const maxLen = 11
      const full = this.conversation.accounts
      const truncated = full.length > maxLen
      const truncList = truncated ? full.slice(0, maxLen) : full

      return {
        truncated: truncated,
        users: truncList
      }
    },
    last_status_text() {
      return this.conversation.last_status?.content
    }
  },
  methods: {
    markRead() {
      this.$store.dispatch('markDMConversationAsRead', { id: this.conversation.id })
    }
  }
}

export default DMConvCard
