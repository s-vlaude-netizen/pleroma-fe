import { filter } from 'lodash'

export const muteWordHits = (status, muteWords) => {
  const statusText = status.text.toLowerCase()
  const statusSummary = status.summary.toLowerCase()

  const hits = filter(muteWords, (muteWord) => {
    muteWord = muteWord.toLowerCase()

    return (
      statusText.includes(muteWord) ||
      statusSummary.includes(muteWord) ||
      status.attachments.some((a) => a.description?.toLowerCase().includes(muteWord))
    )
  })

  return hits
}
