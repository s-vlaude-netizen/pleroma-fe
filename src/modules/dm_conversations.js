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
  clearDMConversations({ commit }) {
    commit('clearDMConversations')
  },
}

const dmConversations = {
  state: defaultState,
  mutations,
  actions,
  getters
}

export default dmConversations
