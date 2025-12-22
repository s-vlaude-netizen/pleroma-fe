import { promiseInterval } from '../promise_interval/promise_interval.js'

const fetchAndUpdate = ({ store, id, credentials }) => {
  return store.dispatch('fetchUser', id)
    .then((u) => store.commit('updateCurrentUser', u))
    .catch((e) => console.error(`Failed to update current user info (id=${JSON.stringify(id)}): ${e}`))
}

const startFetching = ({ credentials, id, store }) => {
  const boundFetchAndUpdate = () => fetchAndUpdate({ credentials, id, store })
  boundFetchAndUpdate()
  return promiseInterval(boundFetchAndUpdate, 60000)
}

const currentUserFetcher = {
  startFetching
}

export default currentUserFetcher
