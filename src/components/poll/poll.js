import Timeago from 'components/timeago/timeago.vue'
import RichContent from 'components/rich_content/rich_content.jsx'
import { forEach, map } from 'lodash'
import {
  faCircleCheck,
  faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons'

export default {
  name: 'Poll',
  props: ['basePoll', 'emoji'],
  components: {
    Timeago,
    RichContent
  },
  data () {
    return {
      loading: false,
      choices: []
    }
  },
  created () {
    if (!this.$store.state.polls.pollsObject[this.pollId]) {
      this.$store.dispatch('mergeOrAddPoll', this.basePoll)
    }
    this.$store.dispatch('trackPoll', this.pollId)
  },
  unmounted () {
    this.$store.dispatch('untrackPoll', this.pollId)
  },
  computed: {
    pollId () {
      return this.basePoll.id
    },
    poll () {
      const storePoll = this.$store.state.polls.pollsObject[this.pollId]
      return storePoll || {}
    },
    options () {
      return (this.poll && this.poll.options) || []
    },
    expiresAt () {
      return (this.poll && this.poll.expires_at) || 0
    },
    expired () {
      return (this.poll && this.poll.expired) || false
    },
    loggedIn () {
      return this.$store.state.users.currentUser
    },
    showResults () {
      return this.poll.voted || this.expired || !this.loggedIn
    },
    totalVotesCount () {
      return this.poll.votes_count
    },
    totalFractionBase () {
      // Due to a backend bug, we might not have any voter count info for remote polls
      // in this case, fall back to count of votes even for multiple cjoice polls
      // to be able to at least display _something_
      const total_base = this.poll.multiple ? this.poll.voters_count : this.poll.votes_count
      return total_base > 0 ? total_base : this.poll.votes_count
    },
    containerClass () {
      return {
        loading: this.loading
      }
    },
    choiceIndices () {
      // Convert array of booleans into an array of indices of the
      // items that were 'true', so [true, false, false, true] becomes
      // [0, 3].
      return this.choices
        .map((entry, index) => entry && index)
        .filter(value => typeof value === 'number')
    },
    isDisabled () {
      const noChoice = this.choiceIndices.length === 0
      return this.loading || noChoice
    }
  },
  methods: {
    percentageForOption (count) {
      const total = this.totalFractionBase
      return total === 0 ? 0 : Math.round(count / total * 100)
    },
    resultTitle (option) {
      return `${option.votes_count}/${this.totalFractionBase} ${this.$t('polls.votes')}`
    },
    fetchPoll () {
      this.$store.dispatch('refreshPoll', { id: this.statusId, pollId: this.poll.id })
    },
    activateOption (index) {
      // forgive me father: doing checking the radio/checkboxes
      // in code because of customized input elements need either
      // a) an extra element for the actual graphic, or b) use a
      // pseudo element for the label. We use b) which mandates
      // using "for" and "id" matching which isn't nice when the
      // same poll appears multiple times on the site (notifs and
      // timeline for example). With code we can make sure it just
      // works without altering the pseudo element implementation.
      const allElements = this.$el.querySelectorAll('input')
      const clickedElement = this.$el.querySelector(`input[value="${index}"]`)
      if (this.poll.multiple) {
        // Checkboxes, toggle only the clicked one
        clickedElement.checked = !clickedElement.checked
      } else {
        // Radio button, uncheck everything and check the clicked one
        forEach(allElements, element => { element.checked = false })
        clickedElement.checked = true
      }
      this.choices = map(allElements, e => e.checked)
    },
    optionId (index) {
      return `poll${this.poll.id}-${index}`
    },
    vote () {
      if (this.choiceIndices.length === 0) return
      this.loading = true
      this.$store.dispatch(
        'votePoll',
        { id: this.statusId, pollId: this.poll.id, choices: this.choiceIndices }
      ).then(poll => {
        this.loading = false
      })
    }
  }
}
