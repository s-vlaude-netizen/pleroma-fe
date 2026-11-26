import App from 'src/App.js'

describe('App splash screen', () => {
  let page

  const removeSplash = () => App.methods.removeSplash.call({ $t: (key) => key })
  const app = () => document.querySelector('#app')
  const splash = () => document.querySelector('#splash')

  beforeEach(() => {
    vi.useFakeTimers()
    page = document.createElement('div')
    page.innerHTML = `
      <div id="splash"><div id="status"></div></div>
      <div id="app" class="hidden"></div>`
    document.body.append(page)
  })

  afterEach(() => {
    page.remove()
    vi.useRealTimers()
  })

  it('shows the app, fades the splash screen out and then removes it', () => {
    removeSplash()

    expect(app().classList.contains('hidden')).to.equal(false)
    expect(splash().classList.contains('hidden')).to.equal(true)
    expect(document.querySelector('#status').textContent).to.match(
      /^splash\.fun_[1-4]$/,
    )

    vi.advanceTimersByTime(600)

    expect(splash()).to.equal(null)
  })

  it('removes the splash screen once its fading out is over', () => {
    removeSplash()
    const fading = splash()

    fading.dispatchEvent(new Event('transitionend'))

    expect(fading.isConnected).to.equal(false)
  })

  it('shows the app even when the splash screen is already gone', () => {
    splash().remove()

    expect(removeSplash).to.not.throw()

    expect(app().classList.contains('hidden')).to.equal(false)
  })

  it('shows the app even when the splash screen has no status line', () => {
    document.querySelector('#status').remove()

    expect(removeSplash).to.not.throw()

    expect(app().classList.contains('hidden')).to.equal(false)
    expect(splash().classList.contains('hidden')).to.equal(true)
  })
})
