import Checkbox from 'components/checkbox/checkbox.vue'
import Timeago from 'components/timeago/timeago.vue'

import genRandomSeed from '../../services/random_seed/random_seed.service.js'

import { useMergedConfigStore } from 'src/stores/merged_config.js'
import { usePollsStore } from 'src/stores/polls.js'
import { useUsersStore } from 'src/stores/users.js'

export default {
  name: 'Poll',
  props: ['basePoll', 'emoji'],
  components: {
    Timeago,

    Checkbox,
  },
  data() {
    return {
      loading: false,
      choices: [],
      randomSeed: genRandomSeed(),
    }
  },
  created() {
    if (!usePollsStore().pollsObject[this.pollId]) {
      usePollsStore().mergeOrAddPoll(this.basePoll)
    }
    usePollsStore().trackPoll(this.pollId)
  },
  unmounted() {
    usePollsStore().untrackPoll(this.pollId)
  },
  computed: {
    pollId() {
      return this.basePoll.id
    },
    poll() {
      const storePoll = usePollsStore().pollsObject[this.pollId]
      return storePoll || {}
    },
    options() {
      return this.poll?.options || []
    },
    expiresAt() {
      return this.poll?.expires_at || null
    },
    expired() {
      return this.poll?.expired || false
    },
    expirationLabel() {
      if (useMergedConfigStore().mergedConfig.useAbsoluteTimeFormat) {
        return this.expired ? 'polls.expired_at' : 'polls.expires_at'
      } else {
        return this.expired ? 'polls.expired' : 'polls.expires_in'
      }
    },
    allowNonSquareEmoji() {
      return useMergedConfigStore().mergedConfig.nonSquareEmoji
    },
    pauseMfm() {
      return useMergedConfigStore().mergedConfig.pauseMfm
    },
    scaleMfm() {
      return useMergedConfigStore().mergedConfig.scaleMfm
    },
    loggedIn() {
      return useUsersStore().currentUser
    },
    showResults() {
      return this.poll.voted || this.expired || !this.loggedIn
    },
    totalVotesCount() {
      return this.poll.votes_count
    },
    // What the shares of the options are of. In a multiple choice poll one
    // person can pick several options, so the votes add up to more than the
    // people, who are what the shares are about. Remote polls may come without
    // the count of them (a backend bug): the votes have to do then.
    totalFractionBase() {
      const base = this.poll.multiple
        ? this.poll.voters_count
        : this.totalVotesCount
      return base > 0 ? base : this.totalVotesCount
    },
    containerClass() {
      return {
        loading: this.loading,
      }
    },
    choiceIndices() {
      // Convert array of booleans into an array of indices of the
      // items that were 'true', so [true, false, false, true] becomes
      // [0, 3].
      return this.choices
        .map((entry, index) => entry && index)
        .filter((value) => typeof value === 'number')
    },
    isDisabled() {
      const noChoice = this.choiceIndices.length === 0
      return this.loading || noChoice
    },
  },
  methods: {
    percentageForOption(count) {
      return this.totalFractionBase === 0
        ? 0
        : Math.round((count / this.totalFractionBase) * 100)
    },
    resultTitle(option) {
      return `${option.votes_count}/${this.totalFractionBase} ${this.$t('polls.votes')}`
    },
    activateOption(index, value) {
      let result
      if (this.poll.multiple) {
        result = this.choices || this.options.map(() => false)
      } else {
        result = this.options.map(() => false)
      }
      result[index] = value
      this.choices = result
    },
    optionId(index) {
      return `poll${this.poll.id}-${index}`
    },
    vote() {
      if (this.choiceIndices.length === 0) return
      this.loading = true
      usePollsStore()
        .votePoll({
          id: this.statusId,
          pollId: this.poll.id,
          choices: this.choiceIndices,
        })
        .then(() => {
          this.loading = false
        })
    },
  },
}
