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
import { ArrowDown, ArrowUp, Filter, Star, X } from "lucide-react";
import { ProfileLink } from "@/components/ui/profile-link";
import { LessonPaymentButton } from "./LessonPaymentButton";
import { capitalizeWords, formatLessonTypeDisplay, formatTime12Hour } from "@/lib/textUtils";

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

        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
          <SortIcon className="h-3.5 w-3.5" />
          <span>{sortOrder === "asc" ? "Earliest First" : "Latest First"}</span>
        </div>
      </CardHeader>

      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">
            {requests.length === 0
              ? "No lesson requests yet."
              : "No lessons match your filters."}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((r: LessonRequest) => {
              const isUpcoming = isUpcomingLesson(r);

              return (
                <Card
                  key={r.id}
                  className={`border-l-4 ${
                    r.status === "declined"
                      ? "border-l-destructive"
                      : isUpcoming
                        ? "border-l-primary"
                        : "border-l-muted"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">
                            <ProfileLink userId={r.coach_id}>
                              {r.coach?.full_name || "Coach"}
                            </ProfileLink>
                          </h3>
                          <Badge
                            variant={
                              r.status === "declined"
                                ? "destructive"
                                : r.status === "pending"
                                  ? "secondary"
                                  : "default"
                            }
                          >
                            {statusLabel(r.status)}
                          </Badge>
                          {r.hasReview && <Badge variant="secondary">Reviewed</Badge>}
                        </div>

                        {r.status === "declined" && (
                          <p className="text-xs text-destructive mt-2 bg-destructive/10 p-2 rounded">
                            This lesson request was declined by the coach.
                          </p>
                        )}

                        {r.notes?.includes("[OUTSIDE AVAILABILITY") && r.status === "pending" && (
                          <p className="text-xs text-amber-700 mt-2 bg-amber-100 p-2 rounded">
                            This request is outside the coachs posted availability and is awaiting manual review.
                          </p>
                        )}

                        <div className="mt-2 text-sm text-muted-foreground space-y-1">
                          <p>
                            <strong>Sport:</strong> {capitalizeWords(r.sport)}
                          </p>
                          <p>
                            <strong>Type:</strong> {formatLessonTypeDisplay(r.lesson_type)}
                          </p>
                          <p>
                            <strong>Skill Level:</strong> {capitalizeWords(r.skill_level)}
                          </p>
                          <p>
                            <strong>Date:</strong> {new Date(`${r.preferred_date}T00:00:00`).toLocaleDateString()}
                          </p>
                          <p>
                            <strong>Time:</strong> {formatTime12Hour(r.preferred_time_start)}  {formatTime12Hour(r.preferred_time_end)}
                          </p>
                          {r.location && (
                            <p>
                              <strong>Location:</strong> {r.location}
                            </p>
                          )}
                          {r.coaches?.hourly_rate && (
                            <p>
                              <strong>Rate:</strong> ${r.coaches.hourly_rate}/Hour
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
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
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Leave Review
                          </Button>
                        )}

                        {r.status === "declined" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDismissDeclined(r.id)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
