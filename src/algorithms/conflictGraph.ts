import {
  ClassSessionEvent,
  ConflictGraph,
  ConflictReason,
  GraphEdge,
  GraphVertex,
} from '../types/timetable';

/**
 * Stage 3: Construct the undirected Conflict Graph from expanded ClassSessionEvents.
 * Adds an edge between two distinct events iff they share a teacher or share at least one student section.
 * Guarantees no self-loops and no duplicate edges.
 */
export function buildConflictGraph(events: ClassSessionEvent[]): ConflictGraph {
  const adjacencyMap: Record<string, string[]> = {};
  const edgeReasonsMap: Record<string, ConflictReason[]> = {};
  const edges: GraphEdge[] = [];

  for (const evt of events) {
    adjacencyMap[evt.eventId] = [];
  }

  for (let i = 0; i < events.length; i++) {
    const u = events[i];
    const uSectionSet = new Set(u.sectionIds);

    for (let j = i + 1; j < events.length; j++) {
      const v = events[j];
      if (u.eventId === v.eventId) continue; // No self-loops

      const reasons: ConflictReason[] = [];
      const detailParts: string[] = [];

      // Check shared teacher
      if (u.teacherId && v.teacherId && u.teacherId === v.teacherId) {
        reasons.push('SHARED_TEACHER');
        detailParts.push(`Shared Teacher: ${u.teacherName}`);
      }

      // Check shared student section(s)
      const sharedSections: string[] = [];
      v.sectionIds.forEach((secId, idx) => {
        if (uSectionSet.has(secId)) {
          sharedSections.push(v.sectionNames[idx] || secId);
        }
      });

      if (sharedSections.length > 0) {
        reasons.push('SHARED_SECTION');
        detailParts.push(`Shared Section: ${sharedSections.join(', ')}`);
      }

      if (u.subjectId === v.subjectId) {
        reasons.push('SAME_SUBJECT_GROUP');
      }

      if (reasons.length > 0) {
        adjacencyMap[u.eventId].push(v.eventId);
        adjacencyMap[v.eventId].push(u.eventId);

        const edgeKey1 = `${u.eventId}__${v.eventId}`;
        const edgeKey2 = `${v.eventId}__${u.eventId}`;
        edgeReasonsMap[edgeKey1] = reasons;
        edgeReasonsMap[edgeKey2] = reasons;

        edges.push({
          id: `EDGE-${u.eventId}-${v.eventId}`,
          source: u.eventId,
          target: v.eventId,
          reasons,
          details: detailParts.join(' · '),
        });
      }
    }
  }

  const vertices: GraphVertex[] = events.map((evt) => {
    const neighbors = adjacencyMap[evt.eventId] || [];
    return {
      eventId: evt.eventId,
      event: evt,
      degree: neighbors.length,
      neighbors,
    };
  });

  return {
    vertices,
    edges,
    adjacencyMap,
    edgeReasonsMap,
  };
}
