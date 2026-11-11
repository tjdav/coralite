/**
 * Finds the closest enclosing component/custom element of a DOM node.
 *
 * @param {any} element - The DOM node.
 * @returns {any} The enclosing custom element instance or null.
 */
export function getEnclosingComponent (element) {
  if (!element) {
    return null
  }

  let parent = element.parentElement

  while (parent) {
    if (parent._instanceId !== undefined) {
      return parent
    }

    if (parent.hasAttribute && parent.hasAttribute('data-cid') &&
        (parent.componentOptions || parent._instanceId !== undefined)) {
      return parent
    }

    parent = parent.parentElement
  }

  return null
}

/**
 * Resolves the owning Coralite component instance ID for a DOM node.
 *
 * @param {any} node - The DOM node.
 * @returns {string | null | undefined} The owning component instance ID, or undefined.
 */
export function resolveInstanceId (node) {
  if (!node) {
    return undefined
  }
  if (node._instanceId !== undefined) {
    return node._instanceId
  }
  if (typeof node.getAttribute === 'function') {
    const owner = node.getAttribute('data-coralite-owner')
    if (owner) {
      return owner
    }
  }
  if (typeof node.closest === 'function') {
    const ownerElement = node.closest('[data-coralite-owner]')
    if (ownerElement) {
      return ownerElement.getAttribute('data-coralite-owner')
    }
    const instanceElement = node.closest('[data-cid]')
    if (instanceElement) {
      return instanceElement.getAttribute('data-cid')
    }
  }
  if (node.host) {
    return resolveInstanceId(node.host)
  }
  return undefined
}

/**
 * Checks if a candidate node belongs to a specific Coralite component instance.
 * Prioritizes the authoritative `data-coralite-owner` attribute over geometric DOM containment.
 *
 * @param {any} candidate - The candidate DOM node.
 * @param {string|null} instanceId - The component instance ID.
 * @param {any} hostElement - The host custom element instance.
 * @returns {boolean}
 */
export function isOwnedByComponent (candidate, instanceId, hostElement) {
  if (!candidate || !instanceId) {
    return false
  }

  if (candidate.getAttribute && candidate.getAttribute('data-coralite-owner') === instanceId) {
    return true
  }

  const enc = getEnclosingComponent(candidate)
  return enc === hostElement || (enc && enc.getAttribute && enc.getAttribute('data-cid') === instanceId && (enc.componentOptions || enc._instanceId !== undefined))
}

/**
 * Finds a ref candidate DOM node owned by a Coralite component instance without allocating intermediate arrays.
 *
 * @param {any} root - The root DOM element to search within.
 * @param {string} refName - The short ref identifier (e.g., 'btn').
 * @param {string} uniqueRefValue - The unique instance-prefixed ref value (e.g., 'comp-0__btn').
 * @param {string} instanceId - The component instance ID.
 * @returns {any} The matching DOM node, or null if none found.
 */
export function findOwnedRefNode (root, refName, uniqueRefValue, instanceId) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return null
  }
  const candidates = root.querySelectorAll(`[ref="${refName}"], [ref="${uniqueRefValue}"]`)
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    if (isOwnedByComponent(candidate, instanceId, root)) {
      return candidate
    }
  }
  return null
}
