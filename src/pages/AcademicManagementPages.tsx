import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Calendar as CalendarIcon,
  Users,
  UserCheck,
  BookOpen,
  Building2,
} from 'lucide-react';
import {
  AcademicCalendar,
  Classroom,
  PeriodDefinition,
  RoomType,
  SessionType,
  StudentSection,
  SubjectRequirement,
  Teacher,
  Weekday,
} from '../types/timetable';

const ALL_WEEKDAYS: Weekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const ROOM_TYPES: RoomType[] = [
  'Classroom',
  'Computer Lab',
  'Science Lab',
  'Seminar Hall',
];

const SUBJECT_COLORS = [
  '#4f46e5',
  '#0d9488',
  '#0284c7',
  '#7c3aed',
  '#d97706',
  '#059669',
  '#e11d48',
  '#2563eb',
];

// ============================================================================
// 1. ACADEMIC SETUP PAGE (Calendar, Working Days, Periods, Breaks)
// ============================================================================
interface AcademicSetupPageProps {
  calendar: AcademicCalendar;
  onUpdateCalendar: (updated: AcademicCalendar, logMsg: string) => void;
}

export const AcademicSetupPage: React.FC<AcademicSetupPageProps> = ({
  calendar,
  onUpdateCalendar,
}) => {
  const [instName, setInstName] = useState(calendar.institutionName);
  const [dept, setDept] = useState(calendar.department);
  const [acadYear, setAcadYear] = useState(calendar.academicYear);
  const [semester, setSemester] = useState(calendar.semester);
  const [savedBanner, setSavedBanner] = useState(false);

  React.useEffect(() => {
    setInstName(calendar.institutionName);
    setDept(calendar.department);
    setAcadYear(calendar.academicYear);
    setSemester(calendar.semester);
  }, [calendar]);

  const handleSaveInstitution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instName.trim()) return;
    onUpdateCalendar(
      {
        ...calendar,
        institutionName: instName.trim(),
        department: dept.trim(),
        academicYear: acadYear.trim(),
        semester: semester.trim(),
      },
      'Updated institution and semester metadata'
    );
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const toggleWorkingDay = (day: Weekday) => {
    const exists = calendar.workingDays.includes(day);
    if (exists && calendar.workingDays.length <= 1) return; // Keep at least 1 day
    const updatedDays = ALL_WEEKDAYS.filter((d) =>
      d === day ? !exists : calendar.workingDays.includes(d)
    );
    onUpdateCalendar(
      { ...calendar, workingDays: updatedDays },
      `Updated working days (${updatedDays.join(', ')})`
    );
  };

  const handleUpdatePeriod = (
    periodNumber: number,
    field: keyof PeriodDefinition,
    value: string | boolean
  ) => {
    const updatedPeriods = calendar.periods.map((p) =>
      p.periodNumber === periodNumber ? { ...p, [field]: value } : p
    );
    onUpdateCalendar(
      { ...calendar, periods: updatedPeriods },
      `Modified Period ${periodNumber} configuration`
    );
  };

  const handleAddPeriod = () => {
    const nextNum =
      calendar.periods.length > 0
        ? Math.max(...calendar.periods.map((p) => p.periodNumber)) + 1
        : 1;
    const newPeriod: PeriodDefinition = {
      periodNumber: nextNum,
      name: `Period ${calendar.periods.filter((p) => !p.isBreak).length + 1}`,
      startTime: '15:10',
      endTime: '16:00',
      isBreak: false,
    };
    onUpdateCalendar(
      { ...calendar, periods: [...calendar.periods, newPeriod] },
      `Added ${newPeriod.name} to daily schedule`
    );
  };

  const handleRemoveLastPeriod = () => {
    if (calendar.periods.length <= 2) return;
    const updated = calendar.periods.slice(0, -1);
    onUpdateCalendar(
      { ...calendar, periods: updated },
      'Removed last period from daily schedule'
    );
  };

  const toggleInstitutionalUnavailableSlot = (slotKey: string) => {
    const exists = calendar.unavailableSlots.includes(slotKey);
    const nextSlots = exists
      ? calendar.unavailableSlots.filter((k) => k !== slotKey)
      : [...calendar.unavailableSlots, slotKey];
    onUpdateCalendar(
      { ...calendar, unavailableSlots: nextSlots },
      `${exists ? 'Enabled' : 'Blocked'} institutional time slot ${slotKey}`
    );
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Academic Calendar & Schedule Configuration
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure working days (Monday–Saturday), daily periods, lunch breaks, and institutional slot availability.
            </p>
          </div>
          {savedBanner && (
            <span className="text-xs font-semibold text-emerald-700">
              Changes saved to local storage
            </span>
          )}
        </div>

        <form onSubmit={handleSaveInstitution} className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institution Name
            </label>
            <input
              type="text"
              value={instName}
              onChange={(e) => setInstName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department
            </label>
            <input
              type="text"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Year
            </label>
            <input
              type="text"
              value={acadYear}
              onChange={(e) => setAcadYear(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Semester / Term
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer whitespace-nowrap shrink-0"
              >
                Save Info
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Working Days Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          Working Days (Monday to Saturday)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Enable or disable Saturday or any weekday. The graph-coloring candidate slot generator adapts automatically.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {ALL_WEEKDAYS.map((day) => {
            const active = calendar.workingDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleWorkingDay(day)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {active ? `✓ ${day}` : day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Periods & Break Configuration */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Daily Periods & Lunch/Break Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Periods marked as a Break are strictly excluded from graph coloring and cannot be crossed by consecutive 2-period laboratories.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddPeriod}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add Period
            </button>
            <button
              type="button"
              onClick={handleRemoveLastPeriod}
              disabled={calendar.periods.length <= 2}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
            >
              Remove Last
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3">Slot #</th>
                <th className="py-2.5 px-3">Period Label</th>
                <th className="py-2.5 px-3">Start Time</th>
                <th className="py-2.5 px-3">End Time</th>
                <th className="py-2.5 px-3">Slot Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {calendar.periods.map((p) => (
                <tr key={p.periodNumber} className={p.isBreak ? 'bg-amber-50/40' : ''}>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 tabular-nums">
                    P{p.periodNumber}
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) =>
                        handleUpdatePeriod(p.periodNumber, 'name', e.target.value)
                      }
                      className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs w-44 bg-white"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="time"
                      value={p.startTime}
                      onChange={(e) =>
                        handleUpdatePeriod(p.periodNumber, 'startTime', e.target.value)
                      }
                      className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono bg-white"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="time"
                      value={p.endTime}
                      onChange={(e) =>
                        handleUpdatePeriod(p.periodNumber, 'endTime', e.target.value)
                      }
                      className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono bg-white"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdatePeriod(p.periodNumber, 'isBreak', !p.isBreak)
                      }
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                        p.isBreak
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {p.isBreak ? 'Lunch / Break (No Classes)' : 'Teaching Period'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Institutional Slot Availability Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          Institutional Time-Slot Availability Matrix
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Click any teaching cell to toggle whether that period is open for scheduling across the institution.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2 px-3">Day</th>
                {calendar.periods.map((p) => (
                  <th key={p.periodNumber} className="py-2 px-2 text-center">
                    <div>{p.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      P{p.periodNumber}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {calendar.workingDays.map((day) => (
                <tr key={day}>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{day}</td>
                  {calendar.periods.map((p) => {
                    const key = `${day}-P${p.periodNumber}`;
                    if (p.isBreak) {
                      return (
                        <td
                          key={p.periodNumber}
                          className="py-2 px-2 text-center bg-amber-50/60 text-amber-800 font-medium text-[11px]"
                        >
                          Break
                        </td>
                      );
                    }
                    const blocked = calendar.unavailableSlots.includes(key);
                    return (
                      <td key={p.periodNumber} className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleInstitutionalUnavailableSlot(key)}
                          className={`w-full py-1.5 px-2 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                            blocked
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-emerald-50/70 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {blocked ? 'Blocked' : 'Available'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. MANAGE STUDENT SECTIONS PAGE
// ============================================================================
interface ManageSectionsPageProps {
  sections: StudentSection[];
  calendar: AcademicCalendar;
  onUpdateSections: (updated: StudentSection[], logMsg: string) => void;
}

export const ManageSectionsPage: React.FC<ManageSectionsPageProps> = ({
  sections,
  calendar,
  onUpdateSections,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [semester, setSemester] = useState('5th Semester');
  const [strength, setStrength] = useState(60);
  const [unavailableSlots, setUnavailableSlots] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const teachingPeriods = calendar.periods.filter((p) => !p.isBreak);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDepartment('Computer Science & Engineering');
    setSemester('5th Semester');
    setStrength(60);
    setUnavailableSlots([]);
    setFormError(null);
  };

  const startEdit = (sec: StudentSection) => {
    setEditingId(sec.id);
    setName(sec.name);
    setDepartment(sec.department);
    setSemester(sec.semester);
    setStrength(sec.studentStrength);
    setUnavailableSlots([...sec.unavailableSlots]);
    setFormError(null);
  };

  const toggleSlot = (slotKey: string) => {
    setUnavailableSlots((prev) =>
      prev.includes(slotKey) ? prev.filter((k) => k !== slotKey) : [...prev, slotKey]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim().toUpperCase();
    if (!trimmedName) {
      setFormError('Section name is required (e.g., CSE-A).');
      return;
    }
    if (strength < 1 || strength > 500) {
      setFormError('Student strength must be between 1 and 500.');
      return;
    }

    const duplicate = sections.some(
      (s) => s.name.toUpperCase() === trimmedName && s.id !== editingId
    );
    if (duplicate) {
      setFormError(`A section named "${trimmedName}" already exists.`);
      return;
    }

    if (editingId) {
      const updated = sections.map((s) =>
        s.id === editingId
          ? {
              ...s,
              name: trimmedName,
              department: department.trim(),
              semester: semester.trim(),
              studentStrength: Number(strength),
              unavailableSlots,
            }
          : s
      );
      onUpdateSections(updated, `Updated student section ${trimmedName}`);
    } else {
      const newSec: StudentSection = {
        id: `SEC-${trimmedName.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString().slice(-3)}`,
        name: trimmedName,
        department: department.trim(),
        semester: semester.trim(),
        studentStrength: Number(strength),
        unavailableSlots,
      };
      onUpdateSections([...sections, newSec], `Added student section ${trimmedName}`);
    }
    resetForm();
  };

  const handleDelete = (sec: StudentSection) => {
    const updated = sections.filter((s) => s.id !== sec.id);
    onUpdateSections(updated, `Deleted student section ${sec.name}`);
    if (editingId === sec.id) resetForm();
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200">
          <Users className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {editingId ? 'Edit Student Section' : 'Add Student Section / Cohort'}
            </h1>
            <p className="text-xs text-slate-500">
              Any two class-session events sharing a student section are connected by a conflict edge in the graph.
            </p>
          </div>
        </div>

        {formError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Section Name (e.g., CSE-A)
              </label>
              <input
                type="text"
                placeholder="CSE-C"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Semester / Year
              </label>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Strength (Enrollment)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
          </div>

          {/* Section Availability Restrictions */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Optional Section Unavailable Slots (Click to toggle restricted periods for this cohort)
            </label>
            <div className="overflow-x-auto border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <div className="flex flex-wrap gap-1.5">
                {calendar.workingDays.map((day) =>
                  teachingPeriods.map((p) => {
                    const key = `${day}-P${p.periodNumber}`;
                    const isUnavail = unavailableSlots.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleSlot(key)}
                        className={`px-2 py-1 text-[11px] font-mono rounded border cursor-pointer transition-colors ${
                          isUnavail
                            ? 'bg-red-100 text-red-800 border-red-300 font-semibold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day.slice(0, 3)}-P{p.periodNumber} {isUnavail ? '(Blocked)' : ''}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {editingId ? 'Save Section Changes' : 'Add Section'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Sections Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          Configured Student Sections ({sections.length})
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3">Section ID</th>
                <th className="py-2.5 px-3">Section Name</th>
                <th className="py-2.5 px-3">Department & Semester</th>
                <th className="py-2.5 px-3 text-right">Strength</th>
                <th className="py-2.5 px-3">Restricted Slots</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {sections.map((sec) => (
                <tr key={sec.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-mono text-slate-500">{sec.id}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">{sec.name}</td>
                  <td className="py-3 px-3 text-slate-600">
                    {sec.department} · {sec.semester}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {sec.studentStrength}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">
                    {sec.unavailableSlots.length > 0
                      ? sec.unavailableSlots.join(', ')
                      : 'All periods available'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => startEdit(sec)}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-md hover:bg-slate-100 cursor-pointer"
                        title="Edit Section"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(sec)}
                        className="p-1.5 text-slate-600 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                        title="Delete Section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. MANAGE TEACHERS PAGE
// ============================================================================
interface ManageTeachersPageProps {
  teachers: Teacher[];
  calendar: AcademicCalendar;
  onUpdateTeachers: (updated: Teacher[], logMsg: string) => void;
}

export const ManageTeachersPage: React.FC<ManageTeachersPageProps> = ({
  teachers,
  calendar,
  onUpdateTeachers,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [qualifiedCodes, setQualifiedCodes] = useState('');
  const [maxDailyLoad, setMaxDailyLoad] = useState(4);
  const [unavailableSlots, setUnavailableSlots] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const teachingPeriods = calendar.periods.filter((p) => !p.isBreak);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDepartment('Computer Science');
    setQualifiedCodes('');
    setMaxDailyLoad(4);
    setUnavailableSlots([]);
    setFormError(null);
  };

  const startEdit = (t: Teacher) => {
    setEditingId(t.id);
    setName(t.name);
    setDepartment(t.department);
    setQualifiedCodes(t.qualifiedSubjectCodes.join(', '));
    setMaxDailyLoad(t.maxDailyLoad);
    setUnavailableSlots([...t.unavailableSlots]);
    setFormError(null);
  };

  const toggleSlot = (slotKey: string) => {
    setUnavailableSlots((prev) =>
      prev.includes(slotKey) ? prev.filter((k) => k !== slotKey) : [...prev, slotKey]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Teacher name is required.');
      return;
    }

    const codes = qualifiedCodes
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    if (editingId) {
      const updated = teachers.map((t) =>
        t.id === editingId
          ? {
              ...t,
              name: name.trim(),
              department: department.trim(),
              qualifiedSubjectCodes: codes,
              maxDailyLoad: Number(maxDailyLoad),
              unavailableSlots,
            }
          : t
      );
      onUpdateTeachers(updated, `Updated teacher ${name.trim()}`);
    } else {
      const nextNum = teachers.length + 1;
      const newTeacher: Teacher = {
        id: `TCH-${String(nextNum).padStart(2, '0')}-${Date.now().toString().slice(-2)}`,
        name: name.trim(),
        department: department.trim(),
        qualifiedSubjectCodes: codes,
        maxDailyLoad: Number(maxDailyLoad),
        unavailableSlots,
      };
      onUpdateTeachers([...teachers, newTeacher], `Added teacher ${name.trim()}`);
    }
    resetForm();
  };

  const handleDelete = (t: Teacher) => {
    onUpdateTeachers(
      teachers.filter((item) => item.id !== t.id),
      `Removed teacher ${t.name}`
    );
    if (editingId === t.id) resetForm();
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200">
          <UserCheck className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {editingId ? 'Edit Faculty Member' : 'Add Faculty Member (Teacher)'}
            </h1>
            <p className="text-xs text-slate-500">
              Teacher availability is enforced as a hard constraint; maximum daily teaching load is tracked as a configurable soft preference.
            </p>
          </div>
        </div>

        {formError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Dr. A. Kulkarni"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Qualified Subject Codes (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="CS301, CS305L"
                value={qualifiedCodes}
                onChange={(e) => setQualifiedCodes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Daily Teaching Load (Periods)
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={maxDailyLoad}
                onChange={(e) => setMaxDailyLoad(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Unavailable Time Slots (Hard Constraint — Click to toggle when teacher cannot teach)
            </label>
            <div className="overflow-x-auto border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <div className="flex flex-wrap gap-1.5">
                {calendar.workingDays.map((day) =>
                  teachingPeriods.map((p) => {
                    const key = `${day}-P${p.periodNumber}`;
                    const isUnavail = unavailableSlots.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleSlot(key)}
                        className={`px-2 py-1 text-[11px] font-mono rounded border cursor-pointer transition-colors ${
                          isUnavail
                            ? 'bg-red-100 text-red-800 border-red-300 font-semibold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day.slice(0, 3)}-P{p.periodNumber} {isUnavail ? '(Unavailable)' : ''}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {editingId ? 'Save Teacher Changes' : 'Add Teacher'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Teachers Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          Faculty Directory ({teachers.length})
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Teacher Name</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Subjects Qualified</th>
                <th className="py-2.5 px-3 text-right">Max Daily Load</th>
                <th className="py-2.5 px-3">Unavailable Slots (Hard Constraint)</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-mono text-slate-500">{t.id}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">{t.name}</td>
                  <td className="py-3 px-3 text-slate-600">{t.department}</td>
                  <td className="py-3 px-3 font-mono text-slate-700">
                    {t.qualifiedSubjectCodes.join(', ') || 'General'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {t.maxDailyLoad} periods/day
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">
                    {t.unavailableSlots.length > 0
                      ? t.unavailableSlots.join(', ')
                      : 'Available all slots'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => startEdit(t)}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-md hover:bg-slate-100 cursor-pointer"
                        title="Edit Teacher"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="p-1.5 text-slate-600 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                        title="Delete Teacher"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. MANAGE SUBJECTS & WEEKLY SESSION REQUIREMENTS PAGE
// ============================================================================
interface ManageSubjectsPageProps {
  subjects: SubjectRequirement[];
  teachers: Teacher[];
  sections: StudentSection[];
  calendar: AcademicCalendar;
  onUpdateSubjects: (updated: SubjectRequirement[], logMsg: string) => void;
}

export const ManageSubjectsPage: React.FC<ManageSubjectsPageProps> = ({
  subjects,
  teachers,
  sections,
  calendar,
  onUpdateSubjects,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>(
    sections[0] ? [sections[0].id] : []
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionDuration, setSessionDuration] = useState(1);
  const [sessionType, setSessionType] = useState<SessionType>('Lecture');
  const [requiredRoomType, setRequiredRoomType] = useState<RoomType>('Classroom');
  const [expectedEnrollment, setExpectedEnrollment] = useState(58);
  const [preferredDays, setPreferredDays] = useState<Weekday[]>([]);
  const [maxSessionsPerDay, setMaxSessionsPerDay] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setTeacherId(teachers[0]?.id || '');
    setSelectedSectionIds(sections[0] ? [sections[0].id] : []);
    setSessionsPerWeek(3);
    setSessionDuration(1);
    setSessionType('Lecture');
    setRequiredRoomType('Classroom');
    setExpectedEnrollment(sections[0]?.studentStrength || 55);
    setPreferredDays([]);
    setMaxSessionsPerDay(1);
    setFormError(null);
  };

  const startEdit = (sub: SubjectRequirement) => {
    setEditingId(sub.id);
    setCode(sub.code);
    setName(sub.name);
    setTeacherId(sub.teacherId);
    setSelectedSectionIds([...sub.sectionIds]);
    setSessionsPerWeek(sub.sessionsPerWeek);
    setSessionDuration(sub.sessionDuration);
    setSessionType(sub.sessionType);
    setRequiredRoomType(sub.requiredRoomType);
    setExpectedEnrollment(sub.expectedEnrollment);
    setPreferredDays([...sub.preferredDays]);
    setMaxSessionsPerDay(sub.maxSessionsPerDay);
    setFormError(null);
  };

  const toggleSectionSelection = (secId: string) => {
    setSelectedSectionIds((prev) => {
      const next = prev.includes(secId)
        ? prev.filter((id) => id !== secId)
        : [...prev, secId];
      // Automatically update expectedEnrollment to sum of participating sections
      const sumStrength = sections
        .filter((s) => next.includes(s.id))
        .reduce((acc, s) => acc + s.studentStrength, 0);
      if (sumStrength > 0) setExpectedEnrollment(sumStrength);
      return next;
    });
  };

  const togglePreferredDay = (day: Weekday) => {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSessionTypeChange = (type: SessionType) => {
    setSessionType(type);
    if (type === 'Laboratory') {
      setSessionDuration(2);
      setSessionsPerWeek(1);
      setRequiredRoomType('Computer Lab');
    } else {
      setSessionDuration(1);
      setSessionsPerWeek(3);
      setRequiredRoomType('Classroom');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setFormError('Subject code and name are required.');
      return;
    }
    if (!teacherId) {
      setFormError('Please select an assigned teacher.');
      return;
    }
    if (selectedSectionIds.length === 0) {
      setFormError('Select at least one participating student section.');
      return;
    }

    const colorHex =
      SUBJECT_COLORS[
        Math.abs(code.trim().charCodeAt(0) + code.trim().length) %
          SUBJECT_COLORS.length
      ];

    if (editingId) {
      const updated = subjects.map((s) =>
        s.id === editingId
          ? {
              ...s,
              code: code.trim().toUpperCase(),
              name: name.trim(),
              teacherId,
              sectionIds: selectedSectionIds,
              sessionsPerWeek: Number(sessionsPerWeek),
              sessionDuration: Number(sessionDuration),
              sessionType,
              requiredRoomType,
              expectedEnrollment: Number(expectedEnrollment),
              preferredDays,
              maxSessionsPerDay: Number(maxSessionsPerDay),
            }
          : s
      );
      onUpdateSubjects(updated, `Updated subject ${code.trim().toUpperCase()}`);
    } else {
      const newSub: SubjectRequirement = {
        id: `SUB-${code.trim().toUpperCase()}-${Date.now().toString().slice(-4)}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        teacherId,
        sectionIds: selectedSectionIds,
        sessionsPerWeek: Number(sessionsPerWeek),
        sessionDuration: Number(sessionDuration),
        sessionType,
        requiredRoomType,
        expectedEnrollment: Number(expectedEnrollment),
        preferredDays,
        preferredSlots: [],
        maxSessionsPerDay: Number(maxSessionsPerDay),
        colorHex,
      };
      onUpdateSubjects([...subjects, newSub], `Added subject ${newSub.code} (${newSub.name})`);
    }
    resetForm();
  };

  const handleDelete = (sub: SubjectRequirement) => {
    onUpdateSubjects(
      subjects.filter((s) => s.id !== sub.id),
      `Deleted subject requirement ${sub.code}`
    );
    if (editingId === sub.id) resetForm();
  };

  const teacherMap = new Map(teachers.map((t) => [t.id, t.name]));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {editingId ? 'Edit Subject & Session Requirement' : 'Add Subject & Class-Session Requirement'}
            </h1>
            <p className="text-xs text-slate-500">
              Each weekly session expands into an individual vertex in the conflict graph. Multi-period laboratories require consecutive periods on the same day.
            </p>
          </div>
        </div>

        {formError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Code
              </label>
              <input
                type="text"
                placeholder="CS307"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Name
              </label>
              <input
                type="text"
                placeholder="Artificial Intelligence"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Teacher
              </label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                required
              >
                <option value="">Select Teacher...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.department})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Session Type
              </label>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['Lecture', 'Laboratory'] as SessionType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSessionTypeChange(type)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                      sessionType === type
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Weekly Meetings (Vertices to Expand)
              </label>
              <input
                type="number"
                min={1}
                max={6}
                value={sessionsPerWeek}
                onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration per Session (Consecutive Periods)
              </label>
              <select
                value={sessionDuration}
                onChange={(e) => setSessionDuration(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
              >
                <option value={1}>1 Period (Standard Lecture)</option>
                <option value={2}>2 Consecutive Periods (Laboratory)</option>
                <option value={3}>3 Consecutive Periods (Extended Lab)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Required Room Type
              </label>
              <select
                value={requiredRoomType}
                onChange={(e) => setRequiredRoomType(e.target.value as RoomType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {ROOM_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Enrollment (Min Room Capacity)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={expectedEnrollment}
                onChange={(e) => setExpectedEnrollment(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Participating Section(s) — Select multiple for a Combined Joint Class
              </label>
              <div className="flex flex-wrap gap-2">
                {sections.map((sec) => {
                  const selected = selectedSectionIds.includes(sec.id);
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => toggleSectionSelection(sec.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {selected ? `✓ ${sec.name}` : sec.name} ({sec.studentStrength})
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Preferred Days (Optional Soft Constraint)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {calendar.workingDays.map((day) => {
                  const active = preferredDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => togglePreferredDay(day)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                        active
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {editingId ? 'Save Subject Requirement' : 'Add Subject Requirement'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Subjects List */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Configured Subject Requirements ({subjects.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Total expanded weekly class-session vertices:{' '}
              <span className="font-mono font-bold text-indigo-600">
                {subjects.reduce((acc, s) => acc + s.sessionsPerWeek, 0)} vertices
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3">Code & Subject</th>
                <th className="py-2.5 px-3">Section(s)</th>
                <th className="py-2.5 px-3">Assigned Teacher</th>
                <th className="py-2.5 px-3">Sessions / Wk</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Room Requirement</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {subjects.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3">
                    <span
                      className="font-mono font-bold mr-2"
                      style={{ color: sub.colorHex }}
                    >
                      {sub.code}
                    </span>
                    <span className="font-semibold text-slate-900">{sub.name}</span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    {sub.sectionIds.map((id) => sectionMap.get(id) || id).join(' + ')}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {teacherMap.get(sub.teacherId) || sub.teacherId}
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums">
                    {sub.sessionsPerWeek}x / wk
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums">
                    {sub.sessionDuration} {sub.sessionDuration > 1 ? 'consecutive periods' : 'period'} ({sub.sessionType})
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {sub.requiredRoomType} (≥ {sub.expectedEnrollment} seats)
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => startEdit(sub)}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-md hover:bg-slate-100 cursor-pointer"
                        title="Edit Subject"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(sub)}
                        className="p-1.5 text-slate-600 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. MANAGE CLASSROOMS & LABORATORIES PAGE
// ============================================================================
interface ManageClassroomsPageProps {
  classrooms: Classroom[];
  calendar: AcademicCalendar;
  onUpdateClassrooms: (updated: Classroom[], logMsg: string) => void;
}

export const ManageClassroomsPage: React.FC<ManageClassroomsPageProps> = ({
  classrooms,
  calendar,
  onUpdateClassrooms,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('Classroom');
  const [capacity, setCapacity] = useState(60);
  const [building, setBuilding] = useState('Academic Block A');
  const [unavailableSlots, setUnavailableSlots] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const teachingPeriods = calendar.periods.filter((p) => !p.isBreak);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setRoomType('Classroom');
    setCapacity(60);
    setBuilding('Academic Block A');
    setUnavailableSlots([]);
    setFormError(null);
  };

  const startEdit = (r: Classroom) => {
    setEditingId(r.id);
    setName(r.name);
    setRoomType(r.roomType);
    setCapacity(r.capacity);
    setBuilding(r.building);
    setUnavailableSlots([...r.unavailableSlots]);
    setFormError(null);
  };

  const toggleSlot = (slotKey: string) => {
    setUnavailableSlots((prev) =>
      prev.includes(slotKey) ? prev.filter((k) => k !== slotKey) : [...prev, slotKey]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Room name or number is required.');
      return;
    }
    if (capacity < 5 || capacity > 1000) {
      setFormError('Seating capacity must be between 5 and 1000.');
      return;
    }

    if (editingId) {
      const updated = classrooms.map((r) =>
        r.id === editingId
          ? {
              ...r,
              name: name.trim(),
              roomType,
              capacity: Number(capacity),
              building: building.trim(),
              unavailableSlots,
            }
          : r
      );
      onUpdateClassrooms(updated, `Updated room ${name.trim()}`);
    } else {
      const newRoom: Classroom = {
        id: `RM-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        roomType,
        capacity: Number(capacity),
        building: building.trim(),
        unavailableSlots,
      };
      onUpdateClassrooms([...classrooms, newRoom], `Added ${roomType}: ${name.trim()}`);
    }
    resetForm();
  };

  const handleDelete = (r: Classroom) => {
    onUpdateClassrooms(
      classrooms.filter((item) => item.id !== r.id),
      `Deleted room ${r.name}`
    );
    if (editingId === r.id) resetForm();
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {editingId ? 'Edit Classroom / Laboratory' : 'Add Classroom or Laboratory'}
            </h1>
            <p className="text-xs text-slate-500">
              The integrated resource allocator verifies room type compatibility, minimum seating capacity, and non-overlapping room occupancy.
            </p>
          </div>
        </div>

        {formError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Name / Number
              </label>
              <input
                type="text"
                placeholder="Classroom 104"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Facility Type
              </label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value as RoomType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {ROOM_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Seating Capacity
              </label>
              <input
                type="number"
                min={5}
                max={1000}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Building / Location
              </label>
              <input
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Room Maintenance / Unavailable Slots (Optional)
            </label>
            <div className="overflow-x-auto border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <div className="flex flex-wrap gap-1.5">
                {calendar.workingDays.map((day) =>
                  teachingPeriods.map((p) => {
                    const key = `${day}-P${p.periodNumber}`;
                    const isUnavail = unavailableSlots.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleSlot(key)}
                        className={`px-2 py-1 text-[11px] font-mono rounded border cursor-pointer transition-colors ${
                          isUnavail
                            ? 'bg-red-100 text-red-800 border-red-300 font-semibold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day.slice(0, 3)}-P{p.periodNumber} {isUnavail ? '(Closed)' : ''}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {editingId ? 'Save Room Changes' : 'Add Room'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Rooms Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          Classrooms & Laboratories Inventory ({classrooms.length})
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3">Room ID</th>
                <th className="py-2.5 px-3">Room Name</th>
                <th className="py-2.5 px-3">Facility Type</th>
                <th className="py-2.5 px-3 text-right">Seating Capacity</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Unavailable Slots</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {classrooms.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-mono text-slate-500">{r.id}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">{r.name}</td>
                  <td className="py-3 px-3 text-slate-700">{r.roomType}</td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {r.capacity} seats
                  </td>
                  <td className="py-3 px-3 text-slate-600">{r.building}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">
                    {r.unavailableSlots.length > 0
                      ? r.unavailableSlots.join(', ')
                      : 'Available all slots'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => startEdit(r)}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-md hover:bg-slate-100 cursor-pointer"
                        title="Edit Room"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="p-1.5 text-slate-600 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                        title="Delete Room"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
