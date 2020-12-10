import assert from 'assert'
import createSelector, { Language } from 'cssauron2'
import domSerializer, { DomSerializerOptions } from 'dom-serializer'
import type { Element, Node } from 'domhandler'
import { DomHandler } from 'domhandler'
import { getAttributeValue, getChildren, getParent, isTag } from 'domutils'
import { Parser } from 'htmlparser2'

const serializerOptions: DomSerializerOptions = {
  emptyAttrs: true,
  selfClosingTags: true,
}

/**
 * Parse HTML to an Array of Nodes
 */
export const parseHtml = (html: string): Promise<Array<Node>> =>
  new Promise((resolve, reject) => {
    const handler = new DomHandler((err, nodes) => (err ? reject(err) : resolve(nodes)))
    const parser = new Parser(handler)

    parser.write(html as string)
    parser.end()
  })

/**
 * Get the outerHTML equivalent from a Node
 */
export const getOuterHtml = (n: Node): string => domSerializer(n, serializerOptions)

/**
 * Get the innerHTML equivalent from a Node
 */
export const getInnerHtml = (n: Node): string => getChildren(n).map(getOuterHtml).join('')

const nodeOptions: Language = {
  tag: (n) => (isTag(n) ? n.tagName : n.type),
  contents: getInnerHtml,
  id: (n) => (isTag(n) ? n.attribs.id ?? '' : ''),
  class: (n) => (isTag(n) ? n.attribs.class ?? '' : ''),
  parent: (n) => getParent(n) ?? undefined,
  children: (n) => getChildren(n),
  attr: (n, name) => (isTag(n) ? getAttributeValue(n, name) ?? '' : ''),
}

/**
 * Tells if a css selector matches a Node
 */
export const matches = (selector: string, node: Node): boolean =>
  createSelector(nodeOptions)(selector)(node)

const toNodeArray = (node: Node | Node[]): Node[] => (Array.isArray(node) ? node : [node])

/**
 * Query for all matching Elements from one or more Nodes. Since parseHtml returns Array<Node>
 * this is a convenience around tree-selector's createQuerySelector that preserves the behavior of querySelectorAll
 * within the browser.
 */
export const querySelectorAll = (selector: string, nodes: Array<Node>): Array<Element> =>
  Array.from(depthFirstTraversal(nodes)).filter((n) => matches(selector, n))

/**
 * Find the first match to a given selector
 */
export const querySelector = (selector: string, nodes: Array<Node>): Element | null => {
  for (const node of depthFirstTraversal(nodes)) {
    if (matches(selector, node)) {
      return node
    }
  }

  return null
}

export const queryExpectedSelector = (selector: string, node: Node | Array<Node>): Element => {
  const match = querySelector(selector, toNodeArray(node))

  assert.ok(match, `Expected to find a node by selector: ${selector}`)

  return match
}

// Depth-first traversal of Elements
export function* depthFirstTraversal(nodes: Array<Node>): Iterable<Element> {
  const toProcess: Array<Node> = [...nodes]

  while (toProcess.length > 0) {
    const node = toProcess.shift()

    if (node && isTag(node)) {
      yield node

      toProcess.push(...getChildren(node))
    }
  }
}
