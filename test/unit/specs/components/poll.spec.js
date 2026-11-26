import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { mountOpts } from 'test/fixtures/setup_test.js'

import Poll from 'src/components/poll/poll.vue'

import { usePollsStore } from 'src/stores/polls.js'
import { useUsersStore } from 'src/stores/users.js'

const mountPoll = (poll) => {
  setActivePinia(createTestingPinia())
  useUsersStore().currentUser = { id: 'me' }
  usePollsStore().pollsObject = {
    poll: {
      id: 'poll',
      expired: true,
      options: poll.votes.map((votes_count, i) => ({
        votes_count,
        title_html: `option ${i}`,
      })),
      ...poll.fields,
    },
  }
  return mount(
    Poll,
    mountOpts({ props: { basePoll: { id: 'poll' }, emoji: [] } }),
  )
}

const shares = (wrapper) =>
  wrapper.findAll('.result-percentage').map((el) => el.text())
const titles = (wrapper) =>
  wrapper.findAll('.option-result').map((el) => el.attributes('title'))

describe('Poll results', () => {
  it('shows shares of the votes in a single choice poll', () => {
    const wrapper = mountPoll({
      votes: [3, 1],
      fields: { multiple: false, votes_count: 4, voters_count: 4 },
    })

    expect(shares(wrapper)).to.deep.equal(['75%', '25%'])
    expect(titles(wrapper)).to.deep.equal([
      '3/4 polls.votes',
      '1/4 polls.votes',
    ])
  })

  it('shows shares of the people in a multiple choice poll, as one person can pick several options', () => {
    // 10 people picked 20 options in all
    const wrapper = mountPoll({
      votes: [8, 6, 6],
      fields: { multiple: true, votes_count: 20, voters_count: 10 },
    })

    expect(shares(wrapper)).to.deep.equal(['80%', '60%', '60%'])
    expect(titles(wrapper)[0]).to.equal('8/10 polls.votes')
  })

  it.each([
    ['is zero', { voters_count: 0 }],
    ['is missing', {}],
    ['is not known', { voters_count: null }],
  ])('goes by the votes when the number of people %s', (_, fields) => {
    const wrapper = mountPoll({
      votes: [8, 6, 6],
      fields: { multiple: true, votes_count: 20, ...fields },
    })

    expect(shares(wrapper)).to.deep.equal(['40%', '30%', '30%'])
  })

  it('shows no shares as long as there are no votes', () => {
    const wrapper = mountPoll({
      votes: [0, 0],
      fields: { multiple: true, votes_count: 0, voters_count: 0 },
    })

    expect(shares(wrapper)).to.deep.equal(['0%', '0%'])
  })
})
