import {
  Classroom,
  ClassSessionEvent,
  ScheduledSession,
} from '../types/timetable';

/**
 * Stage 6: Integrated Resource-Aware Room Allocator.
 * Finds all compatible rooms for an event across its consecutive occupied time slots,
 * checking room type, seating capacity, room availability, and existing room assignments.
 */
export function findAvailableCompatibleRoom(
  event: ClassSessionEvent,
  occupiedSlotKeys: string[],
  classrooms: Classroom[],
  currentSchedule: ScheduledSession[]
): Classroom | null {
  // 1. Filter by required room type and minimum seating capacity
  const typeAndCapacityMatches = classrooms.filter(
    (room) => room.roomType === event.requiredRoomType && room.capacity >= event.enrollment
  );

  if (typeAndCapacityMatches.length === 0) {
    return null;
  }

  // 2. Filter out rooms that are unavailable or already occupied during any of occupiedSlotKeys
  const availableRooms = typeAndCapacityMatches.filter((room) => {
    const roomUnavailSet = new Set(room.unavailableSlots);

    for (const slotKey of occupiedSlotKeys) {
      if (roomUnavailSet.has(slotKey)) {
        return false;
      }

      // Check if any already scheduled event uses this room during this slotKey
      const isOccupied = currentSchedule.some(
        (sched) =>
          sched.roomId === room.id && sched.occupiedSlotKeys.includes(slotKey)
      );
      if (isOccupied) {
        return false;
      }
    }

    return true;
  });

  if (availableRooms.length === 0) {
    return null;
  }

  // 3. Deterministic preference ordering:
  //    a) Room already used by the same section or same subject (reduces room changes)
  //    b) Tightest capacity fit (capacity - enrollment ascending)
  //    c) Room ID alphabetical
  const sectionUsedRooms = new Set(
    currentSchedule
      .filter((s) => s.event.sectionIds.some((secId) => event.sectionIds.includes(secId)))
      .map((s) => s.roomId)
  );

  const sortedRooms = [...availableRooms].sort((a, b) => {
    const aUsed = sectionUsedRooms.has(a.id) ? 0 : 1;
    const bUsed = sectionUsedRooms.has(b.id) ? 0 : 1;
    if (aUsed !== bUsed) return aUsed - bUsed;

    const aSlack = a.capacity - event.enrollment;
    const bSlack = b.capacity - event.enrollment;
    if (aSlack !== bSlack) return aSlack - bSlack;

    return a.id.localeCompare(b.id);
  });

  return sortedRooms[0];
}
