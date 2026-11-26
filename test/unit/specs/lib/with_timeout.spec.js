import { withTimeout } from 'src/lib/with_timeout.js'

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('passes the value through when the promise settles in time', async () => {
    const promise = withTimeout(Promise.resolve('done'), 1000, 'something')

    await expect(promise).resolves.toBe('done')
    // no timer is left behind to fire later
    expect(vi.getTimerCount()).toBe(0)
  })

  it('passes the error through when the promise rejects in time', async () => {
    const error = new Error('nope')
    const promise = withTimeout(Promise.reject(error), 1000, 'something')

    await expect(promise).rejects.toBe(error)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects saying what it waited for when the promise never settles', async () => {
    const promise = withTimeout(
      new Promise(() => undefined),
      1000,
      'the storage',
    )
    const result = expect(promise).rejects.toThrow(
      'Timed out after 1000ms waiting for the storage',
    )

    await vi.advanceTimersByTimeAsync(1000)

    await result
  })

  it('does not reject before the time is up', async () => {
    let settled = false
    const promise = withTimeout(new Promise(() => undefined), 1000)
    promise.catch(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(999)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
  })
})
