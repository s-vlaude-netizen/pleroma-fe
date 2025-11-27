import DMConvCard from '../dm_conv_card/dm_conv_card.vue'
import List from '../list/list.vue'
import withLoadMore from '../../hocs/with_load_more/with_load_more'

const PaginatedDMConvList = withLoadMore({
  fetch: (props, $store) => $store.dispatch('fetchDMConversationList'),
  select: (props, $store) => $store.state.dmConversations.allDMConversations || [],
  destroy: (props, $store) => $store.dispatch('clearDMConversations'),
  childPropName: 'items',
  additionalPropNames: []
})(List)

const DMConvList = {
  components: {
    PaginatedDMConvList,
    DMConvCard
  },
  data () {
    return {}
  },
  computed: {
    conversations() {
      return this.$store.state.dmConversations.allDMConversations
    }
  }
}

export default DMConvList
