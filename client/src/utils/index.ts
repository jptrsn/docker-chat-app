/**
 * URL detection and conversion utilities
 */

// Enhanced URL regex that matches various URL formats
const URL_REGEX = /(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\?[^\s]*)?/gi;

// More comprehensive URL regex for better detection
const COMPREHENSIVE_URL_REGEX = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

/**
 * Escapes HTML characters to prevent XSS attacks
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Detects URLs in text and converts them to HTML links
 * @param text - The text to process
 * @returns HTML string with URLs converted to links
 */
export function linkify(text: string): string {
  // First escape HTML to prevent XSS
  const escapedText = escapeHtml(text)
  
  // Replace URLs with clickable links
  return escapedText.replace(COMPREHENSIVE_URL_REGEX, (match) => {
    let url = match.trim()
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    
    // Create the link with security attributes
    return `<a 
      href="${escapeHtml(url)}" 
      target="_blank" 
      rel="noopener noreferrer"
      class="text-blue-500 hover:text-blue-700 underline break-all"
      title="Opens in new tab: ${escapeHtml(url)}"
    >${escapeHtml(match)}</a>`
  })
}

/**
 * Checks if a string contains URLs
 * @param text - The text to check
 * @returns boolean indicating if URLs were found
 */
export function containsUrls(text: string): boolean {
  return COMPREHENSIVE_URL_REGEX.test(text)
}

/**
 * Extracts all URLs from a text string
 * @param text - The text to extract URLs from
 * @returns Array of URLs found in the text
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(COMPREHENSIVE_URL_REGEX)
  if (!matches) return []
  
  return matches.map(match => {
    let url = match.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    return url
  })
}

/**
 * Validates if a string is a valid URL
 * @param string - The string to validate
 * @returns boolean indicating if the string is a valid URL
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch (_) {
    try {
      // Try with https prefix
      new URL('https://' + string)
      return true
    } catch (_) {
      return false
    }
  }
}

/**
 * Extracts the first URL from a text string for preview purposes
 * @param text - The text to extract URL from
 * @returns First URL found in the text, or null if none found
 */
export function getFirstUrl(text: string): string | null {
  const matches = text.match(COMPREHENSIVE_URL_REGEX)
  if (!matches || matches.length === 0) return null
  
  let url = matches[0].trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  return url
}