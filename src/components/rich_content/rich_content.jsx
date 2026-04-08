import { fromString } from 'src/services/html_converter/parser.service.js'
import StillImage from 'src/components/still-image/still-image.vue'
import MentionsLine, { MENTIONS_LIMIT } from 'src/components/mentions_line/mentions_line.vue'
import HashtagLink from 'src/components/hashtag_link/hashtag_link.vue'

import './rich_content.scss'

/**
 * RichContent, The Über-powered component for rendering Post HTML.
 *
 * This takes post HTML and does multiple things to it:
 * - Groups all mentions into <MentionsLine>, this affects all mentions regardles
 *   of where they are (beginning/middle/end), even single mentions are converted
 *   to a <MentionsLine> containing single <MentionLink>.
 * - Replaces emoji shortcodes with <StillImage>'d images.
 *
 * Note:
 * 1. Vue properties MUST NOT be touched during rendering!
 *    But the parser also needs to keep track of mutable state across functions,
 *    thus we split the actual rendering out to a one-time use class object.
 * 2. We need to output both render and some extra data, which seems to be imp-
 *    possible in vue. Current solution is to emit 'parseReady' event when parsing
 *    is done within render() function.
 * 3. We are inserting _dynamic_ Vue component elements into the body (e.g. the show more of mentions line).
 *    For the dynamic part to work, the whole tree must be a JSX Vue/React-style VNode thingy.
 *    Thus, rather than just doing minor mods to the parsed vanialla HTMLElements + adding in a couple new,
 *    we must recreate the element tree in JSX template style.
 *    Child elements can be apssed via an array with text nodes just being simple strings.
 *    Use <Tag ...>...</Tag> where `Tag` is a variable holding a plain HTML node name
 *    to wrap vanilla elements into the Vue/React garments.
 *
 * Apart from that one small hiccup with emit in render this _should_ be vue3-ready
 */
class RichContentParser {

  // All mentions that appear in post body
  writtenMentions = [];

  // All mentions beyond the limiter (see MentionsLine), collapsed from default view
  invisibleMentions = [];

  // unique index for vue "tag" property
  #mentionIndex = 0;

  // buffer for just the current sequence of consectuive mentions
  #currentMentions = [];

  // This is used to recover spacing removed when parsing mentions
  #lastSpacing = '';

  // Reference to the embedded Vue object to read its settings.
  // READ-ONLY: NEVER EVER TOUCH DATA INSIDE RENDER!
  vueState;

  constructor(vueState) {
    this.vueState = vueState
  }

  parse() {
    let htree = fromString(this.vueState.html)

    // Green/cyantexting requires detecting linebreaks and acting on larger blocks
    // It’s easier to do this first in a separate pass before the regular per-element modifications.
    // This does no JSX templating either and just modifies the vanilla DOM in-place.
    if (this.vueState.greentext && !this.vueState.mfm) {
      this.#styleGreentext(htree.body)
    }

    const jsxChilds = []
    for (const n of htree.body.childNodes) {
      jsxChilds.push(...this.#processNode(n))
    }

    // DO NOT USE SLOTS they cause a re-render feedback loop here.
    // slots updated -> rerender -> emit -> update up the tree -> rerender -> ...
    // at least until vue3?
    const result = <span class="RichContent">
      { jsxChilds }
    </span>

    return result;
  }

  static #isSimpleShallow(node) {
    // avoid meddling with code blocks, pre-styled blockquote elements etc
    return (
      node.nodeType === Node.TEXT_NODE ||
      ["BR", "P", "DIV", "SPAN", "A"].includes(node.nodeName)
    )
  }

  static #isSimple(node) {
    return (
      RichContentParser.#isSimpleShallow(node) &&
      [...node.childNodes].every(RichContentParser.#isSimple)
    )
  }

  #maybeStyleLine(parent, lineElements) {
    if (lineElements.length == 0) return;
    if (!lineElements.every(RichContentParser.#isSimple)) return;

    const cleanText = lineElements
      .map(e => e.innerText ?? e.textContent ?? '')
      .join('')
      .replace(/@\w+/gi, '')
      .trim()

    const styleChar = cleanText.charAt(0)
    const style = ({'>': 'greentext', '<': 'cyantext'})[styleChar]
    if (!style) return;

    const styledLine = document.createElement('span')
    styledLine.classList.add(style)

    parent.insertBefore(styledLine, lineElements[0])
    for (var e of lineElements) {
      e = parent.removeChild(e)
      styledLine.appendChild(e)
    }
  }

  #styleGreentext(lineParent, allowDescent = true) {
    // Greentexting is only aplied on "simple" source types.
    // Thus it’s sufficient to consider only <p> and <br /> for line breaking here.
    // The former fortunately cannot be nested anyway and
    // we furthermore assume all linebreaks appear either at the top-level
    // or within the first level of a top-level <p> element. Linerbeaks nested within
    // another tag couldn’t be styled without breaking the enclosing tag anyway.

    if (lineParent.childNodes.length == 0) return;

    // copy array to avoid weirdness when removing elements from top-level later
    const nodes = [...lineParent.childNodes]
    const currentLine = []

    for (const n of nodes) {
      if (n.nodeName === 'P' && allowDescent) {
        this.#maybeStyleLine(lineParent, currentLine)
        this.#styleGreentext(n, false)
        currentLine.splice(0)
      } else if (n.nodeName === 'BR') {
        this.#maybeStyleLine(lineParent, currentLine)
        currentLine.splice(0)
      } else {
        currentLine.push(n)
      }
    }

    this.#maybeStyleLine(lineParent, currentLine)
  }

