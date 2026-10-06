/**
 * Production approval/version helpers.
 * Every change can be represented as a proposal/version without destroying history.
 */

export const APPROVAL_STATES = Object.freeze([
  'DRAFT', 'GENERATED', 'REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'ARCHIVED'
]);

export async function recordFilmApproval(db, record) {
  if (!record?.id || !record.projectId || !record.entityType || !record.entityId || !record.state) {
    throw new Error('Approval requires id, projectId, entityType, entityId and state.');
  }
  if (!APPROVAL_STATES.includes(record.state)) throw new Error(`Invalid approval state: ${record.state}`);

  await db.query(
    `INSERT INTO film_approvals
      (id,project_id,entity_type,entity_id,state,reviewer_user_id,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [record.id,record.projectId,record.entityType,record.entityId,record.state,record.reviewerUserId||null,record.notes||'']
  );
  return record;
}

export async function recordFilmVersion(db, record) {
  if (!record?.id || !record.projectId || !record.entityType || !record.entityId) {
    throw new Error('Version requires id, projectId, entityType and entityId.');
  }
  const result = await db.query(
    `INSERT INTO film_version_records
      (id,project_id,entity_type,entity_id,version,snapshot,change_summary,created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (entity_type,entity_id,version) DO NOTHING
     RETURNING id`,
    [record.id,record.projectId,record.entityType,record.entityId,Number(record.version||1),
      JSON.stringify(record.snapshot||{}),record.changeSummary||'',record.createdByUserId||null]
  );
  return { created: result.rowCount === 1, id: record.id };
}
