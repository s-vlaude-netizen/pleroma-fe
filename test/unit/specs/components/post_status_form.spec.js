import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { $t, mountOpts, waitForEvent } from 'test/fixtures/setup_test.js'
import { vi } from 'vitest'
import { nextTick } from 'vue'

import PostStatusForm from 'src/components/post_status_form/post_status_form.vue'

import { useDraftsStore } from 'src/stores/drafts.js'
import { useInstanceCapabilitiesStore } from 'src/stores/instance_capabilities.js'
import { useMergedConfigStore } from 'src/stores/merged_config.js'
import { useStatusesStore } from 'src/stores/statuses.js'
import { useUsersStore } from 'src/stores/users.js'

import { storage } from 'src/lib/storage.js'

const autoSaveOrNot = (caseFn, caseTitle, runFn) => {
  caseFn(`${caseTitle} with auto-save`, function () {
    return runFn.bind(this)(true)
  })

  caseFn(`${caseTitle} with no auto-save`, function () {
    return runFn.bind(this)(false)
  })
}

const saveManually = async (wrapper) => {
  const morePostActions = wrapper.findByText(
    'button',
    $t('post_status.more_post_actions'),
  )
  await morePostActions.trigger('click')

  const btn = wrapper.findByText(
    'button',
    $t('post_status.save_to_drafts_button'),
  )
  await btn.trigger('click')
}

const waitSaveTime = 4000

const currentUser = {
  id: 'current-user',
  default_scope: 'public',
  locked: false,
}

const repliedUser = {
  id: 'replied-user',
  screen_name: 'replied',
}

const repliedStatus = {
  id: 'status-1',
  visibility: 'public',
  user: repliedUser,
}

const repliedStatus2 = {
  id: 'status-2',
  visibility: 'private',
  summary: 'subject',
  user: repliedUser,
}

