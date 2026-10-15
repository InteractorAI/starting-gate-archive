/** Resolve archived Markdown images without a runtime dependency on other hosts. */
export function resolveArchiveImage(src, manifest) {
    if (!src) return null;
    const archived = manifest[src];
    if (archived) return archived.file ? `/images/${archived.file}` : null;
    if (src.startsWith('../images/')) return src.replace('../images/', '/images/');
    if (src.startsWith('/images/')) return src;
    return null;
}
