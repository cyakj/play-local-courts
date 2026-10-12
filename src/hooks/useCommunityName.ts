import { isCommunityMode } from '@/config/productMode';
import { useActiveCommunity } from '@/hooks/useActiveCommunity';

// Active community's name for Community-mode headers. Tennis mode returns
// undefined without touching the network.
export function useCommunityName(): string | undefined {
  const { community } = useActiveCommunity();
  return isCommunityMode ? community?.name : undefined;
}
