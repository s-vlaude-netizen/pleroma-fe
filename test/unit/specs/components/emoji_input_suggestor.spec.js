import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import { suggestUsers } from 'src/components/emoji_input/suggestor.js'

import { useSearchStore } from 'src/stores/search.js'

describe('Suggesting users', () => {
  let searchUsers

  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createTestingPinia())
    searchUsers = useSearchStore().searchUsers
    searchUsers.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // the search is debounced
  const suggest = async (input) => {
    const suggestions = suggestUsers()(input)
    await vi.advanceTimersByTimeAsync(300)
    return suggestions
  }

  it('searches for the nick of a local user', async () => {
    await suggest('@someone')

    expect(searchUsers).toHaveBeenCalledWith({ query: 'someone' })
  })

  it('searches for the nick of a remote user, which has an instance in it', async () => {
    // not searching left remote users out of the suggestions unless they
    // happened to be known already
    await suggest('@someone@remote.example')

    expect(searchUsers).toHaveBeenCalledWith({
      query: 'someone@remote.example',
    })
  })

  it('searches for a remote user while the instance is being typed', async () => {
    await suggest('@someone@')

    expect(searchUsers).toHaveBeenCalledWith({ query: 'someone@' })
  })

  it('does not search for what is not a nick', async () => {
    const suggestions = await suggest('@some@one@remote.example')

    expect(searchUsers).not.toHaveBeenCalled()
    expect(suggestions).to.deep.equal([])
  })
})
