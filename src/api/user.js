import { last } from 'lodash-es'

import { paramsString, promisedRequest } from './helpers.js'
import { fetchFriends, MASTODON_STATUS_URL } from './public.js'

import {
  parseAttachment,
  parseStatus,
  parseUser,
} from 'src/services/entity_normalizer/entity_normalizer.service.js'

const MUTES_IMPORT_URL = '/api/pleroma/mutes_import'
const BLOCKS_IMPORT_URL = '/api/pleroma/blocks_import'
const FOLLOW_IMPORT_URL = '/api/pleroma/follow_import'
const DELETE_ACCOUNT_URL = '/api/pleroma/delete_account'
const CHANGE_EMAIL_URL = '/api/pleroma/change_email'
const CHANGE_PASSWORD_URL = '/api/pleroma/change_password'
const MOVE_ACCOUNT_URL = '/api/pleroma/move_account'
const ALIASES_URL = '/api/pleroma/aliases'
const NOTIFICATION_SETTINGS_URL = ({
  blockFromStrangers,
  hideNotificationContents,
}) =>
  `/api/pleroma/notification_settings${paramsString({ blockFromStrangers, hideNotificationContents })}`
export const NOTIFICATION_READ_URL = '/api/v1/pleroma/notifications/read'

const MFA_SETTINGS_URL = '/api/pleroma/accounts/mfa'
const MFA_BACKUP_CODES_URL = '/api/pleroma/accounts/mfa/backup_codes'

const MFA_SETUP_OTP_URL = '/api/pleroma/accounts/mfa/setup/totp'
const MFA_CONFIRM_OTP_URL = '/api/pleroma/accounts/mfa/confirm/totp'
const MFA_DISABLE_OTP_URL = '/api/pleroma/accounts/mfa/totp'

export const MASTODON_DISMISS_NOTIFICATION_URL = (id) =>
  `/api/v1/notifications/${id}/dismiss`
export const MASTODON_FAVORITE_URL = (id) => `/api/v1/statuses/${id}/favourite`
export const MASTODON_UNFAVORITE_URL = (id) =>
  `/api/v1/statuses/${id}/unfavourite`
export const MASTODON_RETWEET_URL = (id) => `/api/v1/statuses/${id}/reblog`
export const MASTODON_UNRETWEET_URL = (id) => `/api/v1/statuses/${id}/unreblog`
export const MASTODON_DELETE_URL = (id) => `/api/v1/statuses/${id}`
export const MASTODON_FOLLOW_URL = (id) => `/api/v1/accounts/${id}/follow`
export const MASTODON_UNFOLLOW_URL = (id) => `/api/v1/accounts/${id}/unfollow`

const MASTODON_FOLLOW_REQUESTS_URL = '/api/v1/follow_requests'
export const MASTODON_APPROVE_USER_URL = (id) =>
  `/api/v1/follow_requests/${id}/authorize`
export const MASTODON_DENY_USER_URL = (id) =>
  `/api/v1/follow_requests/${id}/reject`
const MASTODON_USER_RELATIONSHIPS_URL = ({ id, withSuspended }) =>
  `/api/v1/accounts/relationships/${paramsString({ id, withSuspended })}`
export const MASTODON_USER_IN_LISTS = (id) => `/api/v1/accounts/${id}/lists`
export const MASTODON_LIST_URL = (id = '') => `/api/v1/lists/${id}`
export const MASTODON_LIST_ACCOUNTS_URL = (id) => `/api/v1/lists/${id}/accounts`
export const MASTODON_USER_BLOCKS_URL = ({
  maxId,
  sinceId,
  limit,
  withRelationships,
}) =>
  `/api/v1/blocks/${paramsString({ maxId, sinceId, limit, withRelationships })}`
export const MASTODON_USER_MUTES_URL = ({
  maxId,
  sinceId,
  limit,
  withRelationships,
}) =>
  `/api/v1/mutes/${paramsString({ maxId, sinceId, limit, withRelationships })}`
export const MASTODON_BLOCK_USER_URL = (id) => `/api/v1/accounts/${id}/block`
export const MASTODON_UNBLOCK_USER_URL = (id) =>
  `/api/v1/accounts/${id}/unblock`
export const MASTODON_MUTE_USER_URL = (id) => `/api/v1/accounts/${id}/mute`
export const MASTODON_UNMUTE_USER_URL = (id) => `/api/v1/accounts/${id}/unmute`
export const MASTODON_REMOVE_USER_FROM_FOLLOWERS_URL = (id) =>
  `/api/v1/accounts/${id}/remove_from_followers`
