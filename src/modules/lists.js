import { remove, find } from 'lodash'

export const defaultState = {
  allLists: [],
  allListsObject: {}
}

export const mutations = {
  setLists (state, value) {
    state.allLists = value

    // Stub out fields for newly fetched lists
    for (const list of state.allLists) {
      if (!list.accountIds) list.accountIds = []
    }
  },
  setList (state, { id, title, exclusive }) {
    if (!state.allListsObject[id]) {
      state.allListsObject[id] = {}
    }

    const list = state.allListsObject[id]
    list.title = title
    list.exclusive = exclusive
    // newly created list
    if (!list.accountIds) list.accountIds = []

    const listEntry = find(state.allLists, { id })
    if (!listEntry) {
      state.allLists.push({ id, ...list })
    } else {
      Object.assign(listEntry, list)
    }
  },
  setListAccounts (state, { id, accountIds }) {
    // XXX: this shouldn’t happen in the first place...
    if (!state.allListsObject[id]) {
      state.allListsObject[id] = { title: "", exclusive: false }
    }
    state.allListsObject[id].accountIds = accountIds
  },
  deleteList (state, { id }) {
    delete state.allListsObject[id]
    remove(state.allLists, list => list.id === id)
  }
}

const actions = {
  setLists ({ commit }, value) {
    commit('setLists', value)
  },
  createList ({ rootState, commit }, { title, exclusive }) {
    return rootState.api.backendInteractor.createList({ title, exclusive })
      .then((list) => {
        commit('setList', list)
        return list
      })
  },
  fetchList ({ rootState, commit }, { id }) {
    return rootState.api.backendInteractor.getList({ id })
      .then((list) => {
        commit('setList', list)
        return list
      })
  },
  fetchListAccounts ({ rootState, commit }, { id }) {
    return rootState.api.backendInteractor.getListAccounts({ id })
      .then((accountIds) => commit('setListAccounts', { id, accountIds }))
  },
  setList ({ rootState, commit }, { id, title, exclusive }) {
    rootState.api.backendInteractor.updateList({ id, title, exclusive })
    .then((list) => commit('setList', list))
  },
  setListAccounts ({ rootState, commit }, { id, accountIds }) {
    const saved = rootState.lists.allListsObject[id].accountIds
    const added = accountIds.filter(id => !saved.includes(id))
    const removed = saved.filter(id => !accountIds.includes(id))
    commit('setListAccounts', { id, accountIds })
    if (added.length > 0) {
      rootState.api.backendInteractor.addAccountsToList({ id, accountIds: added })
    }
    if (removed.length > 0) {
      rootState.api.backendInteractor.removeAccountsFromList({ id, accountIds: removed })
    }
  },
  deleteList ({ rootState, commit }, { id }) {
    rootState.api.backendInteractor.deleteList({ id })
    commit('deleteList', { id })
  }
}

export const getters = {
  findListTitle: state => id => {
    if (!state.allListsObject[id]) return
    return state.allListsObject[id].title
  },
  findListAccounts: state => id => {
    return [...state.allListsObject[id].accountIds]
  }
}

const lists = {
  state: defaultState,
  mutations,
  actions,
  getters
}

export default lists
