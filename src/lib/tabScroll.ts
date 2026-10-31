// Pure pub/sub. The bottom tab bar announces that a primary tab was entered (or tapped again); each tab screen
// subscribes and scrolls its main list back to the top. Screens stay mounted inside <Tabs>, so without this a tab keeps
// whatever scroll position it was left at.
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function onTabEnter(tabName: string, fn: Listener): () => void {
  let set = listeners.get(tabName);
  if (!set) { set = new Set(); listeners.set(tabName, set); }
  set.add(fn);
  return () => { set!.delete(fn); if (set!.size === 0) listeners.delete(tabName); };
}

export function emitTabEnter(tabName: string): void {
  listeners.get(tabName)?.forEach((fn) => fn());
}
