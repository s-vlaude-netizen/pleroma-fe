import { filter } from 'lodash'

export const muteWordHits = (status, muteRules) => {
  const statusTextLC = status.text.toLowerCase()
  const statusSummaryLC = status.summary.toLowerCase()
  const altTextPairs = status.attachments.map((a) => [a.description, a.description?.toLowerCase()])

  const hits = []

  for (const rule of muteRules) {
    const pred = rule.predicate

    if (pred(status.text, statusTextLC) ||
        pred(status.summary, statusSummaryLC) ||
        altTextPairs.some(([t, tlc]) => pred(t, tlc))
    ) {
      hits.push(rule.name)
    }
  }

  return hits
}
