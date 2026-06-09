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
      const undoing = this.status.favorited
      let action
      if (!undoing) {
        action = this.$store.dispatch('favorite', { id: this.status.id })
      } else {
        action = this.$store.dispatch('unfavorite', { id: this.status.id })
      }

      this.animated = true

      action.then(() => {
        this.animated = false
        this.$store.dispatch('fetchFavs', this.status.id)
      })
      .catch((error) => {
        this.$store.dispatch('pushGlobalNotice', {
          level: 'error',
          messageKey: undoing ? 'errors.favorite_undo' : 'errors.favorite',
          messageArgs: [error.message ?? error ?? 'unknown'],
          timeout: 5000
        })
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
