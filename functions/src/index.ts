import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { approvalSchema, callbackSchema, startCaseSchema } from "./contracts.js";
import { requireAuthenticatedUser, requireOwnedCase } from "./authorization.js";

initializeApp();

const crewAiAutomationUrl = defineSecret("CREWAI_AUTOMATION_URL");
const crewAiAutomationToken = defineSecret("CREWAI_AUTOMATION_TOKEN");
const crewAiCallbackSecret = defineSecret("CREWAI_CALLBACK_SECRET");

function secureEquals(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export const startBuildCrewCase = onCall(
  {
    region: "us-west1",
    timeoutSeconds: 60,
    secrets: [crewAiAutomationUrl, crewAiAutomationToken],
  },
  async (request) => {
    const uid = requireAuthenticatedUser(request.auth?.uid);
    const { caseId } = startCaseSchema.parse(request.data);
    const { reference, snapshot } = await requireOwnedCase(caseId, uid);
    const currentStatus = String(snapshot.get("status") ?? "");
    if (!["draft", "needs_revision", "failed"].includes(currentStatus)) {
      throw new HttpsError("failed-precondition", "This case is already running.");
    }

    const automationUrl = crewAiAutomationUrl.value();
    const automationToken = crewAiAutomationToken.value();
    const kickoffId = `pending-${randomUUID()}`;

    await reference.update({
      status: "queued",
      currentStage: "intake",
      progressPercent: 2,
      kickoffId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (!automationUrl || !automationToken) {
      logger.warn("CrewAI secrets are not configured; case remains queued.", { caseId });
      return { caseId, kickoffId, status: "queued", crewAiConnected: false };
    }

    const response = await fetch(`${automationUrl.replace(/\/$/, "")}/kickoff`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${automationToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          case_id: caseId,
          project_id: snapshot.get("projectId"),
          equipment_tag: snapshot.get("equipmentTag"),
          required_on_site_date: snapshot.get("requiredOnSiteDate"),
          input_manifest_url: snapshot.get("inputManifestUrl") ?? "",
        },
        meta: { caseId, ownerId: uid, source: "buildcrew-firebase" },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      await reference.update({
        status: "failed",
        error: `CrewAI kickoff failed (${response.status}).`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.error("CrewAI kickoff failed.", { caseId, status: response.status, detail });
      throw new HttpsError("unavailable", "CrewAI could not start the case.");
    }

    const kickoff = (await response.json()) as { kickoff_id?: string; id?: string };
    const confirmedKickoffId = kickoff.kickoff_id ?? kickoff.id ?? kickoffId;
    await reference.update({
      kickoffId: confirmedKickoffId,
      status: "running",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { caseId, kickoffId: confirmedKickoffId, status: "running", crewAiConnected: true };
  },
);

export const receiveCrewAiCallback = onRequest(
  {
    region: "us-west1",
    timeoutSeconds: 30,
    secrets: [crewAiCallbackSecret],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const supplied = String(request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const expected = crewAiCallbackSecret.value();
    if (!expected || !supplied || !secureEquals(supplied, expected)) {
      response.status(401).json({ error: "invalid_callback_credential" });
      return;
    }

    const parsed = callbackSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(422).json({ error: "invalid_callback", issues: parsed.error.issues });
      return;
    }

    const payload = parsed.data;
    const database = getFirestore();
    const idempotencyReference = database
      .collection("callbackIdempotency")
      .doc(payload.idempotency_key);
    const caseReference = database.collection("cases").doc(payload.case_id);

    const duplicate = await database.runTransaction(async (transaction) => {
      const prior = await transaction.get(idempotencyReference);
      if (prior.exists) return true;

      transaction.create(idempotencyReference, {
        caseId: payload.case_id,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        caseReference.collection("events").doc(),
        {
          ...payload,
          createdAt: FieldValue.serverTimestamp(),
        },
      );
      transaction.update(caseReference, {
        status: payload.status,
        currentStage: payload.current_stage,
        progressPercent: payload.progress_percent,
        summary: payload.summary,
        deliverables: payload.deliverables,
        error: payload.error ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return false;
    });

    response.status(duplicate ? 200 : 202).json({ accepted: true, duplicate });
  },
);

export const submitBuildCrewApproval = onCall(
  {
    region: "us-west1",
    timeoutSeconds: 60,
    secrets: [crewAiAutomationUrl, crewAiAutomationToken],
  },
  async (request) => {
    const uid = requireAuthenticatedUser(request.auth?.uid);
    const input = approvalSchema.parse(request.data);
    const { reference, snapshot } = await requireOwnedCase(input.caseId, uid);
    const kickoffId = String(snapshot.get("kickoffId") ?? "");
    if (!kickoffId) {
      throw new HttpsError("failed-precondition", "No CrewAI execution is attached.");
    }

    await reference.collection("approvals").add({
      ...input,
      reviewedBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    await reference.update({
      approvalStatus: input.decision,
      status: input.decision === "approved" ? "resuming" : input.decision,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const automationUrl = crewAiAutomationUrl.value();
    const automationToken = crewAiAutomationToken.value();
    if (!automationUrl || !automationToken) {
      return { accepted: true, resumed: false };
    }

    const resumeResponse = await fetch(
      `${automationUrl.replace(/\/$/, "")}/resume/${encodeURIComponent(kickoffId)}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${automationToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          decision: input.decision,
          feedback: input.note,
          gate: input.gate,
          reviewed_by: uid,
        }),
      },
    );
    if (!resumeResponse.ok) {
      logger.error("CrewAI resume failed.", { caseId: input.caseId, status: resumeResponse.status });
      throw new HttpsError("unavailable", "Approval was saved, but the flow could not resume.");
    }

    return { accepted: true, resumed: true };
  },
);
