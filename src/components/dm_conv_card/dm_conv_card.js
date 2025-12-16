import ConfirmModal from '../confirm_modal/confirm_modal.vue'
import Status from '../status/status.vue'
import UserAvatar from '../user_avatar/user_avatar.vue'

const DMConvCard = {
  components: {
    ConfirmModal,
    Status,
    UserAvatar
  },
  props: {
    conversation: {
      type: Object,
      required: true
    },
    compact: {
      type: Boolean,
      default: true
    },
    showLastStatus: {
      type: Boolean,
      default: true
    }
  },
  emits: ['deleted'],
  data () {
    return {
      showingDeleteConfirmDialogue: false
    }
  },
  computed: {
    shouldConfirmDelete() {
      return this.$store.getters.mergedConfig.modalOnDeleteDMConversation;
    },
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
    },
    showDeleteConfirmModal() {
      this.showingDeleteConfirmDialogue = true
    },
    hideDeleteConfirmModal() {
      this.showingDeleteConfirmDialogue = false
    },
    deleteConversation() {
      if (this.shouldConfirmDelete) {
        this.showDeleteConfirmModal()
      } else {
        this.doDeleteConversation()
      }
    },
    doDeleteConversation() {
      this.$store.dispatch('deleteDMConversation', { id: this.conversation.id })
      this.hideDeleteConfirmModal()
      this.$emit('deleted')
    }
  }
}

export default DMConvCard
