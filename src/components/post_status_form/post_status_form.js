import {
  debounce,
  isEqual,
  unescape as ldUnescape,
  reject,
  uniqBy,
} from 'lodash-es'
import { mapActions, mapState } from 'pinia'
import { defineAsyncComponent } from 'vue'

import Attachment from 'src/components/attachment/attachment.vue'
import Checkbox from 'src/components/checkbox/checkbox.vue'
import DraftCloser from 'src/components/draft_closer/draft_closer.vue'
import EmojiInput from 'src/components/emoji_input/emoji_input.vue'
import { suggest } from 'src/components/emoji_input/suggestor.js'
import Gallery from 'src/components/gallery/gallery.vue'
import MediaUpload from 'src/components/media_upload/media_upload.vue'
import Popover from 'src/components/popover/popover.vue'
import ScopeSelector from 'src/components/scope_selector/scope_selector.vue'
import Select from 'src/components/select/select.vue'
import StatusContent from 'src/components/status_content/status_content.vue'
import { propsToNative } from '../../services/attributes_helper/attributes_helper.service.js'
import { findOffset } from '../../services/offset_finder/offset_finder.service.js'
import genRandomSeed from '../../services/random_seed/random_seed.service.js'
import statusPoster from '../../services/status_poster/status_poster.service.js'

import { useDraftsStore } from 'src/stores/drafts.js'
import { useEmojiStore } from 'src/stores/emoji.js'
import { useInstanceStore } from 'src/stores/instance.js'
import { useInstanceCapabilitiesStore } from 'src/stores/instance_capabilities.js'
import { useInterfaceStore } from 'src/stores/interface.js'
import { useMediaViewerStore } from 'src/stores/media_viewer.js'
import { useMergedConfigStore } from 'src/stores/merged_config.js'
import { useSyncConfigStore } from 'src/stores/sync_config.js'
import { useUsersStore } from 'src/stores/users.js'

import { pollFormToMasto } from 'src/services/poll/poll.service.js'

import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faBan,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleNotch,
  faPollH,
  faQuoteRight,
  faSmileBeam,
  faTimes,
  faUpload,
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faSmileBeam,
  faPollH,
  faUpload,
  faQuoteRight,
  faBan,
  faTimes,
  faCircleNotch,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
)

// Converts a string with px to a number like '2px' -> 2
const pxStringToNumber = (str) => {
  return Number(str.substring(0, str.length - 2))
}

