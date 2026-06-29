import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type {
  BlockoutType,
  CoachBlockout,
  CoachGlobalHour,
  CoachTeachingBlock,
  TeachingLocationType,
} from '@/types/coachSchedule';
import { createDraftId, DAY_NAMES, formatTime } from '@/types/coachSchedule';
import { ChoiceChips, ScheduleField } from './ScheduleEntrySheet';
import { ScheduleTimePicker } from './ScheduleTimePicker';

const BLOCKOUT_TYPES: { value: BlockoutType; label: string }[] = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'personal', label: 'Personal' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'facility_unavailable', label: 'Facility unavailable' },
  { value: 'travel_time', label: 'Travel time' },
  { value: 'other', label: 'Other' },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyBlock(coachId: string, day: number): CoachTeachingBlock {
  return {
    id: createDraftId('teaching'),
    coach_id: coachId,
    day_of_week: day,
    start_time: '09:00',
    end_time: '10:00',
    location_type: 'facility',
    facility_name: null,
    court_type: null,
    travel_radius_miles: null,
    areas_served: [],
    travel_notes: null,
    publicly_bookable: true,
    is_active: true,
  };
}

function emptyBlockout(coachId: string, day: number): CoachBlockout {
  return {
    id: createDraftId('blockout'),
    coach_id: coachId,
    type: 'lunch',
    title: null,
    days_of_week: [day],
    start_time: '12:00',
    end_time: '13:00',
    specific_date: null,
    visibility: 'show_as_unavailable',
  };
}

function locationLabel(type: TeachingLocationType): string {
  if (type === 'either') return 'Either';
  return type === 'facility' ? 'Facility' : 'Travel';
}

function validate(
  boundary: CoachGlobalHour,
  blocks: CoachTeachingBlock[],
  blockouts: CoachBlockout[],
): string | null {
  if (!boundary.is_closed && boundary.end_time <= boundary.start_time) {
    return 'Boundary end time must be after the start time.';
  }

  if (boundary.is_closed && blocks.length > 0) {
    return 'Remove teaching blocks or activate the day before saving.';
  }

  const sorted = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (let index = 0; index < sorted.length; index += 1) {
    const block = sorted[index];
    if (block.end_time <= block.start_time) {
      return 'Every teaching block must end after it starts.';
    }
    if (block.start_time < boundary.start_time || block.end_time > boundary.end_time) {
      return 'Teaching blocks must remain within your coaching boundary.';
    }
    if (index > 0 && sorted[index - 1].end_time > block.start_time) {
      return 'Teaching blocks cannot overlap. Use Either when both facility and travel are available.';
    }
    if ((block.location_type === 'facility' || block.location_type === 'either') && !block.facility_name?.trim()) {
      return `${locationLabel(block.location_type)} blocks require a facility name.`;
    }
    if ((block.location_type === 'travel' || block.location_type === 'either')
      && (!block.travel_radius_miles || block.travel_radius_miles <= 0)) {
      return `${locationLabel(block.location_type)} blocks require a travel radius.`;
    }
  }

  for (const blockout of blockouts) {
    if (!blockout.start_time || !blockout.end_time || blockout.end_time <= blockout.start_time) {
      return 'Every unavailable time must end after it starts.';
    }
  }
  return null;
}

