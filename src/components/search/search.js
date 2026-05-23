import FollowCard from '../follow_card/follow_card.vue'
import Conversation from '../conversation/conversation.vue'
import SearchForm from '../search_form/search_form.vue'
import Status from '../status/status.vue'
import TabSwitcher from 'src/components/tab_switcher/tab_switcher.jsx'
import map from 'lodash/map'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faCircleNotch,
  faSearch
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faCircleNotch,
  faSearch
)

const Search = {
  components: {
    FollowCard,
    Conversation,
    SearchForm,
    Status,
    TabSwitcher
  },
  props: [
    'query',
    'type',
    'resolve',
    'account_id',
    'following'
  ],
  data () {
    return {
      loaded: false,
      loading: false,
      userIds: [],
      statuses: [],
      hashtags: [],
      currenResultTab: 'statuses'
    }
  },
  computed: {
    users () {
      return this.userIds.map(userId => this.$store.getters.findUser(userId))
    },
    visibleStatuses () {
      const allStatusesObject = this.$store.state.statuses.allStatusesObject

      return this.statuses.filter(status =>
        allStatusesObject[status.id] && !allStatusesObject[status.id].deleted
      )
    }
  },
  mounted () {
    // Forward and normalise/parse boolean query parameters
    this.$refs.searchForm.initFromQueryParams(this.$route.query)
    this.search(this.query)
  },
  watch: {
    '$route.query': function (newVal) {
      this.search(newVal.query)
    }
  },
  methods: {
    newQuery (query) {
      this.$router.push({ name: 'search', query: { query } })
    },
    search (query) {
      if (!query) {
        this.loading = false
        return
      }

      this.loading = true
      this.userIds = []
      this.statuses = []
      this.hashtags = []

      // Use parameters from form where appropriate to get parsing/normalisation of e.g. bools
      this.$store.dispatch('search', {
        q: query,
        type: this.type,
        resolve: this.$refs.searchForm.resolve,
        account_id: this.account_id,
        following: this.$refs.searchForm.following
      })
        .then(data => {
          this.loading = false
          this.userIds = map(data.accounts, 'id')
          this.statuses = data.statuses
          this.hashtags = data.hashtags
          this.currenResultTab = this.getActiveTab()
          this.loaded = true
        })
    },
    resultCount (tabName) {
      const length = this[tabName].length
      return length === 0 ? '' : ` (${length})`
    },
    onResultTabSwitch (key) {
      this.currenResultTab = key
    },
    getActiveTab () {
      if (this.type) {
        return (this.type === 'accounts' ? 'people' : this.type)
      } else if (this.visibleStatuses.length > 0) {
        return 'statuses'
      } else if (this.users.length > 0) {
        return 'people'
      } else if (this.hashtags.length > 0) {
        return 'hashtags'
      }

      return 'statuses'
    },
    lastHistoryRecord (hashtag) {
      return hashtag.history && hashtag.history[0]
    }
  }
}

export default Search
