import { library } from '@fortawesome/fontawesome-svg-core'
import { faQuoteLeft } from '@fortawesome/free-solid-svg-icons'

library.add(faQuoteLeft)

const QuoteButton = {
  name: 'QuoteButton',
  props: ['status', 'quoting', 'visibility'],
  computed: {
    showButton () {
      const currentUserId = this.$store.state.users.currentUser?.id

      if (!currentUserId)
        return false

      if (['public', 'unlisted', 'local'].includes(this.visibility))
        return true

      return (this.visibility === 'private' && currentUserId == this.status.user.id)
    }
  }
}

export default QuoteButton
