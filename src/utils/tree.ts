import type { Board, Node, Space } from '../types';
// Metadata follows logical paths across Chrome profiles: bookmark IDs are only local.
export function pathKey(parts: string[]): string {
  return JSON.stringify(parts);
}
export function parseTree(root: Node | null): Board {
  let irregularCount = 0;
  const occurrences = new Map<string, number>();
  const spaces: Space[] = (root?.children ?? [])
    .filter((n) => {
      if (n.url) {
        irregularCount++;
        return false;
      }
      return true;
    })
    .map((s, si) => {
      const occurrence = occurrences.get(s.title) ?? 0;
      occurrences.set(s.title, occurrence + 1);
      const path = [s.title, String(occurrence)];
      const collectionsSeen = new Map<string, number>();
      return {
        id: s.id,
        title: s.title,
        index: s.index ?? si,
        metaKey: pathKey(path),
        collections: (s.children ?? [])
          .filter((n) => {
            if (n.url) {
              irregularCount++;
              return false;
            }
            return true;
          })
          .map((c, ci) => {
            const co = collectionsSeen.get(c.title) ?? 0;
            collectionsSeen.set(c.title, co + 1);
            return {
              id: c.id,
              spaceId: s.id,
              title: c.title,
              index: c.index ?? ci,
              metaKey: pathKey([...path, c.title, String(co)]),
              bookmarks: (c.children ?? [])
                .filter((n) => {
                  if (!n.url) {
                    irregularCount++;
                    return false;
                  }
                  return true;
                })
                .map((b, bi) => ({
                  id: b.id,
                  parentId: c.id,
                  title: b.title,
                  url: b.url!,
                  index: b.index ?? bi,
                })),
            };
          }),
      };
    });
  return { root, spaces, irregularCount };
}
export function flatten(root: Node): Node[] {
  return [root, ...(root.children ?? []).flatMap(flatten)];
}
export function nodeCount(root: Node): number {
  return flatten(root).filter((n) => n.url).length;
}
export function searchSpaces(spaces: Space[], query: string): Space[] {
  const term = query.trim().toLocaleLowerCase();
  return term ? spaces.filter((space) => space.title.toLocaleLowerCase().includes(term)) : [];
}
export function searchBoard(spaces: Space[], query: string) {
  const term = query.trim().toLocaleLowerCase();
  return spaces.flatMap((space) =>
    space.collections
      .map((collection) => ({
        space,
        collection,
        bookmarks: collection.bookmarks.filter((bookmark) =>
          [space.title, collection.title, bookmark.title, bookmark.url].some((value) =>
            value.toLocaleLowerCase().includes(term),
          ),
        ),
      }))
      .filter(
        (result) =>
          result.bookmarks.length ||
          [result.space.title, result.collection.title].some((value) =>
            value.toLocaleLowerCase().includes(term),
          ),
      ),
  );
}
