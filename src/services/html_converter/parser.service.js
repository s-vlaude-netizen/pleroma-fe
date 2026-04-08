/**
 * Parse an input string into an inert HTML document.
 */
export const fromString = (input) => {
  const p = new DOMParser()
  const doc = p.parseFromString(input, 'text/html')
  return doc
}

/**
 * Turn an HTML string, element or document into plain text
 * with all markup and invisible bits stripped.
 */
export const toPlainText = (html) => {
  let htmlElement;

  if (typeof(html) === 'string') {
    htmlElement = fromString(html).body
  } else if (typeof(html) === 'object') {
    htmlElement = html?.body || html
  } else {
    htmlElement = null
  }

  return (htmlElement?.innerText || '')
}
