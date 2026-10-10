import { defineStore } from 'pinia'

import { storage } from 'src/lib/storage.js'

const storageKey = 'pleroma-fe-drafts'

/*
 * Note: we do not use the persist state plugin because
 * it is not impossible for a user to have two windows at
 * the same time. The persist state plugin is just overriding
 * everything with the current state. This isn't good because
 * if a draft is created in one window and another draft is
 * created in another, the draft in the first window will just
 * be overriden.
 * Here, we can't guarantee 100% atomicity unless one uses
 * different keys, which will just pollute the whole storage.
 * It is indeed best to have backend support for this.
 */
const getStorageData = async () => await storage.getItem(storageKey)

const saveDraftToStorage = async (draft) => {
  const currentData = (await getStorageData()) ?? {}
  currentData[draft.id] = JSON.parse(JSON.stringify(draft))
  await storage.setItem(storageKey, currentData)
}

const deleteDraftFromStorage = async (ids) => {
  const currentData = (await getStorageData()) ?? {}
  ids.forEach((id) => {
    delete currentData[id]
  })
  await storage.setItem(storageKey, currentData)
}

export const useDraftsStore = defineStore('drafts', {
  state: () => ({
    drafts: new Map(),
  }),
  getters: {
    draftsByTypeAndRefId(state) {
      return (type, refId) => {
        return [...state.drafts.values()].filter(
          (draft) => draft.type === type && draft.refId === refId,
        )
      }
    },
    draftsArray(state) {
      return [...state.drafts.values()]
    },
    draftsCount(state) {
      return state.drafts.size
    },
  },
  actions: {
    async loadDrafts() {
      const currentData = (await getStorageData()) ?? {}
      this.drafts = new Map(Object.entries(currentData))
    },
    async addOrSaveDraft(draft) {
      const id = draft.id ?? new Date().getTime().toString()
      const draftWithId = { ...draft, id }
      this.drafts.set(id, draftWithId)
      await saveDraftToStorage(draftWithId)
      return id
    },
    async abandonDraft(id) {
      await this.abandonDrafts([id])
    },
    // Deleting is a read-modify-write of the whole storage entry, so several
    // drafts have to go in one go: parallel deletions would undo each other
    async abandonDrafts(ids) {
      ids.forEach((id) => this.drafts.delete(id))
      await deleteDraftFromStorage(ids)
    },
    async abandonAllDrafts() {
      await this.abandonDrafts([...this.drafts.keys()])
    },
  },
})