export const MASTODON_USER_NOTE_URL = (id) => `/api/v1/accounts/${id}/note`
export const MASTODON_BOOKMARK_STATUS_URL = (id) =>
  `/api/v1/statuses/${id}/bookmark`
export const MASTODON_UNBOOKMARK_STATUS_URL = (id) =>
  `/api/v1/statuses/${id}/unbookmark`
const MASTODON_POST_STATUS_URL = '/api/v1/statuses'
const MASTODON_MEDIA_UPLOAD_URL = '/api/v1/media'
const MASTODON_VOTE_URL = (id) => `/api/v1/polls/${id}/votes`
const MASTODON_PROFILE_UPDATE_URL = '/api/v1/accounts/update_credentials'
const MASTODON_REPORT_USER_URL = '/api/v1/reports'
export const MASTODON_PIN_OWN_STATUS_URL = (id) => `/api/v1/statuses/${id}/pin`
export const MASTODON_UNPIN_OWN_STATUS_URL = (id) =>
  `/api/v1/statuses/${id}/unpin`
export const MASTODON_MUTE_CONVERSATION_URL = (id) =>
  `/api/v1/statuses/${id}/mute`
export const MASTODON_UNMUTE_CONVERSATION_URL = (id) =>
  `/api/v1/statuses/${id}/unmute`
export const MASTODON_DOMAIN_BLOCKS_URL = '/api/v1/domain_blocks'
const MASTODON_ANNOUNCEMENTS_URL = '/api/v1/announcements'
const MASTODON_ANNOUNCEMENTS_DISMISS_URL = (id) =>
  `/api/v1/announcements/${id}/dismiss`
// The emoji is a part of the path. Keycap number sign starts with a plain #,
// which would be taken for the start of the fragment and cut the path short
export const PLEROMA_EMOJI_REACT_URL = (id, emoji) =>
  `/api/v1/pleroma/statuses/${id}/reactions/${encodeURIComponent(emoji)}`
export const PLEROMA_EMOJI_UNREACT_URL = (id, emoji) =>
  `/api/v1/pleroma/statuses/${id}/reactions/${encodeURIComponent(emoji)}`
const PLEROMA_BACKUP_URL = '/api/v1/pleroma/backups'
const PLEROMA_BOOKMARK_FOLDERS_URL = '/api/v1/pleroma/bookmark_folders'
const PLEROMA_BOOKMARK_FOLDER_URL = (id) =>
  `/api/v1/pleroma/bookmark_folders/${id}`

