import CommunityMessages from '@/components/messaging/CommunityMessages';

// HOA administrator inbox. The implementation is shared with the resident side (see
// components/messaging/CommunityMessages.tsx); who may message whom is enforced in Postgres.
export default function CMMessagesScreen() {
  return <CommunityMessages role="admin" tabScreen />;
}
