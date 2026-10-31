// Pure. Whether the resident Schedule has anything to load. Community mode is scoped to communities, so it has nothing
// without one. Tennis mode also shows the person's own matches and lessons, which carry no community id.
export function hasNothingToFetch(communityCount: number, tennisMode: boolean): boolean {
  return communityCount === 0 && !tennisMode;
}
