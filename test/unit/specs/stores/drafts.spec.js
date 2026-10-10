import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import { useDraftsStore } from 'src/stores/drafts.js'

import { storage } from 'src/lib/storage.js'

describe('Drafts store', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    // Localforage does something weird that resets get/setItem and breaks
    // mocking if we just spy one them without overriding implementation
    vi.spyOn(storage, 'setItem').mockImplementation(() => ({}))
    vi.spyOn(storage, 'getItem').mockImplementation(() => ({}))
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Getters', () => {
    it('draftsCount returns total number of drafts', async () => {
      const store = useDraftsStore()

      await store.addOrSaveDraft({ id: 1, status: 'draft' })
      await store.addOrSaveDraft({ id: 2, status: 'draft' })
      await store.addOrSaveDraft({ id: 3, status: 'draft' })

      expect(store).to.have.property('draftsCount', 3)
    })

    it('draftsArray returns array of drafts', async () => {
      const store = useDraftsStore()

      await store.addOrSaveDraft({ id: 1, status: 'draft' })
      await store.addOrSaveDraft({ id: 2, status: 'draft' })
      await store.addOrSaveDraft({ id: 3, status: 'draft' })

      expect(store.draftsArray).to.have.length(3)
      expect(store.draftsArray).to.be.an('Array')
      expect(store.draftsArray).to.have.deep.members([
        { id: 1, status: 'draft' },
        { id: 2, status: 'draft' },
        { id: 3, status: 'draft' },
      ])
    })

    it('draftsByTypeAndRefId', async () => {
      const store = useDraftsStore()

      await store.addOrSaveDraft({
        id: 1,
        type: 'edit',
        refId: 'e1',
        status: 'draft',
      })
      await store.addOrSaveDraft({
        id: 2,
        type: 'reply',
        refId: 'r1',
        status: 'draft',
      })
      await store.addOrSaveDraft({ id: 3, status: 'draft' })
      await store.addOrSaveDraft({
        id: 4,
        type: 'edit',
        refId: 'e2',
        status: 'draft',
      })
      await store.addOrSaveDraft({
        id: 5,
        type: 'reply',
        refId: 'r2',
        status: 'draft',
      })

      expect(store.draftsByTypeAndRefId).to.be.a('function')
      expect(store.draftsByTypeAndRefId('edit', 'e1')).to.eql([
        { id: 1, type: 'edit', refId: 'e1', status: 'draft' },
      ])
      expect(store.draftsByTypeAndRefId('reply', 'r1')).to.eql([
        { id: 2, type: 'reply', refId: 'r1', status: 'draft' },
      ])
    })
  })

  describe('Actions', () => {
    describe('loadDrafts', () => {
      it('should load drafts from storage and populate cache', async () => {
        const store = useDraftsStore()
        storage.getItem.mockResolvedValueOnce({
          a: { id: 'a', status: 'draft' },
          b: { id: 'b', status: 'draft' },
          c: { id: 'c', status: 'draft' },
        })

        await store.loadDrafts()

        expect(store.drafts.get('a')).to.have.property('status', 'draft')
        expect(store.drafts.get('b')).to.have.property('status', 'draft')
        expect(store.drafts.get('c')).to.have.property('status', 'draft')

        expect(storage.getItem).to.have.been.calledOnce
        expect(storage.getItem).to.have.been.calledWith('pleroma-fe-drafts')
        expect(storage.setItem).to.have.not.been.called
      })

      it('should handle case where there is no local draft storage yet', async () => {
        const store = useDraftsStore()
        storage.getItem.mockResolvedValueOnce(null)

        await store.loadDrafts()

        expect(store.drafts).to.have.property('size', 0)

        expect(storage.getItem).to.have.been.calledOnce
        expect(storage.getItem).to.have.been.calledWith('pleroma-fe-drafts')
        expect(storage.setItem).to.have.not.been.called
      })
    })

    describe('addOrSaveDraft', () => {
      it('create draft', async () => {
        const store = useDraftsStore()
        vi.setSystemTime(new Date(859586400000))

        const id = await store.addOrSaveDraft({ status: 'draft' })

        expect(store.drafts).to.have.property('size', 1)
        expect(id).to.eql('859586400000')
        expect(store.drafts.get(id)).to.have.property('status', 'draft')
        expect(storage.getItem).to.have.been.calledOnce
        expect(storage.setItem).to.have.been.calledOnce
        expect(storage.setItem).to.have.been.calledWith('pleroma-fe-drafts', {
          [id]: {
            id,
            status: 'draft',
          },
        })
      })

      it('update draft', async () => {
        const store = useDraftsStore()
        await store.addOrSaveDraft({ id: '1', status: 'draft' })

        expect(store.drafts.get('1')).to.have.property('status', 'draft')

        await store.addOrSaveDraft({ id: '1', status: 'updated' })

        expect(store.drafts.get('1')).to.have.property('status', 'updated')
        expect(storage.getItem).to.have.been.calledTwice
        expect(storage.setItem).to.have.been.calledTwice
        expect(storage.setItem).to.have.been.calledWith('pleroma-fe-drafts', {
          1: {
            id: '1',
            status: 'draft',
          },
        })
      })
    })

    describe('abandonDraft', () => {
      it('should remove draft from storage and cache', async () => {
        const store = useDraftsStore()
        store.drafts.set('a', { id: 'a', status: 'draft' })
        store.drafts.set('b', { id: 'b', status: 'draft' })
        store.drafts.set('c', { id: 'c', status: 'draft' })
        storage.getItem.mockResolvedValueOnce({
          a: { id: 'a', status: 'draft' },
          b: { id: 'b', status: 'draft' },
          c: { id: 'c', status: 'draft' },
        })

        await store.abandonDraft('b')

        expect(store.drafts.get('a')).to.have.property('status', 'draft')
        expect(store.drafts.get('b')).to.be.undefined
        expect(store.drafts.get('c')).to.have.property('status', 'draft')

        expect(storage.getItem).to.have.been.calledOnce
        expect(storage.setItem).to.have.been.calledOnce
        expect(storage.setItem).to.have.been.calledWith('pleroma-fe-drafts', {
          a: {
            id: 'a',
            status: 'draft',
          },
          c: {
            id: 'c',
            status: 'draft',
          },
        })
      })
    })

    describe('abandonDrafts', () => {
      it('should remove several drafts from storage and cache in one go', async () => {
        const store = useDraftsStore()
        store.drafts.set('a', { id: 'a', status: 'draft' })
        store.drafts.set('b', { id: 'b', status: 'draft' })
        store.drafts.set('c', { id: 'c', status: 'draft' })
        storage.getItem.mockResolvedValueOnce({
          a: { id: 'a', status: 'draft' },
          b: { id: 'b', status: 'draft' },
          c: { id: 'c', status: 'draft' },
        })

        await store.abandonDrafts(['a', 'c'])

        expect(store.drafts.get('a')).to.be.undefined
        expect(store.drafts.get('b')).to.have.property('status', 'draft')
        expect(store.drafts.get('c')).to.be.undefined

        // Separate deletions would each write back what they read and undo one another
        expect(storage.getItem).to.have.been.calledOnce
        expect(storage.setItem).to.have.been.calledOnce
        expect(storage.setItem).to.have.been.calledWith('pleroma-fe-drafts', {
          b: {
            id: 'b',
            status: 'draft',
          },
        })
      })
    })

    describe('abandonAllDrafts', () => {
      it('should remove draft from storage and cache', async () => {
        const store = useDraftsStore()
        store.drafts.set('a', { id: 'a', status: 'draft' })
        store.drafts.set('b', { id: 'b', status: 'draft' })
        store.drafts.set('c', { id: 'c', status: 'draft' })
        storage.getItem.mockResolvedValueOnce({
          a: { id: 'a', status: 'draft' },
          b: { id: 'b', status: 'draft' },
          c: { id: 'c', status: 'draft' },
        })

        await store.abandonAllDrafts()

        expect(store.drafts.get('a')).to.be.undefined
        expect(store.drafts.get('b')).to.be.undefined
        expect(store.drafts.get('c')).to.be.undefined

        expect(storage.getItem).to.have.been.calledOnce
        expect(storage.setItem).to.have.been.calledOnce
        expect(storage.setItem).to.have.been.calledWith('pleroma-fe-drafts', {})
      })
    })
  })
})
