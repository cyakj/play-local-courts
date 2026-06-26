import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface LessonPackage {
  id: string;
  coachId: string;
  title: string;
  lessonType: string | null;
  durationMin: number;
  price: number;
  numSessions: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export type PackageInsert = Omit<LessonPackage, 'id' | 'coachId' | 'createdAt'>;

function mapRow(row: Record<string, unknown>): LessonPackage {
  return {
    id:          row.id as string,
    coachId:     row.coach_id as string,
    title:       row.title as string,
    lessonType:  row.lesson_type as string | null,
    durationMin: row.duration_min as number,
    price:       Number(row.price),
    numSessions: row.num_sessions as number,
    description: row.description as string | null,
    isActive:    row.is_active as boolean,
    createdAt:   row.created_at as string,
  };
}

// Coach-owned packages — full CRUD
export function useMyLessonPackages() {
  const [packages, setPackages] = useState<LessonPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error: err } = await (supabase as any)
        .from('lesson_packages')
        .select('*')
        .eq('coach_id', user.id)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      setPackages((data ?? []).map(mapRow));
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [tick]);

  async function create(pkg: PackageInsert): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Not authenticated';

    const { error: err } = await (supabase as any).from('lesson_packages').insert({
      coach_id:     user.id,
      title:        pkg.title,
      lesson_type:  pkg.lessonType ?? null,
      duration_min: pkg.durationMin,
      price:        pkg.price,
      num_sessions: pkg.numSessions,
      description:  pkg.description ?? null,
      is_active:    pkg.isActive,
    });

    if (err) return err.message;
    refresh();
    return null;
  }

  async function update(id: string, pkg: Partial<PackageInsert>): Promise<string | null> {
    const updates: Record<string, unknown> = {};
    if (pkg.title       !== undefined) updates.title        = pkg.title;
    if (pkg.lessonType  !== undefined) updates.lesson_type  = pkg.lessonType;
    if (pkg.durationMin !== undefined) updates.duration_min = pkg.durationMin;
    if (pkg.price       !== undefined) updates.price        = pkg.price;
    if (pkg.numSessions !== undefined) updates.num_sessions = pkg.numSessions;
    if (pkg.description !== undefined) updates.description  = pkg.description;
    if (pkg.isActive    !== undefined) updates.is_active    = pkg.isActive;

    const { error: err } = await (supabase as any).from('lesson_packages').update(updates).eq('id', id);
    if (err) return err.message;
    refresh();
    return null;
  }

  async function toggleActive(id: string, current: boolean): Promise<string | null> {
    return update(id, { isActive: !current });
  }

  async function remove(id: string): Promise<string | null> {
    const { error: err } = await (supabase as any).from('lesson_packages').delete().eq('id', id);
    if (err) return err.message;
    refresh();
    return null;
  }

  return { packages, loading, error, refresh, create, update, toggleActive, remove };
}

// Player-facing — active packages for a specific coach
export function useCoachPackages(coachUserId: string | null) {
  const [packages, setPackages] = useState<LessonPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coachUserId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (supabase as any)
      .from('lesson_packages')
      .select('*')
      .eq('coach_id', coachUserId)
      .eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data, error: err }: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setPackages((data ?? []).map(mapRow));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [coachUserId]);

  return { packages, loading, error };
}