// #Posts
export const favorite = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_FAVORITE_URL(id),
    method: 'POST',
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const unfavorite = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_UNFAVORITE_URL(id),
    method: 'POST',
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const retweet = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_RETWEET_URL(id),
    method: 'POST',
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const unretweet = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_UNRETWEET_URL(id),
    method: 'POST',
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const reactWithEmoji = ({ id, emoji, credentials }) =>
  promisedRequest({
    url: PLEROMA_EMOJI_REACT_URL(id, emoji),
    method: 'PUT',
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const unreactWithEmoji = ({ id, emoji, credentials }) =>
  promisedRequest({
    url: PLEROMA_EMOJI_UNREACT_URL(id, emoji),
    method: 'DELETE',
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const bookmarkStatus = ({ id, credentials, ...options }) =>
  promisedRequest({
    url: MASTODON_BOOKMARK_STATUS_URL(id),
    credentials,
    method: 'POST',
    payload: {
      folder_id: options.folder_id,
    },
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const unbookmarkStatus = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_UNBOOKMARK_STATUS_URL(id),
    credentials,
    method: 'POST',
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const pinOwnStatus = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_PIN_OWN_STATUS_URL(id),
    credentials,
    method: 'POST',
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const unpinOwnStatus = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_UNPIN_OWN_STATUS_URL(id),
    credentials,
    method: 'POST',
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const muteConversation = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_MUTE_CONVERSATION_URL(id),
    credentials,
    method: 'POST',
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const unmuteConversation = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_UNMUTE_CONVERSATION_URL(id),
    credentials,
    method: 'POST',
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))

export const vote = ({ pollId, choices, credentials }) => {
  return promisedRequest({
    url: MASTODON_VOTE_URL(encodeURIComponent(pollId)),
    method: 'POST',
    credentials,
    payload: {
      choices,
    },
  })
}

// #Posting
export const postStatus = ({
  credentials,
  status,
  spoilerText,
  visibility,
  sensitive,
  poll,
  mediaIds = [],
  inReplyToStatusId,
  quoteId,
  contentType,
  preview,
  idempotencyKey,
}) => {
  const form = new FormData()
  const pollOptions = poll?.options || []

  form.append('status', status)
  form.append('source', 'Pleroma FE')
  if (spoilerText) form.append('spoiler_text', spoilerText)
  if (visibility) form.append('visibility', visibility)
  if (sensitive) form.append('sensitive', sensitive)
  if (contentType) form.append('content_type', contentType)
  mediaIds.forEach((val) => {
    form.append('media_ids[]', val)
  })
  if (pollOptions.some((option) => option !== '')) {
    const normalizedPoll = {
      expires_in: Number.parseInt(poll.expiresIn, 10),
      multiple: poll.multiple,
    }
    Object.keys(normalizedPoll).forEach((key) => {
      form.append(`poll[${key}]`, normalizedPoll[key])
    })

    pollOptions.forEach((option) => {
      form.append('poll[options][]', option)
    })
  }
  if (inReplyToStatusId) {
    form.append('in_reply_to_id', inReplyToStatusId)
  }
  if (quoteId) {
    form.append('quote_id', quoteId)
  }
  if (preview) {
    form.append('preview', 'true')
  }

  const headers = {}
  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey
  }

  return promisedRequest({
    url: MASTODON_POST_STATUS_URL,
    formData: form,
    method: 'POST',
    credentials,
    headers,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))
}

export const editStatus = ({
  id,
  credentials,
  status,
  spoilerText,
  sensitive,
  poll,
  mediaIds = [],
  contentType,
}) => {
  const form = new FormData()
  const pollOptions = poll?.options || []

  form.append('status', status)
  if (spoilerText) form.append('spoiler_text', spoilerText)
  if (sensitive) form.append('sensitive', sensitive)
  if (contentType) form.append('content_type', contentType)
  mediaIds.forEach((val) => {
    form.append('media_ids[]', val)
  })

  if (pollOptions.some((option) => option !== '')) {
    const normalizedPoll = {
      expires_in: Number.parseInt(poll.expiresIn, 10),
      multiple: poll.multiple,
    }
    Object.keys(normalizedPoll).forEach((key) => {
      form.append(`poll[${key}]`, normalizedPoll[key])
    })

    pollOptions.forEach((option) => {
      form.append('poll[options][]', option)
    })
  }

  return promisedRequest({
    url: MASTODON_STATUS_URL(id),
    formData: form,
    method: 'PUT',
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseStatus(data) }))
}

export const deleteStatus = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_DELETE_URL(id),
    credentials,
    method: 'DELETE',
  })

export const uploadMedia = ({ formData, credentials }) =>
  promisedRequest({
    url: MASTODON_MEDIA_UPLOAD_URL,
    formData,
    method: 'POST',
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseAttachment(data) }))

export const setMediaDescription = ({ id, description, credentials }) =>
  promisedRequest({
    url: `${MASTODON_MEDIA_UPLOAD_URL}/${id}`,
    method: 'PUT',
    credentials,
    payload: {
      description,
    },
  }).then(({ data, ...rest }) => ({ ...rest, data: parseAttachment(data) }))

// #Notifications
export const dismissNotification = ({ credentials, id }) =>
  promisedRequest({
    url: MASTODON_DISMISS_NOTIFICATION_URL(id),
    method: 'POST',
    payload: { id },
    credentials,
  })

export const markNotificationsAsSeen = ({
  id,
  credentials,
  single = false,
}) => {
  const formData = new FormData()

  if (single) {
    formData.append('id', id)
  } else {
    formData.append('max_id', id)
  }

  return promisedRequest({
    url: NOTIFICATION_READ_URL,
    formData,
    credentials,
    method: 'POST',
  })
}

// #Announcements
export const getAnnouncements = ({ credentials }) =>
  promisedRequest({ url: MASTODON_ANNOUNCEMENTS_URL, credentials })

export const dismissAnnouncement = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_ANNOUNCEMENTS_DISMISS_URL(id),
    credentials,
    method: 'POST',
  })

