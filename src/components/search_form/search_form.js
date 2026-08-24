import Checkbox from '../checkbox/checkbox.vue'
import EmojiInput from '../emoji_input/emoji_input.vue'
import suggestor from '../emoji_input/suggestor.js'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faCircleQuestion,
  faSearch
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faCircleQuestion,
  faSearch
)

const SearchForm = {
  components: {
    Checkbox,
    EmojiInput
  },
  data: () => ({
    searchTerm: undefined,
    type: 'statuses',
    resolve: false,
    // post search options
    author_nick: undefined,
    // user search options
    following: undefined,
    // UI
    errorMsg: undefined,
    showSyntaxHint: false
  }),
  watch: {
    '$route': function (route) {
      if (route.name === 'search') {
        this.initFromQueryParams(route.query)
      }
    }
  },
  computed: {
    loggedIn () {
      return !!this.$store.state.users.currentUser
    },
    userSuggestor () {
      return suggestor({ store: this.$store })
    }
  },
  methods: {
    toggleSyntaxHint () {
      this.showSyntaxHint = !this.showSyntaxHint;
    },
    resetSearchState() {
      this.searchTerm = undefined,
      this.type = 'statuses',
      this.resolve = false,
      // post search options
      this.author_nick = undefined,
      // user search options
      this.following = undefined,
      // error msg for UI
      this.errorMsg = undefined
    },
    initFromQueryParams (qparams) {
      this.searchTerm = qparams.query
      this.type = qparams.type ?? this.type
      this.resolve = this.boolQuery(qparams.resolve) ?? this.resolve
      this.following = this.boolQuery(qparams.following) ?? this.following

      const author_id = qparams.account_id
      if (author_id) {
        this.author_nick = this.$store.getters.findUser(author_id)?.screen_name
      }
    },
    boolQuery(val) {
      if (['false', 'no', '0', 0].includes(val)) {
        return false
      } else {
        return val
      }
    },
    focusQueryInput () {
      this.$refs.searchInput.focus()
    },
    async find (searchTerm) {
      let account_id = undefined
      if (this.author_nick) {
        this.author_nick = this.author_nick.trim()
        // backend stores without leading @ and only recognises without
        if (this.author_nick.startsWith('@'))
          this.author_nick = this.author_nick.slice(1)

        const errorMsg = this.$i18n.t('search.form.error_user_not_found', {nick: this.author_nick})

        const account = await this.$store.dispatch('fetchUserIfMissing', this.author_nick)
          .catch(() => {
            this.errorMsg = errorMsg
            return null
          })

        account_id = account?.id
        if (!account_id) {
          this.errorMsg = errorMsg
          return
        }
      }

      const type = this.type === "" ? undefined : type

      this.$router.push({ name: 'search', query: {
        query: searchTerm,
        type: this.type,
        resolve: this.resolve,
        account_id: account_id,
        following: this.following
      } })

      this.errorMsg = undefined
      this.focusQueryInput()
      this.$emit('searched')
    }
  }
}

export default SearchForm