export function CoachDaySetupSheet({
  visible,
  coachId,
  day,
  boundary,
  teachingBlocks,
  blockouts,
  focusBlockId,
  focusBlockoutId,
  onClose,
  onApply,
}: {
  visible: boolean;
  coachId: string;
  day: number;
  boundary: CoachGlobalHour;
  teachingBlocks: CoachTeachingBlock[];
  blockouts: CoachBlockout[];
  focusBlockId?: string;
  focusBlockoutId?: string;
  onClose: () => void;
  onApply: (
    boundary: CoachGlobalHour,
    teachingBlocks: CoachTeachingBlock[],
    blockouts: CoachBlockout[],
  ) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const [boundaryDraft, setBoundaryDraft] = useState(() => clone(boundary));
  const [blocksDraft, setBlocksDraft] = useState(() => clone(teachingBlocks));
  const [blockoutsDraft, setBlockoutsDraft] = useState(() => clone(blockouts));
  const [editingBlock, setEditingBlock] = useState<CoachTeachingBlock | null>(null);
  const [editingBlockout, setEditingBlockout] = useState<CoachBlockout | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBoundaryDraft(clone(boundary));
    setBlocksDraft(clone(teachingBlocks));
    setBlockoutsDraft(clone(blockouts));
    setValidation(null);
    setEditingBlock(
      focusBlockId ? clone(teachingBlocks.find(item => item.id === focusBlockId) ?? null) : null,
    );
    setEditingBlockout(
      focusBlockoutId ? clone(blockouts.find(item => item.id === focusBlockoutId) ?? null) : null,
    );
  }, [
    blockouts,
    boundary,
    focusBlockId,
    focusBlockoutId,
    teachingBlocks,
    visible,
  ]);

  function applyDay() {
    const error = validate(boundaryDraft, blocksDraft, blockoutsDraft);
    if (error) {
      setValidation(error);
      return;
    }
    onApply(
      boundaryDraft,
      boundaryDraft.is_closed ? [] : blocksDraft,
      blockoutsDraft,
    );
  }

  function setInactive() {
    if (blocksDraft.length === 0) {
      setBoundaryDraft({ ...boundaryDraft, is_closed: true });
      return;
    }
    Alert.alert(
      'Make this day inactive?',
      'Teaching blocks for this day will be removed from the schedule draft.',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Make Inactive',
          style: 'destructive',
          onPress: () => {
            setBoundaryDraft({ ...boundaryDraft, is_closed: true });
            setBlocksDraft([]);
          },
        },
      ],
    );
  }

  function saveBlock() {
    if (!editingBlock) return;
    const next = [...blocksDraft.filter(item => item.id !== editingBlock.id), editingBlock]
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const error = validate(boundaryDraft, next, blockoutsDraft);
    if (error) {
      setValidation(error);
      return;
    }
    setBlocksDraft(next);
    setEditingBlock(null);
    setValidation(null);
  }

  function saveBlockout() {
    if (!editingBlockout) return;
    const next = [...blockoutsDraft.filter(item => item.id !== editingBlockout.id), editingBlockout]
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
    const error = validate(boundaryDraft, blocksDraft, next);
    if (error) {
      setValidation(error);
      return;
    }
    setBlockoutsDraft(next);
    setEditingBlockout(null);
    setValidation(null);
  }

  const timeline = useMemo(() => [
    ...blocksDraft.map(item => ({
      id: item.id,
      start: item.start_time,
      end: item.end_time,
      code: item.location_type === 'facility' ? 'F' : item.location_type === 'travel' ? 'T' : 'E',
      title: locationLabel(item.location_type),
      detail: item.location_type === 'facility'
        ? item.facility_name
        : item.location_type === 'travel'
          ? `${item.travel_radius_miles ?? 0} mile radius`
          : `${item.facility_name ?? 'Facility'} or ${item.travel_radius_miles ?? 0} mile travel`,
    })),
    ...blockoutsDraft.map(item => ({
      id: item.id,
      start: item.start_time ?? '00:00',
      end: item.end_time ?? '23:59',
      code: 'U',
      title: 'Unavailable',
      detail: BLOCKOUT_TYPES.find(option => option.value === item.type)?.label ?? 'Unavailable',
    })),
  ].sort((a, b) => a.start.localeCompare(b.start)), [blocksDraft, blockoutsDraft]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{DAY_NAMES[day]} Setup</Text>
              <Text style={styles.subtitle}>Boundary, teaching blocks, and unavailable times</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {!!validation && <Text style={styles.validation}>{validation}</Text>}

            <SetupSection title="Coaching Boundary">
              <ChoiceChips
                label="STATUS"
                value={boundaryDraft.is_closed ? 'inactive' : 'active'}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                onChange={value => {
                  if (value === 'inactive') setInactive();
                  else setBoundaryDraft({ ...boundaryDraft, is_closed: false });
                }}
              />
              {!boundaryDraft.is_closed && (
                <View style={styles.timePair}>
                  <View style={styles.timeField}>
                    <ScheduleTimePicker
                      label="START TIME"
                      value={boundaryDraft.start_time}
                      onChange={start_time => setBoundaryDraft({ ...boundaryDraft, start_time })}
                    />
                  </View>
                  <View style={styles.timeField}>
                    <ScheduleTimePicker
                      label="END TIME"
                      value={boundaryDraft.end_time}
                      onChange={end_time => setBoundaryDraft({ ...boundaryDraft, end_time })}
                    />
                  </View>
                </View>
              )}
            </SetupSection>

            <SetupSection
              title="Teaching Blocks"
              action={
                !boundaryDraft.is_closed ? (
                  <AddButton onPress={() => setEditingBlock(emptyBlock(coachId, day))} />
                ) : null
              }>
              {boundaryDraft.is_closed ? (
                <Text style={styles.empty}>Activate this day before adding teaching blocks.</Text>
              ) : blocksDraft.length === 0 ? (
                <Text style={styles.empty}>No teaching blocks for this day.</Text>
              ) : blocksDraft.map(block => (
                <RuleRow
                  key={block.id}
                  code={block.location_type === 'facility' ? 'F' : block.location_type === 'travel' ? 'T' : 'E'}
                  color={block.location_type === 'facility' ? Colors.blue : block.location_type === 'travel' ? Colors.volt : Colors.cyan}
                  title={locationLabel(block.location_type)}
                  time={`${formatTime(block.start_time)} - ${formatTime(block.end_time)}`}
                  detail={block.location_type === 'travel'
                    ? `${block.travel_radius_miles ?? 0} mile radius`
                    : block.facility_name ?? undefined}
                  onEdit={() => setEditingBlock(clone(block))}
                  onRemove={() => setBlocksDraft(blocksDraft.filter(item => item.id !== block.id))}
                />
              ))}
            </SetupSection>

            {editingBlock && (
              <SetupSection title={editingBlock.id.startsWith('draft-') ? 'Add Teaching Block' : 'Edit Teaching Block'}>
                <View style={styles.timePair}>
                  <View style={styles.timeField}>
                    <ScheduleTimePicker label="START TIME" value={editingBlock.start_time} onChange={start_time => setEditingBlock({ ...editingBlock, start_time })} />
                  </View>
                  <View style={styles.timeField}>
                    <ScheduleTimePicker label="END TIME" value={editingBlock.end_time} onChange={end_time => setEditingBlock({ ...editingBlock, end_time })} />
                  </View>
                </View>
                <ChoiceChips
                  label="LOCATION TYPE"
                  value={editingBlock.location_type}
                  options={[
                    { value: 'facility', label: 'Facility' },
                    { value: 'travel', label: 'Travel' },
                    { value: 'either', label: 'Either' },
                  ]}
                  onChange={location_type => setEditingBlock({
                    ...editingBlock,
                    location_type,
                    facility_name: location_type === 'travel' ? null : editingBlock.facility_name,
                    court_type: location_type === 'travel' ? null : editingBlock.court_type,
                    travel_radius_miles: location_type === 'facility'
                      ? null
                      : editingBlock.travel_radius_miles,
                    areas_served: location_type === 'facility' ? [] : editingBlock.areas_served,
                    travel_notes: location_type === 'facility' ? null : editingBlock.travel_notes,
                  })}
                />
                <ChoiceChips
                  label="BOOKING VISIBILITY"
                  value={editingBlock.publicly_bookable ? 'public' : 'private'}
                  options={[
                    { value: 'public', label: 'Public' },
                    { value: 'private', label: 'Private / Internal' },
                  ]}
                  onChange={value => setEditingBlock({
                    ...editingBlock,
                    publicly_bookable: value === 'public',
                  })}
                />
                {(editingBlock.location_type === 'facility' || editingBlock.location_type === 'either') && (
                  <>
                    <ScheduleField label="FACILITY NAME" value={editingBlock.facility_name ?? ''} onChangeText={facility_name => setEditingBlock({ ...editingBlock, facility_name })} placeholder="Riverside Tennis Club" />
                    <ScheduleField label="COURT TYPE (OPTIONAL)" value={editingBlock.court_type ?? ''} onChangeText={court_type => setEditingBlock({ ...editingBlock, court_type })} placeholder="Hard, clay, indoor" />
                  </>
                )}
                {(editingBlock.location_type === 'travel' || editingBlock.location_type === 'either') && (
                  <>
                    <ScheduleField
                      label="TRAVEL RADIUS (MILES)"
                      value={editingBlock.travel_radius_miles?.toString() ?? ''}
                      onChangeText={value => setEditingBlock({
                        ...editingBlock,
                        travel_radius_miles: value ? Number(value) : null,
                      })}
                      keyboardType="numeric"
                      placeholder="10"
                    />
                    <ScheduleField
                      label="AREAS SERVED"
                      value={editingBlock.areas_served.join(', ')}
                      onChangeText={value => setEditingBlock({
                        ...editingBlock,
                        areas_served: value.split(',').map(item => item.trim()).filter(Boolean),
                      })}
                      placeholder="Dorado, San Juan"
                    />
                    <ScheduleField label="TRAVEL NOTES (OPTIONAL)" value={editingBlock.travel_notes ?? ''} onChangeText={travel_notes => setEditingBlock({ ...editingBlock, travel_notes })} placeholder="Travel conditions" multiline />
                  </>
                )}
                <EditorActions onCancel={() => setEditingBlock(null)} onSave={saveBlock} />
              </SetupSection>
            )}

            <SetupSection
              title="Unavailable Times"
              action={<AddButton onPress={() => setEditingBlockout(emptyBlockout(coachId, day))} />}>
              <Text style={styles.helper}>Players only see unavailable. Types and notes remain private.</Text>
              {blockoutsDraft.length === 0 ? (
                <Text style={styles.empty}>No unavailable times for this day.</Text>
              ) : blockoutsDraft.map(blockout => (
                <RuleRow
                  key={blockout.id}
                  code="U"
                  color="#5A6379"
                  title={BLOCKOUT_TYPES.find(option => option.value === blockout.type)?.label ?? 'Unavailable'}
                  time={`${formatTime(blockout.start_time)} - ${formatTime(blockout.end_time)}`}
                  detail={[
                    blockout.specific_date ? `Specific date: ${blockout.specific_date}` : null,
                    blockout.title,
                  ].filter(Boolean).join(' · ') || undefined}
                  onEdit={() => setEditingBlockout(clone(blockout))}
                  onRemove={() => setBlockoutsDraft(blockoutsDraft.filter(item => item.id !== blockout.id))}
                />
              ))}
            </SetupSection>

            {editingBlockout && (
              <SetupSection title={editingBlockout.id.startsWith('draft-') ? 'Add Unavailable Time' : 'Edit Unavailable Time'}>
                <View style={styles.timePair}>
                  <View style={styles.timeField}>
                    <ScheduleTimePicker label="START TIME" value={editingBlockout.start_time ?? '12:00'} onChange={start_time => setEditingBlockout({ ...editingBlockout, start_time })} />
                  </View>
                  <View style={styles.timeField}>
                    <ScheduleTimePicker label="END TIME" value={editingBlockout.end_time ?? '13:00'} onChange={end_time => setEditingBlockout({ ...editingBlockout, end_time })} />
                  </View>
                </View>
                <ChoiceChips label="TYPE" value={editingBlockout.type} options={BLOCKOUT_TYPES} onChange={type => setEditingBlockout({ ...editingBlockout, type })} />
                <ScheduleField label="INTERNAL NOTE (OPTIONAL)" value={editingBlockout.title ?? ''} onChangeText={title => setEditingBlockout({ ...editingBlockout, title })} placeholder="Only you can see this note" multiline />
                <EditorActions onCancel={() => setEditingBlockout(null)} onSave={saveBlockout} />
              </SetupSection>
            )}

            <SetupSection title={`${DAY_NAMES[day]} Timeline`}>
              {timeline.length === 0 ? (
                <Text style={styles.empty}>No teaching blocks or unavailable times.</Text>
              ) : timeline.map(item => (
                <View key={`${item.code}-${item.id}`} style={styles.timelineRow}>
                  <View style={[
                    styles.timelineCode,
                    item.code === 'F' && styles.facilityCode,
                    item.code === 'T' && styles.travelCode,
                    item.code === 'E' && styles.eitherCode,
                    item.code === 'U' && styles.unavailableCode,
                  ]}>
                    <Text style={[styles.timelineCodeText, (item.code === 'T' || item.code === 'E') && styles.darkCodeText]}>{item.code}</Text>
                  </View>
                  <View style={styles.timelineCopy}>
                    <Text style={styles.timelineTime}>{formatTime(item.start)} - {formatTime(item.end)}</Text>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    {!!item.detail && <Text style={styles.timelineDetail}>{item.detail}</Text>}
                  </View>
                </View>
              ))}
            </SetupSection>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelLabel}>Cancel Day Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={applyDay}>
              <Text style={styles.applyLabel}>Apply Day to Draft</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SetupSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function AddButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <TouchableOpacity style={styles.addButton} onPress={onPress}>
      <Plus size={20} color="#F5F8FF" />
    </TouchableOpacity>
  );
}

