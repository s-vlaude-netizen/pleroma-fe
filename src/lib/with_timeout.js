// Rejects when the promise hasn't settled in time. For the things the whole
// app would otherwise wait for forever, i.e. browser storage that never answers.
export const withTimeout = (promise, ms, what = 'operation') =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms waiting for ${what}`))
    }, ms)

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