  #getLinkData(link, index = 0) {
    return {
      index,
      url: link.attributes['href']?.value,
      tag: link.attributes['data-tag']?.value,
      content: link.innerHTML,
      textContent: link.innerText ?? ''
    }
  }

  #nodeAttributeMap(node) {
    // node.attributes is a funny "NamedNodeMap", not a regular object.
    // Need to covnert it first, else it ends up with numeric names and object values, confusing JSX
    const attrs = { }
    for (const a of node.attributes)
      attrs[a.name] = a.value
    return attrs
  }

  #renderImage(node) {
    return <StillImage
      { ...this.#nodeAttributeMap(node) }
      class="img"
    />
  }

  #renderHashtag(node) {
    const { url, tag, content } = this.#getLinkData(node)
    return <HashtagLink url={url} tag={tag} content={content}/>
  }

  #renderMention(node) {
    const linkData = this.#getLinkData(node, this.#mentionIndex++)
    linkData.notifying = this.vueState.attentions.some(a => a.statusnet_profile_url === linkData.url)

    this.writtenMentions.push(linkData)
    this.#currentMentions.push(linkData)

    if (this.#currentMentions.length > MENTIONS_LIMIT) {
      this.invisibleMentions.push(linkData)
    }

    if (this.#currentMentions.length === 1) {
      return <MentionsLine mentions={ this.#currentMentions } />
    } else {
      return ''
    }
  }

  #renderEmoji(url, shortcode) {
    return <StillImage
      class="emoji img"
      src={url}
      title={`:${shortcode}:`}
      alt={`:${shortcode}:`}
    />
  }

  #maybePushTextNode(acc, text, start, end) {
    if (end > start && start >= 0) {
      acc.push(text.slice(start, end))
    }
  }

  #processTextForEmoji(text) {
    const elements = []
    let plainStart = 0
    let plainEnd = text.indexOf(':')

    while (plainEnd >= 0) {
      const emojiEnd = text.indexOf(':', plainEnd + 1)
      if (emojiEnd <= 0) break;

      const emojiName = text.slice(plainEnd + 1, emojiEnd)
      const emoji = emojiName && this.vueState.emoji.find(e => e.shortcode == emojiName)

      // found another ":", but name didn’t match an emoji;
      // restart with this next ":" as the opener
      if (!emoji) {
        plainEnd = emojiEnd
        continue
      }

      // found matching emoji; insert and continue after last ":"
      this.#maybePushTextNode(elements, text, plainStart, plainEnd)
      elements.push(this.#renderEmoji(emoji.url, emoji.shortcode))
      plainStart = emojiEnd + 1
      plainEnd = text.indexOf(':', emojiEnd + 1)
    }

    plainEnd = text.length
    if (plainStart == 0) {
      return [text]
    }

    this.#maybePushTextNode(elements, text, plainStart, plainEnd)
    return elements
  }

  #processTextNode(textNode) {
    const text = textNode.textContent;
    const isEmpty = text.trim() === ''

    if (isEmpty) {
      // No idea why the old code did that; in-source linebreaks have no special meaning in HTML.
      // Maybe a quirk of the cursed old NIH parser, but doesn't make any sense to me now.
      //if (text.includes('\n')) this.#currentMentions = [];

      // don't include spaces between consecutive mentions.
      // we'll include them in MentionsLine.
      // However, do preserve _trailing_ whitespace, in case the original source
      // placed the spacing between mentions and following elements within the mention context.
      if (this.#currentMentions.length > 0 && textNode.parentNode?.lastChild !== textNode) {
        this.#lastSpacing = text
        textNode.textContent = ''
      }
      return [textNode.textContent]
    }

    this.#currentMentions = []

    return this.#processTextForEmoji(text)
  }

  #applyMfmStyle(node) {
    // CSS selectors and styling rules can check whether data-* attributes exist and are true
    // but are otherwise unable to extract the precise value. To make MFM parameters available to our style sheet
    // we turn e.g. `{'data-mfm-some': '1deg', 'data-mfm-thing': '5s'}` to "--mfm-some: 1deg;--mfm-thing: 5s;"
    //
    // Since we use ECMAScripts Element.style.setProperty it already ought to be impossible to insert extra style
    // properties via malicious MFM values (it already automatically rejects or escapes values as appropriate).
    // However, to be extra safe and given all valid parameters should match this anyway,
    // we restrict values to only letters, numbers, dot and minus signs.
    // There is a special case for the `color` value, since it is provided without `#`,
    // but CSS requires this prefix in the `style` property

    // no pre-existing style should ever be present anyway, but let’s make sure
    node.removeAttribute('style')
    for (const a of node.attributes) {
      const key = a.name
      const val = a.value

      if (!(key.startsWith('data-mfm-') && val !== true && /^[a-zA-Z0-9.\-]*$/.test(val)))
        continue

      const cssName = '--mfm-' + key.substr(9)
      const cssVal = key === 'data-mfm-color' ? ('#' + val) : val
      node.style.setProperty(cssName, cssVal)
    }
  }

  #processSpan(node) {
    // mentions can be wrapped in 'h-card' spans, unpack them and process here
    // to avoid breaking the mention chain or adding spurious padding
    if (this.handleLinks && node.classList.contains('h-card')) {
      return [...node.childNodes].map(this.#processNode)
    }

    this.#applyMfmStyle(node)
    return null
  }

  #processLink(node) {
    // Mentions
    if (node.classList.contains('mention')) {
      return this.#renderMention(node)
    }

    // mention chain no longer consecutive
    this.#currentMentions = []

    // Hashtags
    if (
      (node.classList.contains('hashtag')) ||   // Pleroma style
      (node.attributes['rel']?.value === 'tag') // Mastodon style
    ) {
      return this.#renderHashtag(node)
    }

    // some other link
    node.setAttribute('target', '_blank')
    return null
  }

  #spacingPrefix(node) {
    const firstChild = node.childNodes.length > 0 ? node.childNodes[0] : null

    const eligibleForSpace =
      // Padding is only needed if we just finished parsing mentions
      this.#currentMentions.length > 0 &&
      // Don't add padding if content is string and has padding already
      !(firstChild?.nodeType == Node.TEXT_NODE && firstChild.textContent.match(/^\s/))

    return eligibleForSpace ? this.#lastSpacing : ''
  }

  #processElementNode(node) {
    const Tag = node.nodeName
    const mentionsLinePadding = this.#spacingPrefix(node)

    switch (Tag) {
      case 'BR':
        this.#currentMentions = []
        return [<br />]

      case 'IMG':
        return [mentionsLinePadding, this.#renderImage(node)]

      case 'A':
        if (!this.vueState.handleLinks) break
        const styledLink = this.#processLink(node)
        if (styledLink !== null) return [styledLink]
        break

      case 'SPAN':
        const styledSpanElements = this.#processSpan(node)
        if (styledSpanElements !== null) return styledSpanElements;
        break
    }

    const pchilds = [...node.childNodes].map(n => this.#processNode(n))
    const attrs = this.#nodeAttributeMap(node)
    return [mentionsLinePadding, <Tag {...attrs}>{ pchilds }</Tag>]
  }

  #processNode(node) {
    if(node.nodeType === Node.TEXT_NODE) {
      return this.#processTextNode(node)
    } else if (node.nodeType == Node.ELEMENT_NODE) {
      return this.#processElementNode(node)
    } else if (node.nodeType == Node.COMMENT_NODE) {
      // ignore
    } else {
      // since we start with childs of <body> a parent node should be guaranteed
      console.warn(`RichContentParser: Encountered unexpected node type (${node.nodeType}); dropping: ${node.outerHTML ?? node.textContent}`)
    }
    return []
  }
}

export default {
  name: 'RichContent',
  components: {
    MentionsLine,
    HashtagLink
  },
  props: {
    // Original html content
    html: {
      required: true,
      type: String
    },
    attentions: {
      required: false,
      default: () => []
    },
    // Emoji object, as in status.emojis, note the "s" at the end...
    emoji: {
      required: true,
      type: Array
    },
    // Whether to handle links or not (posts: yes, everything else: no)
    handleLinks: {
      required: false,
      type: Boolean,
      default: false
    },
    // Meme arrows
    greentext: {
      required: false,
      type: Boolean,
      default: false
    },
    // Render Misskey Markdown
    mfm: {
      required: false,
      type: Boolean,
      default: false
    }
  },
  render () {
    const parser = new RichContentParser(this);
    const result = parser.parse()

    const event = {
      writtenMentions: parser.writtenMentions,
      invisibleMentions: parser.invisibleMentions
    }

    // DO NOT MOVE TO UPDATE. BAD IDEA.
    this.$emit('parseReady', event)

    return result
  }
}
