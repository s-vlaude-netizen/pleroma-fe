import DMConvCard from '../dm_conv_card/dm_conv_card.vue'
import Timeline from '../timeline/timeline.vue'

const DMConvTimeline = {
  data () {
    return {
      conversationId: null
    }
  },
  components: {
    DMConvCard,
    Timeline
  },
  computed: {
    conversation () { return this.$store.getters.getDMConversationById(this.conversationId) },
    timeline () { return this.$store.state.statuses.timelines.dmConv }
  },
  methods: {
    forceLeave () {
      this.$router.push('/')
    }
  },
  created () {
    this.conversationId = this.$route.params.id
    this.$store.dispatch('fetchDMConversationDetails', { id: this.conversationId })
    this.$store.dispatch('startFetchingTimeline', { timeline: 'dmConv', conversationId: this.conversationId })
  },
  unmounted () {
    this.$store.dispatch('stopFetchingTimeline', 'dmConv')
    this.$store.commit('clearTimeline', { timeline: 'dmConv' })
  }
}

export default DMConvTimeline