describe('PostStatusForm', () => {
  describe('Basic functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      setActivePinia(createTestingPinia())
      useUsersStore().currentUser = currentUser
      useStatusesStore().allStatuses = new Map([
        [repliedStatus.id, repliedStatus],
      ])
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('Clean empty initial state', () => {
      const wrapper = mount(PostStatusForm, mountOpts())

      expect(wrapper.vm.statusType).to.equal('new')
      expect(wrapper.vm.newStatus.spoilerText).to.eql('')
      expect(wrapper.vm.newStatus.mentions).to.eql('')
      expect(wrapper.vm.newStatus.status).to.eql('')
    })

    it('Reset cleans form to pristine state equal to state form was when created', () => {
      const wrapper = mount(PostStatusForm, mountOpts())

      const initial = { ...wrapper.vm.newStatus }
      wrapper.vm.clearStatus()

      expect(wrapper.vm.newStatus).to.eql(initial)
    })

    it('Initializes a reply form', () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            repliedStatus: repliedStatus,
          },
        }),
      )

      useInstanceCapabilitiesStore().quotingAvailable = true

      expect(wrapper.vm.statusType).to.equal('reply')
      expect(wrapper.vm.isReply).to.equal(true)
      expect(wrapper.vm.refId).to.equal('status-1')
      expect(wrapper.vm.quotable).to.equal(true)
      expect(wrapper.vm.inReplyToStatusId).to.equal('status-1')
      expect(wrapper.vm.newStatus.quote).to.be.null
      expect(wrapper.vm.newStatus.poll).to.be.null
      expect(wrapper.vm.newStatus.spoilerText).to.eql('')
      expect(wrapper.vm.newStatus.mentions).to.eql('@replied')
      expect(wrapper.vm.newStatus.status).to.eql('@replied ')
      expect(wrapper.vm.newStatus.visibility).to.eql('public')
    })

    it('Copies scope and subject line, disables quoting for locked posts', () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            repliedStatus: repliedStatus2,
          },
        }),
      )

      useInstanceCapabilitiesStore().quotingAvailable = true

      expect(wrapper.vm.statusType).to.equal('reply')
      expect(wrapper.vm.isReply).to.equal(true)
      expect(wrapper.vm.quotable).to.equal(false)
      expect(wrapper.vm.newStatus.quote).to.be.null
      expect(wrapper.vm.newStatus.poll).to.be.null
      expect(wrapper.vm.newStatus.spoilerText).to.eql('re: subject')
      expect(wrapper.vm.newStatus.mentions).to.eql('@replied')
      expect(wrapper.vm.newStatus.status).to.eql('@replied ')
      expect(wrapper.vm.newStatus.visibility).to.eql('private')

      expect(wrapper.vm.postingOptions.status).to.eql('@replied ')
      expect(wrapper.vm.postingOptions.spoilerText).to.eql('re: subject')
      expect(wrapper.vm.postingOptions.visibility).to.eql('private')
      expect(wrapper.vm.postingOptions.sensitive).to.eql(false)
      expect(wrapper.vm.postingOptions.media).to.eql([])
      expect(wrapper.vm.postingOptions.inReplyToStatusId).to.eql('status-2')
      expect(wrapper.vm.postingOptions.quoteId).to.be.null
      expect(wrapper.vm.postingOptions.contentType).to.eql('text/plain')
      expect(wrapper.vm.postingOptions.poll).to.be.null
    })

    it('Forces direct mode when replying to a DM, mastodon style subject handling', () => {
      // We need to initialize pinia first which is happening here...
      const options = mountOpts({
        props: {
          repliedStatus: { ...repliedStatus2, visibility: 'direct' },
        },
      })

      // ...set our settings...
      useMergedConfigStore().mergedConfig = {
        ...useMergedConfigStore().mergedConfig,
        subjectLineBehavior: 'masto',
      }

      // ...and only then mount our component
      const wrapper = mount(PostStatusForm, options)

      // Otherwise we get multiple instances of pinia that don't talk to each other

      expect(wrapper.vm.statusType).to.equal('reply')
      expect(wrapper.vm.isReply).to.equal(true)
      expect(wrapper.vm.quotable).to.equal(false)
      expect(wrapper.vm.newStatus.quote).to.be.null
      expect(wrapper.vm.newStatus.poll).to.be.null
      expect(wrapper.vm.newStatus.spoilerText).to.eql('subject')
      expect(wrapper.vm.newStatus.mentions).to.eql('@replied')
      expect(wrapper.vm.newStatus.status).to.eql('@replied ')
      expect(wrapper.vm.newStatus.visibility).to.eql('direct')
    })

    it('Sets status to statusText without mentions if mentions line is enabled', () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            repliedStatus: repliedStatus2,
            statusText: 'testing',
            mentionsLine: true,
          },
        }),
      )

      expect(wrapper.vm.statusType).to.equal('reply')
      expect(wrapper.vm.isReply).to.equal(true)
      expect(wrapper.vm.newStatus.mentions).to.eql('@replied')
      expect(wrapper.vm.newStatus.status).to.eql('testing')
    })

    it('Sets mention when asked for it', () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            profileMention: repliedUser,
          },
        }),
      )

      expect(wrapper.vm.statusType).to.equal('mention')
      expect(wrapper.vm.isReply).to.equal(false)
      expect(wrapper.vm.newStatus.mentions).to.eql('@replied')
      expect(wrapper.vm.newStatus.status).to.eql('@replied ')
    })

    it('Initializes quote when reply/quote toggled to quote', () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            repliedStatus: repliedStatus2,
          },
        }),
      )

      expect(wrapper.vm.statusType).to.equal('reply')
      expect(wrapper.vm.isReply).to.equal(true)

      wrapper.vm.quoteThreadToggled = true

      expect(wrapper.vm.newStatus.quote).to.eql({
        thread: true,
        id: 'status-2',
      })
    })

    it('Resets quote when reply/quote toggled to reply', () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            repliedStatus: repliedStatus2,
          },
        }),
      )

      expect(wrapper.vm.statusType).to.equal('reply')
      expect(wrapper.vm.isReply).to.equal(true)

      wrapper.vm.quoteThreadToggled = true
      wrapper.vm.quoteThreadToggled = false

      expect(wrapper.vm.newStatus.quote).to.be.null
    })

    it('Initializes and reset quote when toggling quote attachment', () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            repliedStatus: repliedStatus2,
          },
        }),
      )

      expect(wrapper.vm.statusType).to.equal('reply')
      expect(wrapper.vm.isReply).to.equal(true)

      wrapper.vm.toggleQuoteForm()
      expect(wrapper.vm.newStatus.quote).to.eql({
        thread: false,
        id: null,
        url: '',
      })
      wrapper.vm.toggleQuoteForm()
      expect(wrapper.vm.newStatus.quote).to.be.null
    })

    it('Status editing', () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            statusId: 'edited',
            statusText: 'text',
            statusSubject: 'heading',
            statusIsSensitive: true,
            statusPoll: {},
            statusQuote: {},
            statusFiles: [],
            statusMediaDescriptions: {},
            statusVisibility: 'unlisted',
            statusContentType: 'text/markdown',
          },
        }),
      )

      expect(wrapper.vm.statusType).to.equal('edit')
      expect(wrapper.vm.isReply).to.equal(false) // edits don't support changing reply-to so it's pretty much ignored
      expect(wrapper.vm.isEdit).to.equal(true)
      expect(wrapper.vm.newStatus.quote).to.eql({})
      expect(wrapper.vm.newStatus.poll).to.eql({})
      expect(wrapper.vm.newStatus.spoilerText).to.eql('heading')
      expect(wrapper.vm.newStatus.mentions).to.eql('')
      expect(wrapper.vm.newStatus.status).to.eql('text')
      expect(wrapper.vm.newStatus.visibility).to.eql('unlisted')
      expect(wrapper.vm.newStatus.contentType).to.eql('text/markdown')
      expect(wrapper.vm.newStatus.nsfw).to.equal(true)
      expect(wrapper.vm.newStatus.files).to.eql([])
    })

    it('Posting should reset idempotency key', async () => {
      vi.setSystemTime(new Date(2027, 1, 1, 13))
      const wrapper = mount(PostStatusForm, mountOpts())
      const oldIdempotency = wrapper.vm.idempotencyKey

      vi.setSystemTime(new Date(2028, 1, 1, 13))

      wrapper.vm.newStatus.status = 'Testing'
      await wrapper.vm.postStatus()

      expect(wrapper.vm.idempotencyKey).to.not.eql(oldIdempotency)
    })
  })

  describe('Attachments', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      setActivePinia(createTestingPinia())
      useUsersStore().currentUser = currentUser
      useStatusesStore().allStatuses = new Map([
        [repliedStatus.id, repliedStatus],
      ])
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    // TODO Probably better to separate attachment upload/manipulation into its own component?
    // we need to upload-on-submit for compression setting anyway
    it('Attachments manipulations (moving, adding, removing)', () => {
      const wrapper = mount(PostStatusForm, mountOpts())

      const i1 = { id: '1', url: 'a' }
      const i2 = { id: '2', url: 'b' }
      const i3 = { id: '3', url: 'c' }
      const i4 = { id: '4', url: 'd' }
      const iX = { id: 'x', url: 'x' }

      wrapper.vm.newStatus.files = [i3, i1, iX, i2]

      wrapper.vm.removeMediaFile(iX)
      expect(wrapper.vm.newStatus.files).to.eql([i3, i1, i2])

      wrapper.vm.shiftUpMediaFile(i1)
      expect(wrapper.vm.newStatus.files).to.eql([i1, i3, i2])

      wrapper.vm.shiftUpMediaFile(i1) // should ignore
      expect(wrapper.vm.newStatus.files).to.eql([i1, i3, i2])

      wrapper.vm.shiftDnMediaFile(i3)
      expect(wrapper.vm.newStatus.files).to.eql([i1, i2, i3])

      wrapper.vm.shiftDnMediaFile(i3) // should ignore
      expect(wrapper.vm.newStatus.files).to.eql([i1, i2, i3])

      wrapper.vm.addMediaFile(i4)
      expect(wrapper.vm.newStatus.files).to.eql([i1, i2, i3, i4])
    })

    it('Attachment descriptions', () => {
      const wrapper = mount(PostStatusForm, mountOpts())

      const i1 = { id: '1', url: 'a' }

      wrapper.vm.addMediaFile(i1)
      expect(wrapper.vm.newStatus.files).to.eql([i1])

      wrapper.vm.editAttachment(i1, 'description')
      expect(wrapper.vm.newStatus.mediaDescriptions['1']).to.eql('description')
    })
  })

  describe('Draft saving', () => {
    beforeEach(() => {
      setActivePinia(createTestingPinia({ stubActions: false }))
      useUsersStore().currentUser = currentUser
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    autoSaveOrNot(
      it,
      'should save when the button is clicked',
      async (autoSave) => {
        const wrapper = mount(PostStatusForm, mountOpts())
        const store = useMergedConfigStore()
        store.mergedConfig = {
          autoSaveDraft: autoSave,
        }
        expect(useDraftsStore().draftsCount).to.equal(0)

        const textarea = wrapper.get('textarea')
        await textarea.setValue('mew mew')

        await saveManually(wrapper)
        expect(useDraftsStore().draftsCount).to.equal(1)
        expect(useDraftsStore().draftsArray[0].status).to.equal('mew mew')
      },
    )

    it('should auto-save if it is enabled', async function () {
      vi.useFakeTimers()
      const wrapper = mount(PostStatusForm, mountOpts())
      const store = useMergedConfigStore()
      store.mergedConfig = {
        autoSaveDraft: true,
      }
      expect(useDraftsStore().draftsCount).to.equal(0)
      const textarea = wrapper.get('textarea')
      await textarea.setValue('mew mew')

      expect(useDraftsStore().draftsCount).to.equal(0)
      await vi.advanceTimersByTimeAsync(waitSaveTime)
      expect(useDraftsStore().draftsCount).to.equal(1)
      expect(useDraftsStore().draftsArray[0].status).to.equal('mew mew')
    })

    it('should auto-save when close if auto-save is on', async () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            closeable: true,
          },
        }),
      )
      const store = useMergedConfigStore()
      store.mergedConfig = {
        autoSaveDraft: true,
      }
      expect(useDraftsStore().draftsCount).to.equal(0)
      const textarea = wrapper.get('textarea')
      await textarea.setValue('mew mew')
      wrapper.vm.requestClose()
      expect(useDraftsStore().draftsCount).to.equal(1)
      await waitForEvent(wrapper, 'close-accepted')
    })

    it('should save when close if auto-save is off, and unsavedPostAction is save', async () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            closeable: true,
          },
        }),
      )
      const store = useMergedConfigStore()
      store.mergedConfig = {
        autoSaveDraft: false,
        unsavedPostAction: 'save',
      }
      expect(useDraftsStore().draftsCount).to.equal(0)
      const textarea = wrapper.get('textarea')
      await textarea.setValue('mew mew')
      wrapper.vm.requestClose()
      expect(useDraftsStore().draftsCount).to.equal(1)
      await waitForEvent(wrapper, 'close-accepted')
    })

    it('should discard when close if auto-save is off, and unsavedPostAction is discard', async () => {
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            closeable: true,
          },
        }),
      )
      const store = useMergedConfigStore()
      store.mergedConfig = {
        autoSaveDraft: false,
        unsavedPostAction: 'discard',
      }
      expect(useDraftsStore().draftsCount).to.equal(0)
      const textarea = wrapper.get('textarea')
      await textarea.setValue('mew mew')
      wrapper.vm.requestClose()
      await waitForEvent(wrapper, 'close-accepted')
      expect(useDraftsStore().draftsCount).to.equal(0)
    })

    it('should confirm when close if auto-save is off, and unsavedPostAction is confirm', async () => {
      const store = useMergedConfigStore()
      const wrapper = mount(
        PostStatusForm,
        mountOpts({
          props: {
            closeable: true,
          },
        }),
      )
      store.mergedConfig = {
        autoSaveDraft: false,
        unsavedPostAction: 'confirm',
      }
      expect(useDraftsStore().draftsCount).to.equal(0)
      const textarea = wrapper.get('textarea')
      await textarea.setValue('mew mew')
      wrapper.vm.requestClose()
      await nextTick()
      await flushPromises()
      const saveButton = await vi.waitFor(() => {
        const button = wrapper.findByText(
          'button',
          $t('post_status.close_confirm_save_button'),
        )
        if (!button) throw new Error('Save button not present')
        return button
      })
      expect(saveButton).to.be.ok
      await saveButton.trigger('click')
      console.info('clicked')
      expect(useDraftsStore().draftsCount).to.equal(1)
      await flushPromises()
      await waitForEvent(wrapper, 'close-accepted')
    })
  })

  describe('Draft lifecycle', () => {
    const editProps = (statusText) => ({
      statusId: 'edited-status',
      statusText,
      statusSubject: '',
      statusIsSensitive: false,
      statusFiles: [],
      statusVisibility: 'public',
      statusContentType: 'text/plain',
    })

    // Everything but the text and the ids, to build drafts by hand
    const draftFields = {
      mentions: '',
      spoilerText: '',
      quote: null,
      files: [],
      poll: null,
      mediaDescriptions: {},
      nsfw: false,
      visibility: 'public',
      contentType: 'text/plain',
    }

    const mountEditForm = (
      statusText,
      postHandler = vi.fn(() => Promise.resolve({})),
    ) =>
      mount(
        PostStatusForm,
        mountOpts({ props: { ...editProps(statusText), postHandler } }),
      )

    const typeAndWaitForAutoSave = async (wrapper, text) => {
      await wrapper.get('textarea').setValue(text)
      await vi.advanceTimersByTimeAsync(waitSaveTime)
    }

    const post = async (wrapper) => {
      await wrapper.vm.postStatus()
      await flushPromises()
    }

    const setAutoSave = (autoSaveDraft) => {
      useMergedConfigStore().mergedConfig = {
        ...useMergedConfigStore().mergedConfig,
        autoSaveDraft,
      }
    }

    beforeEach(() => {
      setActivePinia(createTestingPinia({ stubActions: false }))
      useUsersStore().currentUser = currentUser
      setAutoSave(true)

      // Drafts are persisted through the storage, we only care about the store here
      vi.spyOn(storage, 'setItem').mockImplementation(() => ({}))
      vi.spyOn(storage, 'getItem').mockImplementation(() => ({}))
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('keeps updating one draft while a status is being edited', async () => {
      const wrapper = mountEditForm('v1')

      await typeAndWaitForAutoSave(wrapper, 'v2')
      // Leave the form open for a while, it must not start piling up drafts
      await vi.advanceTimersByTimeAsync(waitSaveTime * 5)

      expect(useDraftsStore().draftsCount).to.equal(1)
      expect(useDraftsStore().draftsArray[0]).to.include({
        type: 'edit',
        refId: 'edited-status',
        status: 'v2',
      })
    })

    it('removes the auto-saved draft once the edit is posted', async () => {
      const postHandler = vi.fn(() => Promise.resolve({}))
      const wrapper = mountEditForm('v1', postHandler)

      await typeAndWaitForAutoSave(wrapper, 'v2')
      expect(useDraftsStore().draftsCount).to.equal(1)

      await post(wrapper)

      expect(postHandler).to.have.been.calledOnce
      expect(useDraftsStore().draftsCount).to.equal(0)
    })

    it('removes the auto-saved draft once a new status is posted', async () => {
      const postHandler = vi.fn(() => Promise.resolve({}))
      const wrapper = mount(
        PostStatusForm,
        mountOpts({ props: { postHandler } }),
      )

      await typeAndWaitForAutoSave(wrapper, 'hello')
      expect(useDraftsStore().draftsCount).to.equal(1)

      await post(wrapper)

      expect(postHandler).to.have.been.calledOnce
      expect(useDraftsStore().draftsCount).to.equal(0)
    })

    it('removes the auto-saved draft once a reply is posted', async () => {
      const postHandler = vi.fn(() => Promise.resolve({}))
      const wrapper = mount(
        PostStatusForm,
        mountOpts({ props: { repliedStatus, postHandler } }),
      )

      await typeAndWaitForAutoSave(wrapper, '@replied hello')
      expect(useDraftsStore().draftsCount).to.equal(1)

      await post(wrapper)

      expect(postHandler).to.have.been.calledOnce
      expect(useDraftsStore().draftsCount).to.equal(0)
    })

    it('starts every next edit from the current text, not from the first version', async () => {
      // First edit, v1 -> v2 (the form is unmounted once the modal closes)
      const first = mountEditForm('v1')
      await typeAndWaitForAutoSave(first, 'v1, work in progress')
      await typeAndWaitForAutoSave(first, 'v2')
      await post(first)
      first.unmount()
      await flushPromises()

      // Second edit, the backend hands us v2 as the current source
      const second = mountEditForm('v2')
      expect(second.vm.newStatus.status).to.equal('v2')
      await typeAndWaitForAutoSave(second, 'v3')
      await post(second)
      second.unmount()
      await flushPromises()

      // And so on
      const third = mountEditForm('v3')
      expect(third.vm.newStatus.status).to.equal('v3')
      expect(useDraftsStore().draftsCount).to.equal(0)
    })

    it('continues and then removes a draft it restored when the form was reopened', async () => {
      const first = mountEditForm('v1')
      await typeAndWaitForAutoSave(first, 'v1, half written')
      first.unmount()
      await flushPromises()
      expect(useDraftsStore().draftsCount).to.equal(1)

      const second = mountEditForm('v1')
      // Restoring unfinished work is what drafts are for
      expect(second.vm.newStatus.status).to.equal('v1, half written')
      await typeAndWaitForAutoSave(second, 'v2')
      expect(useDraftsStore().draftsCount).to.equal(1)
      expect(useDraftsStore().draftsArray[0].status).to.equal('v2')

      await post(second)
      expect(useDraftsStore().draftsCount).to.equal(0)
    })

    it('restores the latest of several leftover drafts and drops them all once the edit is posted', async () => {
      const store = useDraftsStore()
      const edit = (id, refId, status) =>
        store.addOrSaveDraft({
          ...draftFields,
          id,
          type: 'edit',
          refId,
          status,
        })
      await edit('leftover-1', 'edited-status', 'oldest')
      await edit('leftover-2', 'edited-status', 'newest')
      await edit('other-edit', 'another-status', 'not related')
      await store.addOrSaveDraft({
        ...draftFields,
        id: 'a-reply',
        type: 'reply',
        refId: 'edited-status',
        status: 'not related either',
      })

      const wrapper = mountEditForm('current')
      expect(wrapper.vm.newStatus.status).to.equal('newest')

      await post(wrapper)

      expect(store.draftsArray.map((draft) => draft.id)).to.have.members([
        'other-edit',
        'a-reply',
      ])
    })

    it('does not overwrite a draft that was saved earlier with the next post of the same form', async () => {
      setAutoSave(false)
      const wrapper = mount(PostStatusForm, mountOpts())

      await wrapper.get('textarea').setValue('first')
      await wrapper.vm.saveDraft()
      // Draft IDs are timestamps, so let some time pass like it would for a user
      await vi.advanceTimersByTimeAsync(1000)
      await wrapper.get('textarea').setValue('second')
      await wrapper.vm.saveDraft()

      expect(
        useDraftsStore().draftsArray.map((draft) => draft.status),
      ).to.have.members(['first', 'second'])
    })

    describe('when opened from the drafts page', () => {
      beforeEach(async () => {
        await useDraftsStore().addOrSaveDraft({
          ...draftFields,
          id: 'draft-1',
          type: 'new',
          status: 'old text',
        })
      })

      const mountDraft = (postHandler = vi.fn(() => Promise.resolve({}))) =>
        mount(
          PostStatusForm,
          mountOpts({
            props: { draftId: 'draft-1', hideDraft: true, postHandler },
          }),
        )

      it('updates that draft in place', async () => {
        const wrapper = mountDraft()
        expect(wrapper.vm.newStatus.status).to.equal('old text')

        await typeAndWaitForAutoSave(wrapper, 'new text')
        await wrapper.vm.saveDraft()

        expect(useDraftsStore().draftsCount).to.equal(1)
        expect(useDraftsStore().drafts.get('draft-1').status).to.equal(
          'new text',
        )
      })

      it('removes that draft once it is posted', async () => {
        const wrapper = mountDraft()

        await post(wrapper)

        expect(useDraftsStore().draftsCount).to.equal(0)
      })
    })
  })
})
