export interface ThreadNode<T extends { id: string; parent_id?: string | null; created_at: string }> {
  item: T;
  depth: number;
}

export const buildThreadList = <T extends { id: string; parent_id?: string | null; created_at: string }>(
  items: T[]
): ThreadNode<T>[] => {
  const byParent = new Map<string, T[]>();
  const roots: T[] = [];

  items.forEach((item) => {
    const parentId = item.parent_id ?? null;
    if (!parentId) {
      roots.push(item);
      return;
    }
    const list = byParent.get(parentId) ?? [];
    list.push(item);
    byParent.set(parentId, list);
  });

  const sortByDate = (a: T, b: T) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  roots.sort(sortByDate);
  byParent.forEach((value) => value.sort(sortByDate));

  const out: ThreadNode<T>[] = [];
  const walk = (node: T, depth: number) => {
    out.push({ item: node, depth });
    const children = byParent.get(node.id) ?? [];
    children.forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((root) => walk(root, 0));
  return out;
};
