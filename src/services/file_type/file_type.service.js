const fileType = mediaAttachment => {
  // *oma extension; full MIME type of the file if known
  const mimetype = mediaAttachment.mimetype

  if (mimetype.match(/flash/)) {
    return 'flash'
  }

  if (mimetype.match(/text\/html/)) {
    return 'html'
  }

  if (mimetype.match(/image/)) {
    return 'image'
  }

  if (mimetype.match(/video/)) {
    return 'video'
  }

  if (mimetype.match(/audio/)) {
    return 'audio'
  }

  // if inconclusive, try generic type from vanilla Mastodon
  if (mediaAttachment.type === 'gifv') {
    return 'video'
  }

  return (mediaAttachment.type || 'unknown')
}

const fileTypeService = {
  fileType,
}

export default fileTypeService