// #Imports
export const importMutes = ({ file, credentials }) => {
  const formData = new FormData()
  formData.append('list', file)
  return promisedRequest({
    url: MUTES_IMPORT_URL,
    formData,
    method: 'POST',
    credentials,
  }).then((response) => response.ok)
}

export const importBlocks = ({ file, credentials }) => {
  const formData = new FormData()
  formData.append('list', file)
  return promisedRequest({
    url: BLOCKS_IMPORT_URL,
    formData,
    method: 'POST',
    credentials,
  }).then((response) => response.ok)
}

export const importFollows = ({ file, credentials }) => {
  const formData = new FormData()
  formData.append('list', file)
  return promisedRequest({
    url: FOLLOW_IMPORT_URL,
    formData,
    method: 'POST',
    credentials,
  }).then((response) => response.ok)
}

export const exportFriends = async ({ id, credentials }) => {
  let friends = []
  let more = true
  while (more) {
    const maxId = friends.length > 0 ? last(friends).id : undefined
    const users = await fetchFriends({
      id,
      maxId,
      credentials,
    })

    if (users.length === 0) {
      more = false
    } else {
      friends = [...friends, ...users]
    }
  }
  return friends
}

// #Profile settings
export const updateNotificationSettings = ({ credentials, settings }) => {
  return promisedRequest({
    url: NOTIFICATION_SETTINGS_URL(settings),
    credentials,
    method: 'PUT',
  })
}

export const updateProfileImages = ({
  credentials,
  avatar = null,
  avatarName = null,
  banner = null,
  background = null,
}) => {
  const form = new FormData()
  if (avatar !== null) {
    if (avatarName !== null) {
      form.append('avatar', avatar, avatarName)
    } else {
      form.append('avatar', avatar)
    }
  }
  if (banner !== null) form.append('header', banner)
  if (background !== null) form.append('pleroma_background_image', background)
  return promisedRequest({
    url: MASTODON_PROFILE_UPDATE_URL,
    credentials,
    method: 'PATCH',
    formData: form,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseUser(data) }))
}

export const updateProfile = ({ credentials, params }) => {
  const formData = new FormData()

  for (const name in params) {
    if (name === 'fields_attributes') {
      params[name].forEach((param, i) => {
        formData.append(name + `[${i}][name]`, param.name)
        formData.append(name + `[${i}][value]`, param.value)
      })
    } else {
      if (typeof params[name] === 'object') {
        console.warn(
          'Object detected in updateProfile API call. This will not work, use updateProfileJSON instead.',
        )
        console.warn('Object:\n' + JSON.stringify(params[name], null, 2))
      }
      formData.append(name, params[name])
    }
  }

  return promisedRequest({
    url: MASTODON_PROFILE_UPDATE_URL,
    credentials,
    method: 'PATCH',
    formData,
  }).then(({ data, ...rest }) => ({ ...rest, data: parseUser(data) }))
}

export const updateProfileJSON = ({ credentials, params }) =>
  promisedRequest({
    url: MASTODON_PROFILE_UPDATE_URL,
    credentials,
    payload: params,
    method: 'PATCH',
  }).then(({ data, ...rest }) => ({ ...rest, data: parseUser(data) }))

export const changeEmail = ({ credentials, email, password }) => {
  const form = new FormData()

  form.append('email', email)
  form.append('password', password)

  return promisedRequest({
    url: CHANGE_EMAIL_URL,
    formData: form,
    method: 'POST',
    credentials,
  })
}

export const moveAccount = ({ credentials, password, targetAccount }) => {
  const form = new FormData()

  form.append('password', password)
  form.append('target_account', targetAccount)

  return promisedRequest({
    url: MOVE_ACCOUNT_URL,
    formData: form,
    method: 'POST',
    credentials,
  })
}

export const changePassword = ({
  credentials,
  password,
  newPassword,
  newPasswordConfirmation,
}) => {
  const form = new FormData()

  form.append('password', password)
  form.append('new_password', newPassword)
  form.append('new_password_confirmation', newPasswordConfirmation)

  return promisedRequest({
    url: CHANGE_PASSWORD_URL,
    formData: form,
    method: 'POST',
    credentials,
  })
}

// #MFA
export const settingsMFA = ({ credentials }) =>
  promisedRequest({
    url: MFA_SETTINGS_URL,
    credentials,
    method: 'GET',
  })

export const mfaDisableOTP = ({ credentials, password }) => {
  const form = new FormData()

  form.append('password', password)

  return promisedRequest({
    url: MFA_DISABLE_OTP_URL,
    formData: form,
    method: 'DELETE',
    credentials,
  })
}

