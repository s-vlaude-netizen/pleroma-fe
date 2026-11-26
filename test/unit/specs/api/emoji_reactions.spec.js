import { reactWithEmoji, unreactWithEmoji } from 'src/api/user.js'

describe('Emoji reactions API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // The URL the request goes to, the way the browser takes it apart
  const requestedUrl = async (call, emoji) => {
    const fetchStub = vi.fn(() =>
      Promise.reject(new Error('nothing to answer')),
    )
    vi.stubGlobal('fetch', fetchStub)

    await call({ id: 'status', emoji, credentials: 'token' }).catch(
      () => undefined,
    )

    return new URL(fetchStub.mock.calls[0][0], 'https://pleroma.example')
  }

  describe.each([
    ['reacting', reactWithEmoji],
    ['unreacting', unreactWithEmoji],
  ])('when %s', (_, call) => {
    it.each([
      ['a keycap number sign, which starts with #', '#️⃣'],
      ['a keycap with a number', '1️⃣'],
      ['an emoji with a variation selector', '❤️'],
      ['an emoji', '👍'],
      ['a custom emoji', 'blobcat'],
    ])('sends %s in the path of the request', async (_, emoji) => {
      const url = await requestedUrl(call, emoji)

      expect(url.hash).to.equal('')
      expect(url.search).to.equal('')
      expect(
        url.pathname.startsWith('/api/v1/pleroma/statuses/status/reactions/'),
      ).to.equal(true)
      expect(
        decodeURIComponent(
          url.pathname.slice(
            '/api/v1/pleroma/statuses/status/reactions/'.length,
          ),
        ),
      ).to.equal(emoji)
    })
  })
})