function RuleRow({
  code,
  color,
  title,
  time,
  detail,
  onEdit,
  onRemove,
}: {
  code: string;
  color: string;
  title: string;
  time: string;
  detail?: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.ruleRow}>
      <View style={[styles.ruleCode, { backgroundColor: color }]}>
        <Text style={[styles.ruleCodeText, (code === 'T' || code === 'E') && styles.darkCodeText]}>{code}</Text>
      </View>
      <View style={styles.ruleCopy}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleTime}>{time}</Text>
        {!!detail && <Text style={styles.ruleDetail}>{detail}</Text>}
      </View>
      <TouchableOpacity style={styles.iconButton} onPress={onEdit}>
        <Pencil size={18} color={theme.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconButton} onPress={onRemove}>
        <Trash2 size={18} color={Colors.negative} />
      </TouchableOpacity>
    </View>
  );
}

function EditorActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.editorActions}>
      <TouchableOpacity style={styles.editorCancel} onPress={onCancel}>
        <Text style={styles.editorCancelText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.editorSave} onPress={onSave}>
        <Text style={styles.editorSaveText}>Add to Day</Text>
      </TouchableOpacity>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.backdrop },
    sheet: {
      maxHeight: '96%',
      minHeight: '88%',
      backgroundColor: theme.sheetBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowSheet,
    },
    header: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: Spacing.pagePx,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
    },
    subtitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
    },
    closeButton: { width: 60, height: 60, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center' },
    content: { padding: Spacing.pagePx, gap: 18, paddingBottom: 28 },
    validation: {
      padding: 12,
      borderRadius: Radius.sm,
      backgroundColor: 'rgba(255,92,107,0.10)',
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: Colors.negative,
    },
    section: {
      gap: 14,
      padding: Spacing.cardPadding,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sectionTitle: {
      flex: 1,
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    addButton: {
      width: 48,
      height: 48,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.blue,
    },
    timePair: { flexDirection: 'row', gap: 10 },
    timeField: { flex: 1 },
    empty: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textMuted,
    },
    helper: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textSecondary,
    },
    ruleRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface2,
    },
    ruleCode: { width: 36, height: 36, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center' },
    ruleCodeText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, color: '#F5F8FF' },
    darkCodeText: { color: '#0C0F18' },
    ruleCopy: { flex: 1, gap: 2 },
    ruleTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    ruleTime: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    ruleDetail: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
    },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    editorActions: { flexDirection: 'row', gap: 10 },
    editorCancel: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
    },
    editorCancelText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    editorSave: {
      flex: 1.4,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.button,
      backgroundColor: Colors.blue,
    },
    editorSaveText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: '#F5F8FF',
    },
    timelineRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    timelineCode: { width: 38, height: 38, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center' },
    facilityCode: { backgroundColor: Colors.blue },
    travelCode: { backgroundColor: Colors.volt },
    eitherCode: { backgroundColor: Colors.cyan },
    unavailableCode: { backgroundColor: '#5A6379' },
    timelineCodeText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, color: '#F5F8FF' },
    timelineCopy: { flex: 1, gap: 2, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    timelineTime: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: Colors.cyan,
    },
    timelineTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    timelineDetail: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      padding: Spacing.pagePx,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.navBg,
    },
    cancelButton: {
      flex: 1,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
    },
    cancelLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 12,
      color: theme.textSecondary,
    },
    applyButton: {
      flex: 1.3,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.button,
      backgroundColor: Colors.blue,
    },
    applyLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 12,
      color: '#F5F8FF',
    },
  }), [theme]);
}
