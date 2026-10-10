import { map } from 'lodash-es'

import { useOAuthStore } from 'src/stores/oauth.js'
import { useStatusesStore } from 'src/stores/statuses.js'
import { useTimelinesStore } from 'src/stores/timelines.js'

import {
  editStatus as apiEditStatus,
  postStatus as apiPostStatus,
  setMediaDescription as apiSetMediaDescription,
  uploadMedia as apiUploadMedia,
} from 'src/api/user.js'

const postStatus = ({
  store,
  status,
  spoilerText,
  visibility,
  sensitive,
  poll,
  media = [],
  inReplyToStatusId = undefined,
  quoteId = undefined,
  contentType = 'text/plain',
  preview = false,
  idempotencyKey = '',
}) => {
  const mediaIds = map(media, 'id')

  return apiPostStatus({
    credentials: useOAuthStore().token,
    status,
    spoilerText,
    visibility,
    sensitive,
    mediaIds,
    inReplyToStatusId,
    quoteId,
    contentType,
    poll,
    preview,
    idempotencyKey,
  }).then(({ data, timestamp }) => {
    if (!preview) {
      useStatusesStore().addNewStatuses({
        timestamp,
        statuses: [data],
      })
      useTimelinesStore().addStatusesToTimeline('friends', undefined, {
        statuses: [data.id],
        showImmediately: true,
        noIdUpdate: true, // To prevent missing notices on next pull.
      })
    }

    return data
  })
}

const editStatus = ({
  store,
  statusId,
  status,
  spoilerText,
  sensitive,
  poll,
  media = [],
  contentType = 'text/plain',
}) => {
  const mediaIds = map(media, 'id')

  return apiEditStatus({
    id: statusId,
    credentials: useOAuthStore().token,
    status,
    spoilerText,
    sensitive,
    poll,
    mediaIds,
    contentType,
  }).then(({ data, timestamp }) => {
    useStatusesStore().addNewStatuses({
      statuses: [data],
      timestamp,
    })
    useTimelinesStore().addStatusesToTimeline('friends', undefined, {
      statuses: [data.id],
      showImmediately: true,
      noIdUpdate: true, // To prevent missing notices on next pull.
    })

    return data
  })
}

const uploadMedia = ({ store, formData }) => {
  const credentials = useOAuthStore().token
  return apiUploadMedia({ credentials, formData }).then(({ data }) => data)
}

const setMediaDescription = ({ store, id, description }) => {
  const credentials = useOAuthStore().token
  return apiSetMediaDescription({ credentials, id, description }).then(
    ({ data }) => data,
  )
}

const statusPosterService = {
  postStatus,
  editStatus,
  uploadMedia,
  setMediaDescription,
}

export default statusPosterService
