import { remove, find } from 'lodash'

export const defaultState = {
  allDMConversations: [],
  dmConversationsPagination: {}
}

export const getters = {
  getDMConversationById: (state) => (id) => {
    return find(state.allDMConversations, { id })
  }
}

const mutations = {
  clearDMConversations(state) {
    state.allDMConversations = []
    state.dmConversationsPagination = undefined
  },
  saveDMConversationPagination(state, pagination) {
    state.dmConversationsPagination = pagination
  },
  addDMConversations(state, list) {
    state.allDMConversations.push(...list)
  },
  updateDMConversation(state, conv) {
    const idx = state.allDMConversations.findIndex(c => c.id == conv.id)
    if (idx >= 0)
      state.allDMConversations[idx] = conv
    else
      state.allDMConversations.push(conv)
  },
  updateDMConversations(state, list) {
    for (const conv of list) {
      const idx = state.allDMConversations.findIndex(c => c.id == conv.id)
      if (idx >= 0)
        state.allDMConversations[idx] = conv
      else
        state.allDMConversations.push(conv)
    }
  },
}

const actions = {
  fetchDMConversationList({ rootState, commit }) {
    const savedPagination = rootState.dmConversations.dmConversationsPagination
    return rootState.api.backendInteractor
      .fetchDMConversationList({ pagination: savedPagination })
      .then(({ data, pagination }) => {
        commit('addDMConversations', data)
        commit('saveDMConversationPagination', pagination)
        return data
      })
  },
  fetchDMConversationDetails({ rootState, commit }, { id }) {
    return rootState.api.backendInteractor
      .fetchDMConversationDetails({ id })
      .then(data => {
        commit('updateDMConversation', data)
        return data
      })
  },
  clearDMConversations({ commit }) {
    commit('clearDMConversations')
  },
  markDMConversationAsRead({ rootState, commit }, { id }) {
    rootState.api.backendInteractor
      .markDMConversationAsRead({ id })
      .then(data => commit('updateDMConversation', data))
  },
  markAllDMConversationsAsRead({ rootState, commit }) {
    rootState.api.backendInteractor
      .markAllDMConversationsAsRead()
      .then(data => commit('updateDMConversations', data))
  },
}

const dmConversations = {
  state: defaultState,
  mutations,
  actions,
  getters
}

export default dmConversations
