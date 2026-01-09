import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDown, ArrowUp, Filter, Star, X, ClipboardList } from "lucide-react";
import { ProfileLink } from "@/components/ui/profile-link";
import { LessonPaymentButton } from "./LessonPaymentButton";
import { capitalizeWords, formatLessonTypeDisplay, formatTime12Hour } from "@/lib/textUtils";
import LessonPlanDialog from "@/components/coach/LessonPlanDialog";

type SortOrder = "asc" | "desc";

type LessonRequest = any;

interface PlayerLessonRequestsListProps {
  requests: LessonRequest[];
  onLeaveReview: (lesson: LessonRequest) => void;
  onDismissDeclined: (requestId: string) => void;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isUpcomingLesson(r: LessonRequest) {
  const lessonDate = new Date(`${r.preferred_date}T00:00:00`);
  return ["accepted", "confirmed"].includes(r.status) && lessonDate >= startOfToday();
}

function statusLabel(status: string | null | undefined) {
  return capitalizeWords(status || "");
}

export default function PlayerLessonRequestsList({
  requests,
  onLeaveReview,
  onDismissDeclined,
}: PlayerLessonRequestsListProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [lessonPlanOpen, setLessonPlanOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonRequest | null>(null);

  const lessonTypes = useMemo(
    () => [...new Set(requests.map((r) => r.lesson_type))].filter(Boolean),
    [requests]
  );

  const hasActiveFilters =
    statusFilter !== "all" || typeFilter.length > 0 || !!search.trim();

  const filtered = useMemo(() => {
    let result = [...requests];

    if (statusFilter === "upcoming") {
      result = result.filter(isUpcomingLesson);
    } else if (statusFilter === "past") {
      const today = startOfToday();
      result = result.filter((r) => new Date(`${r.preferred_date}T00:00:00`) < today);
    } else if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (typeFilter.length > 0) {
      result = result.filter((r) => typeFilter.includes(r.lesson_type));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => {
        const coachName = r.coach?.full_name || "";
        const sport = r.sport || "";
        const location = r.location || "";
        return (
          coachName.toLowerCase().includes(q) ||
          sport.toLowerCase().includes(q) ||
          location.toLowerCase().includes(q)
        );
      });
    }

    result.sort((a, b) => {
      const aKey = `${a.preferred_date} ${a.preferred_time_start || ""}`;
      const bKey = `${b.preferred_date} ${b.preferred_time_start || ""}`;
      if (sortOrder === "asc") return aKey < bKey ? -1 : 1;
      return aKey > bKey ? -1 : 1;
    });

    return result;
  }, [requests, sortOrder, statusFilter, typeFilter, search]);

  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter([]);
    setSearch("");
  };

  const SortIcon = sortOrder === "asc" ? ArrowUp : ArrowDown;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Lessons & Requests</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {Number(statusFilter !== "all") + typeFilter.length + Number(!!search.trim())}
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="past">Past</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Earliest First</SelectItem>
                <SelectItem value="desc">Latest First</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Type {typeFilter.length > 0 && `(${typeFilter.length})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Lesson Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {lessonTypes.map((type) => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={typeFilter.includes(type)}
                    onCheckedChange={(checked) => {
                      setTypeFilter((prev) =>
                        checked ? [...prev, type] : prev.filter((t) => t !== type)
                      );
                    }}
                  >
                    {formatLessonTypeDisplay(type)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              placeholder="Search coach, sport, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[220px]"
            />
          </div>
        )}

      </CardHeader>

      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">
            {requests.length === 0
              ? "No sent requests"
              : "No lessons match your filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">#</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Coach</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Sport</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Skill</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                    <button 
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    >
                      Date <SortIcon className="h-4 w-4" />
                    </button>
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Location</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Notes</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: LessonRequest, index: number) => (
                  <tr key={r.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-3 text-sm text-muted-foreground">{index + 1}</td>
                    <td className="p-3">
                      <ProfileLink userId={r.coach_id}>
                        <span className="font-medium text-sm">
                          {r.coach?.full_name || "Coach"}
                        </span>
                      </ProfileLink>
                    </td>
                    <td className="p-3 text-sm">{capitalizeWords(r.sport)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {formatLessonTypeDisplay(r.lesson_type)}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm">{capitalizeWords(r.skill_level)}</td>
                    <td className="p-3 text-sm">{r.preferred_date}</td>
                    <td className="p-3 text-sm whitespace-nowrap">
                      {formatTime12Hour(r.preferred_time_start)}
                    </td>
                    <td className="p-3 text-sm max-w-[150px] truncate" title={r.location}>
                      {r.location || "-"}
                    </td>
                    <td className="p-3 text-sm max-w-[150px] truncate" title={r.notes}>
                      {r.notes || "-"}
                    </td>
                    <td className="p-3">
                      <Badge 
                        variant={
                          r.status === "pending" ? "secondary" :
                          r.status === "accepted" || r.status === "confirmed" ? "default" :
                          r.status === "declined" ? "destructive" : "outline"
                        }
                        className={`text-xs ${r.status === "accepted" || r.status === "confirmed" ? "bg-green-600 hover:bg-green-700" : ""}`}
                      >
                        {statusLabel(r.status)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {r.status === "accepted" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLesson(r);
                              setLessonPlanOpen(true);
                            }}
                            className="h-8"
                          >
                            <ClipboardList className="h-4 w-4 mr-1" />
                            Lesson Overview
                          </Button>
                        )}
                        {r.status === "accepted" && r.coaches?.hourly_rate && (
                          <LessonPaymentButton
                            lessonRequestId={r.id}
                            coachId={r.coach_id}
                            amount={r.coaches.hourly_rate}
                            status={r.status}
                          />
                        )}
                        {r.status === "accepted" && !r.hasReview && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onLeaveReview(r)}
                            className="h-8"
                          >
                            <Star className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        )}
                        {r.status === "declined" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDismissDeclined(r.id)}
                            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Lesson Plan Dialog */}
      {selectedLesson && (
        <LessonPlanDialog
          lessonRequestId={selectedLesson.id}
          coachId={selectedLesson.coach_id}
          isCoach={false}
          open={lessonPlanOpen}
          onOpenChange={setLessonPlanOpen}
        />
      )}
    </Card>
  );
}