export const mfaConfirmOTP = ({ credentials, password, token }) => {
  const form = new FormData()

  form.append('password', password)
  form.append('code', token)

  return promisedRequest({
    url: MFA_CONFIRM_OTP_URL,
    formData: form,
    credentials,
    method: 'POST',
  })
}
export const mfaSetupOTP = ({ credentials }) =>
  promisedRequest({
    url: MFA_SETUP_OTP_URL,
    credentials,
    method: 'GET',
  })
export const generateMfaBackupCodes = ({ credentials }) =>
  promisedRequest({
    url: MFA_BACKUP_CODES_URL,
    credentials,
    method: 'GET',
  })

// #Aliases
export const addAlias = ({ credentials, alias }) =>
  promisedRequest({
    url: ALIASES_URL,
    method: 'PUT',
    credentials,
    payload: { alias },
  })

export const deleteAlias = ({ credentials, alias }) =>
  promisedRequest({
    url: ALIASES_URL,
    method: 'DELETE',
    credentials,
    payload: { alias },
  })

export const listAliases = ({ credentials }) =>
  promisedRequest({
    url: ALIASES_URL,
    method: 'GET',
    credentials,
    params: {
      _cacheBooster: Date.now(),
    },
  })

// User manipulation
export const fetchUserRelationship = ({ id, withSuspended, credentials }) =>
  promisedRequest({
    url: MASTODON_USER_RELATIONSHIPS_URL({ id, withSuspended }),
    credentials,
  })

export const followUser = ({ id, credentials, ...options }) => {
  const payload = {}

  if (options.reblogs !== undefined) {
    payload.reblogs = options.reblogs
  }

  if (options.notify !== undefined) {
    payload.notify = options.notify
  }

  return promisedRequest({
    url: MASTODON_FOLLOW_URL(id),
    payload,
    credentials,
    method: 'POST',
  })
}

export const unfollowUser = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_UNFOLLOW_URL(id),
    credentials,
    method: 'POST',
  })
export const fetchUserInLists = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_USER_IN_LISTS(id),
    credentials,
  })

export const removeUserFromFollowers = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_REMOVE_USER_FROM_FOLLOWERS_URL(id),
    credentials,
    method: 'POST',
  })

export const fetchFollowRequests = ({ credentials }) =>
  promisedRequest({
    url: MASTODON_FOLLOW_REQUESTS_URL,
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: data.map(parseUser) }))

export const approveUser = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_APPROVE_USER_URL(id),
    credentials,
    method: 'POST',
  })

export const denyUser = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_DENY_USER_URL(id),
    credentials,
    method: 'POST',
  })

export const editUserNote = ({ id, credentials, comment }) =>
  promisedRequest({
    url: MASTODON_USER_NOTE_URL(id),
    credentials,
    payload: {
      comment,
    },
    method: 'POST',
  })

export const fetchMutes = ({ maxId, credentials }) =>
  promisedRequest({
    url: MASTODON_USER_MUTES_URL({ maxId, withRelationships: true }),
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: data.map(parseUser) }))

export const muteUser = ({ id, expiresIn, credentials }) => {
  const payload = {}
  if (expiresIn) {
    payload.expires_in = expiresIn
  }

  return promisedRequest({
    url: MASTODON_MUTE_USER_URL(id),
    credentials,
    method: 'POST',
    payload,
  })
}

export const unmuteUser = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_UNMUTE_USER_URL(id),
    credentials,
    method: 'POST',
  })

export const fetchBlocks = ({ maxId, credentials }) =>
  promisedRequest({
    url: MASTODON_USER_BLOCKS_URL({ maxId, withRelationships: true }),
    credentials,
  }).then(({ data, ...rest }) => ({ ...rest, data: data.map(parseUser) }))

export const blockUser = ({ id, expiresIn, credentials }) => {
  const payload = {}
  if (expiresIn) {
    payload.duration = expiresIn
  }

  return promisedRequest({
    url: MASTODON_BLOCK_USER_URL(id),
    credentials,
    method: 'POST',
    payload,
  })
}

export const unblockUser = ({ id, credentials }) =>
  promisedRequest({
    url: MASTODON_UNBLOCK_USER_URL(id),
    credentials,
    method: 'POST',
  })

