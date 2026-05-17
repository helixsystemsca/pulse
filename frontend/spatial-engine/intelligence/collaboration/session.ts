import type {
  CollaborationParticipant,
  SpatialCollaborationMessage,
  SpatialCollaborationSession,
} from "@/spatial-engine/intelligence/collaboration/types";
import type { WorldPoint } from "@/spatial-engine/types/spatial";

export function createCollaborationSession(documentId: string, revisionHeadId: string): SpatialCollaborationSession {
  const now = new Date().toISOString();
  return {
    sessionId: `collab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    documentId,
    revisionHeadId,
    participants: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertParticipant(
  session: SpatialCollaborationSession,
  participant: CollaborationParticipant,
): SpatialCollaborationSession {
  const others = session.participants.filter((p) => p.userId !== participant.userId);
  return {
    ...session,
    participants: [...others, { ...participant, lastSeenAt: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  };
}

export function applyCollaborationMessage(
  session: SpatialCollaborationSession,
  message: SpatialCollaborationMessage,
): SpatialCollaborationSession {
  switch (message.type) {
    case "cursor":
      return upsertParticipant(session, {
        userId: message.userId,
        cursor: message.cursor,
      });
    case "presence":
      return upsertParticipant(session, {
        userId: message.userId,
        displayName: message.displayName,
      });
    case "patch":
      return {
        ...session,
        revisionHeadId: message.baseRevisionId,
        updatedAt: new Date().toISOString(),
      };
    default:
      return session;
  }
}

export function participantCursors(
  session: SpatialCollaborationSession,
  excludeUserId?: string,
): { userId: string; cursor: WorldPoint }[] {
  return session.participants
    .filter((p) => p.userId !== excludeUserId && p.cursor)
    .map((p) => ({ userId: p.userId, cursor: p.cursor! }));
}
