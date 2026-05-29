/**
 * A memory-efficient Map-based Least Recently Used (LRU) Cache.
 * Leverages the insertion order guarantee of JavaScript Maps.
 */
class LRUCache {
    /**
     * @param {number} maxSize - Maximum number of items allowed in the cache.
     */
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    /**
     * Retrieves an item from the cache. If expired, it deletes the item and returns null.
     * Refreshes the item's insertion order (marks it as Most Recently Used).
     * @param {string} key 
     * @returns {any} Cached value or null
     */
    get(key) {
        if (!this.cache.has(key)) {
            return null;
        }

        const entry = this.cache.get(key);
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        // Refresh key order (LRU): delete and re-set
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;
    }

    /**
     * Inserts or updates a value in the cache.
     * Enforces maxSize limit by evicting the Least Recently Used (first) item.
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttlMs - Time to live in milliseconds
     */
    set(key, value, ttlMs) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // First item in Map is the oldest insertion (LRU)
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
    }

    /**
     * Proactively prunes expired cache entries to free up memory.
     */
    prune() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clears all cache entries.
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Returns the current number of items in the cache.
     * @returns {number}
     */
    get size() {
        return this.cache.size;
    }
}

module.exports = LRUCache;
