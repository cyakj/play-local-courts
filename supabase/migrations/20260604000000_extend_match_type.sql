-- Extend match_type enum for mixed doubles and hitting sessions
ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'mixed_doubles';
ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'hitting_session';