export const reportUser = ({
  credentials,
  userId,
  statusIds,
  comment,
  forward,
}) =>
  promisedRequest({
    url: MASTODON_REPORT_USER_URL,
    method: 'POST',
    payload: {
      account_id: userId,
      status_ids: statusIds,
      comment,
      forward,
    },
    credentials,
  })

// #Domain mutes
export const fetchDomainMutes = ({ credentials }) =>
  promisedRequest({ url: MASTODON_DOMAIN_BLOCKS_URL, credentials })

export const muteDomain = ({ domain, credentials }) =>
  promisedRequest({
    url: MASTODON_DOMAIN_BLOCKS_URL,
    method: 'POST',
    payload: { domain },
    credentials,
  })

export const unmuteDomain = ({ domain, credentials }) =>
  promisedRequest({
    url: MASTODON_DOMAIN_BLOCKS_URL,
    method: 'DELETE',
    payload: { domain },
    credentials,
  })

// #Backups
export const addBackup = ({ credentials }) =>
  promisedRequest({
    url: PLEROMA_BACKUP_URL,
    method: 'POST',
    credentials,
  })

export const listBackups = ({ credentials }) =>
  promisedRequest({
    url: PLEROMA_BACKUP_URL,
    method: 'GET',
    credentials,
    params: {
      _cacheBooster: Date.now(),
    },
  })

// #OAuth
export const fetchOAuthTokens = ({ credentials }) =>
  promisedRequest({
    url: '/api/oauth_tokens.json',
    credentials,
  })

export const revokeOAuthToken = ({ id, credentials }) =>
  promisedRequest({
    url: `/api/oauth_tokens/${id}`,
    credentials,
    method: 'DELETE',
  })

// #Lists
export const fetchLists = ({ credentials }) =>
  promisedRequest({
    url: MASTODON_LIST_URL(),
    credentials,
  })

export const createList = ({ title, credentials }) =>
  promisedRequest({
    url: MASTODON_LIST_URL(),
    credentials,
    method: 'POST',
    payload: { title },
  })

export const getList = ({ listId, credentials }) =>
  promisedRequest({
    url: MASTODON_LIST_URL(listId),
    credentials,
  })

export const updateList = ({ listId, title, credentials }) =>
  promisedRequest({
    url: MASTODON_LIST_URL(listId),

    credentials,
    method: 'PUT',
    payload: { title },
  })

export const getListAccounts = ({ listId, credentials }) =>
  promisedRequest({
    url: MASTODON_LIST_ACCOUNTS_URL(listId),
    credentials,
  }).then((data) => data.map(({ id }) => id))

export const addAccountsToList = ({ listId, accountIds, credentials }) =>
  promisedRequest({
    url: MASTODON_LIST_ACCOUNTS_URL(listId),
    credentials,
    method: 'POST',
    payload: { account_ids: accountIds },
  })

export const removeAccountsFromList = ({ listId, accountIds, credentials }) =>
  promisedRequest({
    url: MASTODON_LIST_ACCOUNTS_URL(listId),
    credentials,
    method: 'DELETE',
    payload: { account_ids: accountIds },
  })

export const deleteList = ({ listId, credentials }) =>
  promisedRequest({
    url: MASTODON_LIST_URL(listId),
    method: 'DELETE',
    credentials,
  })

// #Bookmarks
export const fetchBookmarkFolders = ({ credentials }) =>
  promisedRequest({
    url: PLEROMA_BOOKMARK_FOLDERS_URL,
    credentials,
  })

export const createBookmarkFolder = ({ name, emoji, credentials }) =>
  promisedRequest({
    url: PLEROMA_BOOKMARK_FOLDERS_URL,
    credentials,
    method: 'POST',
    payload: { name, emoji },
  })

export const updateBookmarkFolder = ({ folderId, name, emoji, credentials }) =>
  promisedRequest({
    url: PLEROMA_BOOKMARK_FOLDER_URL(folderId),
    credentials,
    method: 'PATCH',
    payload: { name, emoji },
  })

export const deleteBookmarkFolder = ({ folderId, credentials }) =>
  promisedRequest({
    url: PLEROMA_BOOKMARK_FOLDER_URL(folderId),
    method: 'DELETE',
    credentials,
  })

// #So long and thanks for all the fish
export const deleteAccount = ({ credentials, password }) => {
  const formData = new FormData()

  formData.append('password', password)

  return promisedRequest({
    url: DELETE_ACCOUNT_URL,
    formData,
    method: 'POST',
    credentials,
  })
}
