import DOMPurify from 'dompurify';

// DOMPurify defaults are already mostly fine, but:
const sanitiserDefaults = {
  // no CSS shenanigans; only our own stylesheets and MFM
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['style'],
  // allow non-XML MathML annotations
  // (by default the enclosing element is stripped but the text content kept messing up rendering)
  // (see: https://github.com/cure53/DOMPurify/issues/673#issuecomment-1107860622)
  ADD_TAGS: ['semantics', 'annotation']
}


// And manually remove annotations (fully) if type is not safe
const safeEncodings = ["text/plain", "application/x-tex"]

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName == 'annotation' && !safeEncodings.includes(node.getAttribute('encoding'))) {
    const parent = node.parentNode
    if (parent) {
      parent.removeChild(node)
    } else {
      node.innerHTML= ''
    }
  }
})

/**
 * Parse an input string into an inert HTML document.
 * The second optional argument are sanitiser options,
 * or if the special value `False` is provided no sanitisation will take place.
 */
export const fromString = (input, opts = {}) => {
  if (typeof(opts) === 'object' && opts !== null) {
    const fullOpts = {}
    Object.assign(fullOpts, sanitiserDefaults)
    Object.assign(fullOpts, opts)
    fullOpts['RETURN_DOM'] = true
    return DOMPurify.sanitize(input, fullOpts)
  } else if (opts === false) {
    const p = new DOMParser()
    const doc = p.parseFromString(input, 'text/html')
    return doc.body
  } else {
    throw `Illegal HTML Parser sanitisation options: ${JSON.stringify(opts)}`
  }
}

/**
 * Turn an HTML string, element or document into plain text
 * with all markup and invisible bits stripped.
 */
export const toPlainText = (html) => {
  let htmlElement;

  if (typeof(html) === 'string') {
    // no need to sanitise, we only grab the text anyway
    htmlElement = fromString(html, false)
  } else if (typeof(html) === 'object') {
    htmlElement = html?.body || html
  } else {
    htmlElement = null
  }

  return (htmlElement?.innerText || '')
}