const PostStatusForm = {
  props: {
    // Status editing stuff
    statusId: String,
    statusText: String,
    statusSubject: String,
    statusIsSensitive: {
      type: Boolean,
      required: false,
      default: null, // Avoiding automatic conversion null -> false
    },
    statusPoll: Object,
    statusQuote: Object,
    statusFiles: Array,
    statusMediaDescriptions: Object,
    statusVisibility: String,
    statusContentType: String,

    // Replies/mentions
    repliedStatus: Object, // Object of a status replying to
    profileMention: Object, // Mentioned user (used in profile page -> mention)

    // Draft stuff
    hideDraft: Boolean, // Disable drafts functionality
    closeable: Boolean, // Whether form can be closed (i.e. in replies)
    draftId: String, // ID of the draft to be used

    // Chats stuff
    chatView: Boolean, // Used for the "submit on enter" user setting
    maxHeight: Number,
    placeholder: String,
    postHandler: Function, // Used to override poster to use chats one instead of status one
    preserveFocus: Boolean, // Keep focus on form after posting
    autoFocus: Boolean, // Steal focus when form is opened
    fileLimit: Number, // Chats only support 1 attachment :(
    emojiPickerPlacement: String,
    optimisticPosting: Boolean, // Don't wait for confirmation that post is done

    // Feature toggles for special cases (mostly chats)
    mentionsLine: Boolean, // Use separate field for specifying mentions
    mentionsLineReadOnly: Boolean, // Make the said field read-only (for chat conversation view)
    disableSubject: Boolean,
    disableScopeSelector: Boolean,
    disableVisibilitySelector: Boolean,
    disableNotice: Boolean,
    disableLockWarning: Boolean,
    disablePolls: Boolean,
    disableQuotes: Boolean,
    disableSensitivityCheckbox: Boolean,
    disableSubmit: Boolean,
    disablePreview: Boolean,
    disableDraft: Boolean,
  },
  emits: [
    'posted',
    'draft-done',
    'resize',
    'mediaplay',
    'mediapause',
    'close-accepted',
    'update',
  ],
  data() {
    return {
      initialized: false,
      randomSeed: genRandomSeed(),
      // Posting stuff
      idempotencyKey: '',
      /* Data is initialized first, but we have no access to .computed yet
       * which we need for some defaults (i.e. user configration)
       * so we pre-fill with stuff meant for status editing and later
       * back-fill with defaults in .created()
       */
      newStatus: {
        status: this.statusText ?? null,
        mentions: this.statusMentionLine ?? null,
        spoilerText: this.statusSubject ?? null,
        quote: this.statusQuote ?? null,
        files: this.statusFiles ?? null,
        poll: this.statusPoll ?? null,
        mediaDescriptions: this.statusMediaDescriptions ?? null,
        nsfw: this.statusIsSensitive ?? null,
        visibility: this.statusVisibility ?? null,
        contentType: this.statusContentType ?? null,
      },

      // Attachments
      dropFiles: [],
      uploadingFiles: false,
      showDropIcon: 'hide',
      dropStopTimeout: null,

      // Preview
      preview: null,
      previewLoading: false,

      // Draft
      saveInhibited: true,
      saveable: false,

      // Misc States
      emojiInputShown: false,
      error: null,
      posting: false,
    }
  },
  components: {
    MediaUpload,
    EmojiInput,
    PollForm: defineAsyncComponent(
      () => import('src/components/poll/poll_form.vue'),
    ),
    QuoteForm: defineAsyncComponent(
      () => import('src/components/quote/quote_form.vue'),
    ),
    ScopeSelector,
    Checkbox,
    Select,
    Attachment,
    StatusContent,
    Gallery,
    DraftCloser,
    Popover,
  },
  created() {
    this.updateIdempotencyKey()

    // If we are starting a new post, do not associate it with old drafts
    const draft =
      !this.disableDraft && (this.draftId || this.statusType !== 'new')
        ? this.getDraft(this.statusType, this.refId)
        : null

    if (draft) {
      // Copying and overriding defaults from the draft for each field
      Object.keys(this.newStatus).forEach((key) => {
        this.newStatus[key] = draft[key] ?? this.newStatus[key]
      })
      // From now on this form continues that draft: saving updates it,
      // posting or discarding gets rid of it
      this.newStatus.id = draft.id
    } else {
      Object.entries(this.defaultNewStatus).forEach(([key, value]) => {
        this.newStatus[key] = this.newStatus[key] ?? value
      })
    }

    this.initialized = true
  },
  mounted() {
    this.resize(this.$refs.textarea)

    if (this.repliedStatus) {
      const textLength = this.$refs.textarea.value.length
      this.$refs.textarea.setSelectionRange(textLength, textLength)
    }

    if (this.repliedStatus || this.autoFocus) {
      this.$refs.textarea.focus()
    }
  },
  computed: {
    // Visibility / expansion state of subcomponents
    pollFormVisible() {
      return this.hasPoll
    },
    quoteFormVisible() {
      return this.hasQuote && !this.newStatus.quote.thread
    },
    showPreview() {
      return !this.disablePreview && (!!this.preview || this.previewLoading)
    },

    // Composing stuff
    statusType() {
      if (this.repliedStatus) {
        return 'reply'
      } else if (this.profileMention) {
        return 'mention'
      } else if (this.statusId) {
        return 'edit'
      } else {
        return 'new'
      }
    },
    refId() {
      if (this.repliedStatus) {
        return this.repliedStatus.id
      } else if (this.profileMention) {
        return this.profileMention.id
      } else if (this.statusId) {
        return this.statusId
      } else {
        return null
      }
    },
    mentionsString() {
      if (this.statusType !== 'reply' && this.statusType !== 'mention')
        return ''
      let allAttentions = [...(this.repliedStatus?.attentions || [])]
      const repliedUser = this.repliedStatus?.user || this.profileMention

      if (repliedUser) allAttentions.unshift(repliedUser)

      allAttentions = uniqBy(allAttentions, 'id')
      allAttentions = reject(allAttentions, { id: this.currentUser.id })

      const mentions = allAttentions.map(
        (attention) => `@${attention.screen_name}`,
      )

      return mentions.length > 0 ? mentions.join(' ') + ' ' : ''
    },
    newStatusContent() {
      return this.mentionsLine
        ? this.mentionsString + this.newStatus.status
        : this.newStatus.status
    },
    defaultNewStatus() {
      const defaultNewStatus = {
        files: [],
        poll: null,
        quote: null,
        mediaDescriptions: {},
      }

      const scope = (() => {
        if (this.repliedStatus) {
          if (this.repliedStatus.visibility === 'direct') return 'direct'
          if (this.userDefaultScopeCopy) return this.repliedStatus.visibility
        }
        return this.userDefaultScope
      })()

      const preset = this.$route.query.message
      const statusText = preset ?? ''

      if (this.mentionsLine) {
        defaultNewStatus.status = statusText
      } else {
        defaultNewStatus.status = this.mentionsString + statusText
      }

      defaultNewStatus.mentions = this.mentionsString.trim()
      defaultNewStatus.spoilerText = this.repliedSubjectString ?? ''
      defaultNewStatus.nsfw = this.userDefaultSensitive
      defaultNewStatus.visibility = scope
      defaultNewStatus.contentType = this.userDefaultPostContentType

      return defaultNewStatus
    },
    // -Edit
    isEdit() {
      return this.statusId !== undefined && this.statusId.trim() !== ''
    },
    // -Reply
    isReply() {
      return this.statusType === 'reply'
    },
    inReplyToStatusId() {
      return !this.hasQuote ||
        !this.newStatus.quote.thread ||
        !this.newStatus.quote.id
        ? this.repliedStatus?.id
        : undefined
    },
    repliedSubjectString() {
      if (!this.repliedStatus?.summary) return null
      const decodedSummary = ldUnescape(this.repliedStatus.summary)
      const behavior = this.mergedConfig.subjectLineBehavior
      const startsWithRe = decodedSummary.match(/^re[: ]/i)
      if ((behavior !== 'noop' && startsWithRe) || behavior === 'masto') {
        return decodedSummary
      } else if (behavior === 'email') {
        return 're: '.concat(decodedSummary)
      } else if (behavior === 'noop') {
        return ''
      }
    },
    // -Poll
    hasPoll() {
      return this.newStatus.poll != null
    },
    // -Quotes
    hasQuote() {
      return this.newStatus.quote !== null
    },
    quotable() {
      if (!this.quotingAvailable || !this.isReply) {
        return false
      }

      if (
        this.repliedStatus.visibility === 'public' ||
        this.repliedStatus.visibility === 'unlisted' ||
        this.repliedStatus.visibility === 'local'
      ) {
        return true
      } else if (this.repliedStatus.visibility === 'private') {
        return this.repliedStatus.user.id === this.currentUser.id
      }

      return false
    },
    quoteId() {
      return this.newStatus.quote?.id ?? null
    },
    // This is for "reply/quote" toggle
    quoteThreadToggled: {
      get() {
        return this.newStatus.quote?.thread
      },
      set(value) {
        if (value) {
          this.newStatus.quote = {}
          this.newStatus.quote.thread = true
          this.newStatus.quote.id = this.repliedStatus.id
        } else {
          this.newStatus.quote = null
        }
      },
    },
    postingOptions() {
      const poll = this.hasPoll ? pollFormToMasto(this.newStatus.poll) : null

      return {
        status: this.newStatusContent,
        spoilerText: this.newStatus.spoilerText,
        visibility: this.newStatus.visibility,
        sensitive: this.newStatus.nsfw,
        media: this.newStatus.files,
        inReplyToStatusId: this.inReplyToStatusId,
        quoteId: this.quoteId,
        contentType: this.newStatus.contentType,
        poll,
        idempotencyKey: this.idempotencyKey,
      }
    },

    // Emoji stuff
    emojiUserSuggestor() {
      return suggest({
        emoji: [
          ...useEmojiStore().standardEmojiList,
          ...useEmojiStore().customEmoji,
        ],
      })
    },
    emojiSuggestor() {
      return suggest({
        emoji: [
          ...useEmojiStore().standardEmojiList,
          ...useEmojiStore().customEmoji,
        ],
      })
    },
    emoji() {
      return useEmojiStore().standardEmojiList
    },
    customEmoji() {
      return useEmojiStore().customEmoji
    },

    // Length & Limits
    statusLength() {
      return this.newStatusContent.length
    },
    spoilerTextLength() {
      return this.newStatus.spoilerText.length
    },
    statusLengthLimit() {
      return useInstanceStore().limits.textLimit
    },
    hasStatusLengthLimit() {
      return this.statusLengthLimit > 0
    },
    charactersLeft() {
      return (
        this.statusLengthLimit - (this.statusLength + this.spoilerTextLength)
      )
    },
    isOverLengthLimit() {
      return this.hasStatusLengthLimit && this.charactersLeft < 0
    },
    isEmptyStatus() {
      return (
        this.newStatus.status.trim() === '' && this.newStatus.files.length === 0
      )
    },
    uploadFileLimitReached() {
      return this.newStatus.files.length >= this.fileLimit
    },

    // Drafts
    isDirty() {
      return Object.entries(this.defaultNewStatus).some(
        ([key, defaultValue]) => {
          const actualValue = this.newStatus[key]
          if (actualValue === null) return false
          return !isEqual(actualValue, defaultValue)
        },
      )
    },
    shouldAutoSaveDraft() {
      return useMergedConfigStore().mergedConfig.autoSaveDraft
    },
    debouncedMaybeAutoSaveDraft() {
      return debounce(this.maybeAutoSaveDraft, 3000)
    },
    autoSaveState() {
      if (this.saveable) {
        return this.$t('post_status.auto_save_saving')
      } else if (this.newStatus.id) {
        return this.$t('post_status.auto_save_saved')
      } else {
        return this.$t('post_status.auto_save_nothing_new')
      }
    },
    safeToSaveDraft() {
      return (
        (this.newStatus.status ||
          this.newStatus.spoilerText ||
          this.newStatus.files.length ||
          this.hasPoll ||
          this.hasQuote) &&
        this.saveable
      )
    },
    hasEmptyDraft() {
      return (
        this.newStatus.id &&
        !(
          this.newStatus.status ||
          this.newStatus.spoilerText ||
          this.newStatus.files.length ||
          this.hasPoll ||
          this.hasQuote
        )
      )
    },

    // Error handling
    pollContentError() {
      return this.pollFormVisible && this.newStatus.poll?.error
    },

    // Featureset detection
    postFormats() {
      return useInstanceCapabilitiesStore().postFormats || []
    },
    safeDMEnabled() {
      return useInstanceCapabilitiesStore().safeDM
    },
    pollsAvailable() {
      return (
        useInstanceCapabilitiesStore().pollsAvailable &&
        useInstanceStore().limits.pollLimits.max_options >= 2 &&
        this.disablePolls !== true
      )
    },
    hideExtraActions() {
      return this.disableDraft || this.hideDraft
    },
    quotingAvailable() {
      if (!useInstanceCapabilitiesStore().quotingAvailable) {
        return false
      }

      return this.disableQuotes !== true
    },

    // User configuration
    userDefaultScope() {
      return this.currentUser.default_scope
    },
    userDefaultPostContentType() {
      return this.mergedConfig.postContentType
    },
    userDefaultScopeCopy() {
      return this.mergedConfig.scopeCopy
    },
    userDefaultSensitive() {
      return this.mergedConfig.sensitiveByDefault
    },
    showAllScopes() {
      return !this.mergedConfig.minimalScopesMode
    },
    minimalScopesMode() {
      return this.mergedConfig.minimalScopesMode
    },
    alwaysShowSubject() {
      return this.mergedConfig.alwaysShowSubjectInput
    },
    hideScopeNotice() {
      return (
        this.disableNotice ||
        useMergedConfigStore().mergedConfig.hideScopeNotice
      )
    },
    submitOnEnter() {
      return this.chatView && this.mergedConfig.chatSubmitOnEnter
    },

    // Global stuff
    ...mapState(useUsersStore, ['currentUser']),
    ...mapState(useMergedConfigStore, ['mergedConfig']),
    ...mapState(useInterfaceStore, {
      mobileLayout: (state) => state.mobileLayout,
    }),
  },
  watch: {
    newStatus: {
      deep: true,
      handler() {
        this.statusChanged()
      },
    },
    saveable(val) {
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event#usage_notes
      // MDN says we'd better add the beforeunload event listener only when needed, and remove it when it's no longer needed
      if (val) {
        this.addBeforeUnloadListener()
      } else {
        this.removeBeforeUnloadListener()
      }
    },
  },
  methods: {
    // Composing
    update() {
      Object.entries(this.defaultNewStatus).forEach(([key, value]) => {
        if (key === 'status') return
        this.newStatus[key] = value
      })
    },
    onMentionsLineUpdate(e) {
      if (this.mentionsLineReadOnly) return
      this.newStatus.mentions = e
    },
    changeVis(visibility) {
      this.newStatus.visibility = visibility
    },
    clearStatus() {
      this.saveInhibited = true
      this.newStatus.status = ''
      this.newStatus.mentions = ''
      this.newStatus.spoilerText = ''
      this.newStatus.files = []
      this.newStatus.poll = null
      this.newStatus.quote = null
      this.newStatus.nsfw = this.defaultNewStatus.nsfw
      this.newStatus.mediaDescriptions = {}
      // A blank form doesn't continue any draft anymore
      delete this.newStatus.id
      this.$refs.mediaUpload?.clearFile()
      if (this.preserveFocus) {
        this.$nextTick(() => {
          this.$refs.textarea.focus()
        })
      }
      const el = this.$el.querySelector('textarea')
      el.style.height = 'auto'
      el.style.height = undefined
      this.error = null
      if (this.preview) this.previewStatus()
      this.saveable = false
    },
    async postStatus(event) {
      if (this.posting && !this.optimisticPosting) {
        return
      }
      if (this.disableSubmit) {
        return
      }
      if (this.emojiInputShown) {
        return
      }
      if (this.submitOnEnter) {
        event.stopPropagation()
        event.preventDefault()
      }

      if (
        this.optimisticPosting &&
        (this.isEmptyStatus || this.isOverLengthLimit)
      ) {
        return
      }

      if (this.isEmptyStatus) {
        this.error = this.$t('post_status.empty_status_error')
        return
      }

      if (this.pollContentError) {
        this.error = this.pollContentError
        return
      }

      this.posting = true

      try {
        await this.setAllMediaDescriptions()
      } catch {
        this.error = this.$t('post_status.media_description_error')
        this.posting = false
        return
      }

      const postHandler = this.postHandler
        ? this.postHandler
        : statusPoster.postStatus

      postHandler(this.postingOptions)
        .then((data) => {
          this.abandonPostedDrafts()
          this.clearStatus()
          this.updateIdempotencyKey()
          this.$emit('posted', data)
        })
        .catch((error) => {
          this.error = error
        })
        .finally(() => {
          this.posting = false
        })
    },

    // Preview
    previewStatus() {
      if (this.isEmptyStatus && this.newStatus.spoilerText.trim() === '') {
        this.preview = { error: this.$t('post_status.preview_empty') }
        this.previewLoading = false
        return
      }
      this.previewLoading = true

      statusPoster
        .postStatus({
          ...this.postingOptions,
          media: [],
          poll: null,
          preview: true,
        })
        .then((data) => {
          // Don't apply preview if not loading, because it means
          // user has closed the preview manually.
          if (!this.previewLoading) return
          this.preview = data
        })
        .catch((error) => {
          this.preview = { error }
        })
        .finally(() => {
          this.previewLoading = false
          // If we post right after doing a preview request
          // backend treats non-preview request as preview one
          // and "eats" the post
          this.updateIdempotencyKey()
        })
    },
    debouncePreviewStatus: debounce(function () {
      this.previewStatus()
    }, 500),
    autoPreview() {
      if (!this.preview) return
      this.previewLoading = true
      this.debouncePreviewStatus()
    },
    closePreview() {
      this.preview = null
      this.previewLoading = false
    },
    togglePreview() {
      if (this.showPreview) {
        this.closePreview()
      } else {
        this.previewStatus()
      }
    },

    // Attachments
    setMediaDescription(id) {
      const description = this.newStatus.mediaDescriptions[id]
      if (!description || description.trim() === '') return
      return statusPoster.setMediaDescription({
        id,
        description,
      })
    },
    setAllMediaDescriptions() {
      const ids = this.newStatus.files.map((file) => file.id)
      return Promise.all(ids.map((id) => this.setMediaDescription(id)))
    },
    addMediaFile(fileInfo) {
      this.newStatus.files.push(fileInfo)
      this.$emit('resize', { delayed: true })
    },
    removeMediaFile(fileInfo) {
      const index = this.newStatus.files.indexOf(fileInfo)
      this.newStatus.files.splice(index, 1)
      this.$emit('resize')
    },
    editAttachment(fileInfo, newText) {
      this.newStatus.mediaDescriptions[fileInfo.id] = newText
    },
    shiftUpMediaFile(fileInfo) {
      const { files } = this.newStatus
      const index = this.newStatus.files.indexOf(fileInfo)
      if (index === 0) return
      files.splice(index, 1)
      files.splice(index - 1, 0, fileInfo)
    },
    shiftDnMediaFile(fileInfo) {
      const { files } = this.newStatus
      const index = this.newStatus.files.indexOf(fileInfo)
      if (index === files.length - 1) return
      files.splice(index, 1)
      files.splice(index + 1, 0, fileInfo)
    },
    uploadFailed(errString, templateArgs) {
      templateArgs = templateArgs || {}
      this.error =
        this.$t('upload.error.base') +
        ' ' +
        this.$t('upload.error.' + errString, templateArgs)
    },
    startedUploadingFiles() {
      this.uploadingFiles = true
    },
    finishedUploadingFiles() {
      this.$emit('resize')
      this.uploadingFiles = false
    },
    paste(e) {
      this.autoPreview()
      this.resize(e)
      if (e.clipboardData.files.length > 0) {
        // prevent pasting of file as text
        e.preventDefault()
        // Strangely, files property gets emptied after event propagation
        // Trying to wrap it in array doesn't work. Plus I doubt it's possible
        // to hold more than one file in clipboard.
        this.dropFiles = [e.clipboardData.files[0]]
      }
    },
    fileDrop(e) {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault() // allow dropping text like before
        this.dropFiles = e.dataTransfer.files
        clearTimeout(this.dropStopTimeout)
        this.showDropIcon = 'hide'
      }
    },
    fileDragStop() {
      // The false-setting is done with delay because just using leave-events
      // directly caused unwanted flickering, this is not perfect either but
      // much less noticable.
      clearTimeout(this.dropStopTimeout)
      this.showDropIcon = 'fade'
      this.dropStopTimeout = setTimeout(() => (this.showDropIcon = 'hide'), 500)
    },
    fileDrag(e) {
      e.dataTransfer.dropEffect = this.uploadFileLimitReached ? 'none' : 'copy'
      if (e.dataTransfer?.types.includes('Files')) {
        clearTimeout(this.dropStopTimeout)
        this.showDropIcon = 'show'
      }
    },

    // Auto-sizable input field
    // TODO separate into its own component pls
    onEmojiInputInput() {
      this.$nextTick(() => {
        this.resize(this.$refs.textarea)
      })
    },
    resize(e) {
      const target = e.target || e
      if (!(target instanceof window.Element)) {
        return
      }

      // Reset to default height for empty form, nothing else to do here.
      if (target.value === '') {
        target.style.height = null
        this.$emit('resize')
        return
      }

      const formRef = this.$refs.form
      const bottomRef = this.$refs.bottom
      /* Scroller is either `window` (replies in TL), sidebar (main post form,
       * replies in notifs) or mobile post form. Note that getting and setting
       * scroll is different for `Window` and `Element`s
       */
      const bottomBottomPaddingStr =
        window.getComputedStyle(bottomRef)['padding-bottom']
      const bottomBottomPadding = pxStringToNumber(bottomBottomPaddingStr)

      const scrollerRef =
        this.$el.closest('.column.-scrollable') ||
        this.$el.closest('.post-form-modal-view') ||
        window

      // Getting info about padding we have to account for, removing 'px' part
      const topPaddingStr = window.getComputedStyle(target)['padding-top']
      const bottomPaddingStr = window.getComputedStyle(target)['padding-bottom']
      const topPadding = pxStringToNumber(topPaddingStr)
      const bottomPadding = pxStringToNumber(bottomPaddingStr)
      const vertPadding = topPadding + bottomPadding

      const oldHeight = pxStringToNumber(target.style.height)

      /* Explanation:
       *
       * https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight
       * scrollHeight returns element's scrollable content height, i.e. visible
       * element + overscrolled parts of it. We use it to determine when text
       * inside the textarea exceeded its height, so we can set height to prevent
       * overscroll, i.e. make textarea grow with the text. HOWEVER, since we
       * explicitly set new height, scrollHeight won't go below that, so we can't
       * SHRINK the textarea when there's extra space. To workaround that we set
       * height to 'auto' which makes textarea tiny again, so that scrollHeight
       * will match text height again. HOWEVER, shrinking textarea can screw with
       * the scroll since there might be not enough padding around form-bottom to even
       * warrant a scroll, so it will jump to 0 and refuse to move anywhere,
       * so we check current scroll position before shrinking and then restore it
       * with needed delta.
       */

      // this part has to be BEFORE the content size update
      const currentScroll =
        scrollerRef === window ? scrollerRef.scrollY : scrollerRef.scrollTop
      const scrollerHeight =
        scrollerRef === window
          ? scrollerRef.innerHeight
          : scrollerRef.offsetHeight
      const scrollerBottomBorder = currentScroll + scrollerHeight

      // BEGIN content size update
      target.style.height = 'auto'
      const heightWithoutPadding = Math.floor(target.scrollHeight - vertPadding)
      let newHeight = this.maxHeight
        ? Math.min(heightWithoutPadding, this.maxHeight)
        : heightWithoutPadding
      // This is a bit of a hack to combat target.scrollHeight being different on every other input
      // on some browsers for whatever reason. Don't change the height if difference is 1px or less.
      if (Math.abs(newHeight - oldHeight) <= 1) {
        newHeight = oldHeight
      }
      target.style.height = `${newHeight}px`
      this.$emit('resize', newHeight)
      // END content size update

      // We check where the bottom border of form-bottom element is, this uses findOffset
      // to find offset relative to scrollable container (scroller)
      const bottomBottomBorder =
        bottomRef.offsetHeight +
        findOffset(bottomRef, scrollerRef).top +
        bottomBottomPadding

      const isBottomObstructed = scrollerBottomBorder < bottomBottomBorder
      const isFormBiggerThanScroller = scrollerHeight < formRef.offsetHeight
      const bottomChangeDelta = bottomBottomBorder - scrollerBottomBorder
      // The intention is basically this;
      // Keep form-bottom always visible so that submit button is in view EXCEPT
      // if form element bigger than scroller and caret isn't at the end, so that
      // if you scroll up and edit middle of text you won't get scrolled back to bottom
      const shouldScrollToBottom =
        isBottomObstructed &&
        !(
          isFormBiggerThanScroller &&
          this.$refs.textarea.selectionStart !==
            this.$refs.textarea.value.length
        )
      const totalDelta = shouldScrollToBottom ? bottomChangeDelta : 0
      const targetScroll = Math.round(currentScroll + totalDelta)

      if (scrollerRef === window) {
        scrollerRef.scroll(0, targetScroll)
      } else {
        scrollerRef.scrollTop = targetScroll
      }
    },

    // Poll
    togglePollForm() {
      this.newStatus.poll = this.hasPoll ? null : {}
    },
    setPoll(poll) {
      this.newStatus.poll = poll
    },

    // Quote
    toggleQuoteForm() {
      // This is for the "attach quote" button
      if (this.newStatus.quote?.thread) return
      if (!this.hasQuote) {
        this.newStatus.quote = {}
        this.newStatus.quote.thread = false
        this.newStatus.quote.id = null
        this.newStatus.quote.url = ''
      } else {
        this.newStatus.quote = null
      }
    },

    // Drafts
    statusChanged() {
      this.autoPreview()
      this.updateIdempotencyKey()
      this.debouncedMaybeAutoSaveDraft()
      this.saveable = true
      this.saveInhibited = false
    },
    saveDraft() {
      if (!this.disableDraft && !this.saveInhibited) {
        if (this.safeToSaveDraft) {
          return useDraftsStore()
            .addOrSaveDraft({
              type: this.statusType,
              refId: this.refId,
              ...this.newStatus,
              // Keep updating the draft this form works on (the one it was
              // opened with, restored or saved earlier) rather than creating a
              // new one on every save. Undefined for a fresh status.
              id: this.draftId ?? this.newStatus.id,
            })
            .then((id) => {
              if (this.newStatus.id !== id) {
                this.newStatus.id = id
              }
              this.saveable = false
              if (!this.shouldAutoSaveDraft) {
                this.clearStatus()
                this.updateIdempotencyKey()
                this.$emit('draft-done')
              }
            })
        } else if (this.hasEmptyDraft) {
          // There is a draft, but there is nothing in it, clear it
          return this.abandonDraft().then(() => {
            this.saveable = false
            if (!this.shouldAutoSaveDraft) {
              this.clearStatus()
              this.updateIdempotencyKey()
              this.$emit('draft-done')
            }
          })
        }
      }
      return Promise.resolve()
    },
    maybeAutoSaveDraft() {
      if (this.shouldAutoSaveDraft) {
        this.saveDraft(false)
      }
    },
    abandonDraft() {
      return this.abandonDrafts([this.draftId ?? this.newStatus.id])
    },
    // Once posted, the draft we've been working on is not needed anymore. When
    // it was an edit, neither are the other drafts of editing this status
    // (leftovers of older sessions): they are based on its older versions and
    // would bring those back the next time it is edited.
    abandonPostedDrafts() {
      const ids = [this.draftId ?? this.newStatus.id]
      if (this.statusType === 'edit') {
        useDraftsStore()
          .draftsByTypeAndRefId(this.statusType, this.refId)
          .forEach((draft) => ids.push(draft.id))
      }
      return this.abandonDrafts(ids)
    },
    abandonDrafts(ids) {
      const knownIds = ids.filter((id) => id !== undefined)
      if (knownIds.length === 0) return Promise.resolve()
      return useDraftsStore().abandonDrafts(knownIds)
    },
    getDraft() {
      const maybeDraft = useDraftsStore().drafts.get(this.draftId)
      if (this.draftId && maybeDraft) {
        return maybeDraft
      } else {
        const existingDrafts = useDraftsStore().draftsByTypeAndRefId(
          this.statusType,
          this.refId,
        )

        if (existingDrafts.length) {
          // There should be just one. If there are more, those are leftovers
          // of older sessions and the last one is the latest of them.
          return existingDrafts[existingDrafts.length - 1]
        }
      }
      // No draft available, fall back
    },
    requestClose() {
      if (!this.saveable) {
        this.$emit('close-accepted')
      } else {
        this.$refs.draftCloser.requestClose()
      }
    },
    saveAndCloseDraft() {
      this.saveDraft().then(() => {
        this.$emit('close-accepted')
      })
    },
    discardAndCloseDraft() {
      this.abandonDraft().then(() => {
        this.$emit('close-accepted')
      })
    },
    addBeforeUnloadListener() {
      this._beforeUnloadListener ||= () => {
        this.saveDraft()
      }
      window.addEventListener('beforeunload', this._beforeUnloadListener)
    },
    removeBeforeUnloadListener() {
      if (this._beforeUnloadListener) {
        window.removeEventListener('beforeunload', this._beforeUnloadListener)
      }
    },

    // Misc
    propsToNative(props) {
      return propsToNative(props)
    },
    handleEmojiInputShow(value) {
      this.emojiInputShown = value
    },
    updateIdempotencyKey() {
      this.idempotencyKey = Date.now().toString()
    },
    openProfileTab() {
      useInterfaceStore().openSettingsModalTab('profile')
    },
    dismissScopeNotice() {
      useSyncConfigStore().setSimplePrefAndSave({
        path: 'hideScopeNotice',
        value: true,
      })
    },
    clearError() {
      this.error = null
    },
    ...mapActions(useMediaViewerStore, ['increment']),
  },
  beforeUnmount() {
    this.maybeAutoSaveDraft()
    this.removeBeforeUnloadListener()
  },
}

export default PostStatusForm
