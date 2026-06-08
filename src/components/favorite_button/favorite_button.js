import { mapGetters } from 'vuex'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faStar } from '@fortawesome/free-solid-svg-icons'
import {
  faStar as faStarRegular
} from '@fortawesome/free-regular-svg-icons'

library.add(
  faStar,
  faStarRegular
)

const FavoriteButton = {
  props: ['status', 'loggedIn'],
  data () {
    return {
      animated: false
    }
  },
  methods: {
    favorite () {
      let action
      if (!this.status.favorited) {
        action = this.$store.dispatch('favorite', { id: this.status.id })
      } else {
        action = this.$store.dispatch('unfavorite', { id: this.status.id })
      }

      this.animated = true

      action.then(() => {
        this.animated = false
        this.$store.dispatch('fetchFavs', this.status.id)
      })
      .finally(() => {
        this.animated = false
      })
    }
  },
  computed: {
    ...mapGetters(['mergedConfig']),
    remoteInteractionLink () {
      return this.$store.getters.remoteInteractionLink({ statusId: this.status.id })
    }
  }
}

export default FavoriteButton
