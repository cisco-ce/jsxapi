/**
 * Normalizes a path by turning it into an Array of strings.
 * Removes empty parts of the path and ignores redundant whitespace or
 * slashes. Each path element is also capitalized.
 *
 * @param {Array|string} path - Array or string path to normalize.
 * @return {Array} - Array of path segments.
 */
export default function normalizePath(path) {
  const split = Array.isArray(path) ? path : path.match(/(\w+)/g);
  return !split ? [] : split
    .map((element) => {
      if (/^\d+$/.test(element)) {
        return parseInt(element, 10);
      }
      return element.charAt(0).toUpperCase() + element.slice(1);
    });
}
