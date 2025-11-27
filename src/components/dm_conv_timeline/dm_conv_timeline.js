import Timeline from '../timeline/timeline.vue'

const DMConvTimeline = {
  data () {
    return {
      conversationId: null
    }
  },
  components: {
    Timeline
  },
  computed: {
    timeline () { return this.$store.state.statuses.timelines.dmConv }
  },
  created () {
    this.conversationId = this.$route.params.id
    //this.$store.dispatch('fetchConversationDetails', { id: this.conversationId })
    this.$store.dispatch('startFetchingTimeline', { timeline: 'dmConv', conversationId: this.conversationId })
  },
  unmounted () {
    this.$store.dispatch('stopFetchingTimeline', 'dmConv')
    this.$store.commit('clearTimeline', { timeline: 'dmConv' })
  }
}

export default DMConvTimeline
