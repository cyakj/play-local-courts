-- Enable REPLICA IDENTITY FULL for all tables that need real-time updates
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE match_requests REPLICA IDENTITY FULL;
ALTER TABLE lesson_requests REPLICA IDENTITY FULL;
ALTER TABLE bookings REPLICA IDENTITY FULL;
ALTER TABLE ladder_matches REPLICA IDENTITY FULL;
ALTER TABLE ladder_teams REPLICA IDENTITY FULL;
ALTER TABLE ladder_invitations REPLICA IDENTITY FULL;
ALTER TABLE community_join_requests REPLICA IDENTITY FULL;
ALTER TABLE posts REPLICA IDENTITY FULL;
ALTER TABLE comments REPLICA IDENTITY FULL;
ALTER TABLE likes REPLICA IDENTITY FULL;
ALTER TABLE maintenance_reports REPLICA IDENTITY FULL;
ALTER TABLE court_maintenance REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication for real-time functionality
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE match_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE lesson_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE ladder_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE ladder_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE ladder_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE community_join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE court_maintenance;