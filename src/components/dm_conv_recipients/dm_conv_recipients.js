import { mapGetters } from 'vuex'
import BasicUserCard from '../basic_user_card/basic_user_card.vue'
import ListUserSearch from '../list_user_search/list_user_search.vue'

const DMConvRecipients = {
  data () {
    return {
      conversationId: null,
      conversation: null,
      recipients: [],
      suggestions: []
    }
  },
  components: {
    BasicUserCard,
    ListUserSearch
  },
  computed: {
    conversationTitle () {
      return this.$i18n.t('dm_conv.default_name', {id: this.conversationId})
    },
    ...mapGetters(['findUser'])
  },
  methods: {
    toggleUser (user) {
      if (this.isRecipient(user)) {
        this.recipients.filter((r) => r.id !== user.id)
      } else {
        this.recipients.push(user)
      }
    },
    isRecipient (user) {
      return this.recipients.some((r) => r.id == user.id)
    },
    onResults (results) {
      this.suggestions = results.map((id) => this.findUser(id)).filter(user => user)
    },
    updateRecipients () {
      const recipientIds = this.recipients.map((u) => u.id)
      this.$store.dispatch('setDMConversationDetails', {id: this.conversationId, recipients: recipientIds })
        .then((updateConv) => {
          this.conversation = updateConv
          this.recipients = updateConv.accounts
        })
    }
  },
  created () {
    this.conversationId = this.$route.params.id
    this.$store.dispatch('fetchDMConversationDetails', { id: this.conversationId })
      .then((data) => {
        this.conversation = data
        this.recipients = data.accounts
      })
  },
}

export default DMConvRecipients
