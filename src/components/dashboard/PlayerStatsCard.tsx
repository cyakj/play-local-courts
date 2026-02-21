import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMode } from "@/contexts/ModeContext";
import { TrendingUp, Medal } from "lucide-react";
import { subDays, format } from "date-fns";

interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  ladderPositions: { ladderName: string; position: number }[];
}

const CircularProgress = ({
  value, max, label, sublabel, color = "stroke-primary"
}: { value: number; max: number; label: string; sublabel?: string; color?: string; }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 transform -rotate-90">
          <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-muted/30" />
          <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" className={color} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold">{value}</span>
        </div>
      </div>
      <span className="text-sm font-medium mt-2">{label}</span>
      {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
    </div>
  );
};

export const PlayerStatsCard = () => {
  const { currentUser } = useAuth();
  const { isHOAMode } = useMode();
  const [stats, setStats] = useState<PlayerStats>({ matchesPlayed: 0, wins: 0, losses: 0, ladderPositions: [] });
  const [loading, setLoading] = useState(true);

  // Hidden in HOA mode— tennis performance stats are a TennisX feature
  if (isHOAMode) return null;

  useEffect(() => {
    if (currentUser) loadPlayerStats();
  }, [currentUser]);

  const loadPlayerStats = async () => {
    if (!currentUser) return;
    try {
      const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const { data: matches } = await supabase
        .from("matches")
        .select("id, winner_id, player1_id, player2_id")
        .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
        .gte("date", thirtyDaysAgo);
      const matchesPlayed = matches?.length || 0;
      const wins = matches?.filter(m => m.winner_id === currentUser.id).length || 0;
      const losses = matchesPlayed - wins;
      const { data: teams } = await supabase
        .from("ladder_teams")
        .select("id, team_name, total_points, ladder_id, ladders ( id, name, status )")
        .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`);
      const ladderPositions: { ladderName: string; position: number }[] = [];
      if (teams) {
        for (const team of teams) {
          if (team.ladders && (team.ladders as any).status === "active") {
            const { count } = await supabase
              .from("ladder_teams")
              .select("id", { count: "exact" })
              .eq("ladder_id", team.ladder_id)
              .gt("total_points", team.total_points);
            ladderPositions.push({ ladderName: (team.ladders as any).name, position: (count || 0) + 1 });
          }
        }
      }
      setStats({ matchesPlayed, wins, losses, ladderPositions });
    } catch (error) {
      console.error("Error loading player stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3"><div className="h-5 bg-muted rounded w-1/3"></div></CardHeader>
        <CardContent><div className="h-28 bg-muted rounded"></div></CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(stats.matchesPlayed, 20);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />Your Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex justify-around py-4">
          <CircularProgress value={stats.matchesPlayed} max={maxValue} label="Matches" sublabel="Last 30 days" color="stroke-primary" />
          <CircularProgress value={stats.wins} max={stats.matchesPlayed || 1} label="Wins" sublabel={stats.wins > 0 ? `+${stats.wins} from last month` : undefined} color="stroke-green-500" />
          <CircularProgress value={stats.losses} max={stats.matchesPlayed || 1} label="Losses" sublabel="Steady performance" color="stroke-muted-foreground" />
        </div>
        {stats.ladderPositions.length > 0 && (
          <div className="border-t pt-4 mt-2">
            <div className="text-sm font-medium flex items-center gap-2 mb-2">
              <Medal className="h-4 w-4 text-amber-500" />Ladder Standings
            </div>
            <div className="space-y-1">
              {stats.ladderPositions.map((pos, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                  <span className="truncate">{pos.ladderName}</span>
                  <span className="font-bold text-compete">#{pos.position}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
