// Cache only deterministic SHA-256 keys, never bookmark or tab contents.
export const metadataKeys = new Map<string, Promise<string>>();
