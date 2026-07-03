import { Fragment, createElement, type ReactNode } from 'react'
import { GAP_MARKER_RE } from './gapMarkers'

// Tags we allow from passage html; anything else renders its children only.
const ALLOWED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'blockquote',
  'span',
])

interface PassageHtmlProps {
  html: string
  /** Renders the widget for a {{itemId}} gap marker. Defaults to nothing. */
  renderGap?: (itemId: string) => ReactNode
}

// Converts passage html (with {{itemId}} gap markers) into real React elements,
// so gap widgets are ordinary React children. Avoids dangerouslySetInnerHTML
// entirely, which also strips any unexpected markup from test content.
export function PassageHtml({ html, renderGap }: PassageHtmlProps) {
  let key = 0

  const convertText = (text: string): ReactNode => {
    const segments = text.split(GAP_MARKER_RE)
    if (segments.length === 1) return text
    // With a capture group, split() interleaves: even indexes are literal
    // text, odd indexes are the captured item ids.
    return segments.map((segment, index) =>
      index % 2 === 1 ? (
        <Fragment key={key++}>{renderGap?.(segment) ?? null}</Fragment>
      ) : (
        segment
      ),
    )
  }

  const convertNode = (node: ChildNode): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return convertText(node.textContent ?? '')
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null
    const element = node as Element
    const tag = element.tagName.toLowerCase()
    if (tag === 'br') return createElement('br', { key: key++ })
    const children = Array.from(element.childNodes).map((child) => (
      <Fragment key={key++}>{convertNode(child)}</Fragment>
    ))
    if (!ALLOWED_TAGS.has(tag)) return children
    return createElement(tag, { key: key++ }, children)
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  return <>{Array.from(doc.body.childNodes).map((node) => convertNode(node))}</>
}
