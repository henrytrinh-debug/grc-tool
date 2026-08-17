"use client";

import { EntityCommentPanel } from "@/app/components/entity-comment-panel";
import { FollowUpList } from "@/app/components/follow-up-list";
import { SchemaNotice } from "@/app/components/page-parts";
import type { CommentEntityType } from "@/lib/types/entity-comment";
import type { FollowUpEntityType } from "@/lib/types/follow-up";
import type { OrgPerson } from "@/lib/types/person";

type RecordFeedbackProps = {
  entityType: FollowUpEntityType;
  entityId: string;
  enabled: boolean;
  owner: { id: string; email: string } | null;
  people: OrgPerson[];
  showComments?: boolean;
};

export function RecordFeedback({
  entityType,
  entityId,
  enabled,
  owner,
  people,
  showComments = true,
}: RecordFeedbackProps) {
  if (!enabled) {
    return (
      <SchemaNotice>
        Run <code className="font-mono">supabase/schema/011_feedback.sql</code>{" "}
        to enable comments, follow-ups, and the audit trail.
      </SchemaNotice>
    );
  }

  return (
    <>
      <FollowUpList
        entityType={entityType}
        entityId={entityId}
        owner={owner}
        enabled={enabled}
        people={people}
      />
      {showComments ? (
        <EntityCommentPanel
          entityType={entityType as CommentEntityType}
          entityId={entityId}
          owner={owner}
          enabled={enabled}
        />
      ) : null}
    </>
  );
}
