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

type InputManifestFile = {
  contentType?: string;
  downloadUrl?: string;
  name?: string;
  storagePath?: string;
};

type InputManifest = {
  files?: InputManifestFile[];
  supplier_delay_email?: string;
};

const publicDemoRoot = "https://build-crew.web.app/demo";
const demoInputs = {
  candidateManufacturerFiles: [
    `${publicDemoRoot}/inputs/manufacturer-ksb-etanorm.pdf`,
    `${publicDemoRoot}/inputs/manufacturer-grundfos-nb.pdf`,
    `${publicDemoRoot}/inputs/manufacturer-armstrong-4030.pdf`,
  ],
  currentProjectIfcUrl: `${publicDemoRoot}/m601-dajoong-bim.ifc`,
  equipmentScheduleFiles: [`${publicDemoRoot}/inputs/equipment-schedule-m601.pdf`],
  originalSubmittalFiles: [
    `${publicDemoRoot}/inputs/original-submittal-bell-gossett-e1510.pdf`,
  ],
  projectDrawingFiles: [`${publicDemoRoot}/m601-source-drawing.png`],
  projectSpecificationFiles: [
    `${publicDemoRoot}/inputs/project-specification-23-21-23.pdf`,
  ],
  supplierQuoteFiles: [
    `${publicDemoRoot}/inputs/quote-ksb-2418.pdf`,
    `${publicDemoRoot}/inputs/quote-grundfos-9017.pdf`,
    `${publicDemoRoot}/inputs/quote-armstrong-7614.pdf`,
  ],
};

const firebaseCallbackUrl =
  "https://us-west1-build-crew.cloudfunctions.net/receiveCrewAiCallback";

async function loadInputManifest(manifestUrl: string): Promise<InputManifest> {
  if (!manifestUrl) return {};
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      logger.warn("Input manifest could not be downloaded.", {
        status: response.status,
      });
      return {};
    }
    return (await response.json()) as InputManifest;
  } catch (error) {
    logger.warn("Input manifest download failed.", { error });
    return {};
  }
}

function matchingFileUrls(
  files: InputManifestFile[],
  patterns: RegExp[],
): string[] {
  return files
    .filter((file) => patterns.some((pattern) => pattern.test(file.name ?? "")))
    .map((file) => file.downloadUrl)
    .filter((url): url is string => Boolean(url));
}

function firstOrFallback(values: string[], fallback: string): string {
  return values[0] ?? fallback;
}

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
    const inputManifestUrl = String(snapshot.get("inputManifestUrl") ?? "");
    const manifest = await loadInputManifest(inputManifestUrl);
    const files = manifest.files ?? [];

    const projectSpecificationFiles = matchingFileUrls(files, [
      /specification/i,
      /(^|[-_\s])spec([\-_\s.]|$)/i,
    ]);
    const projectDrawingFiles = matchingFileUrls(files, [
      /drawing/i,
      /plan/i,
      /m-?601/i,
      /\.(?:png|jpe?g|dwg|dxf)$/i,
    ]);
    const equipmentScheduleFiles = matchingFileUrls(files, [
      /schedule/i,
      /equipment[-_\s]?list/i,
    ]);
    const originalSubmittalFiles = matchingFileUrls(files, [
      /original/i,
      /approved/i,
      /submittal/i,
    ]);
    const candidateManufacturerFiles = matchingFileUrls(files, [
      /manufacturer/i,
      /candidate/i,
      /datasheet/i,
      /cut[-_\s]?sheet/i,
    ]);
    const supplierQuoteFiles = matchingFileUrls(files, [
      /quote/i,
      /quotation/i,
      /rfq/i,
    ]);
    const projectIfcFiles = matchingFileUrls(files, [/\.ifc$/i]);

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
          project_id: snapshot.get("projectId") ?? "MISSION-BAY-DC",
          equipment_tag: snapshot.get("equipmentTag") ?? "P-401",
          supplier_delay_email:
            snapshot.get("supplierDelayEmail") ??
            manifest.supplier_delay_email ??
            "",
          specified_product:
            snapshot.get("specifiedProduct") ?? "Bell & Gossett e-1510 4BD",
          quantity: snapshot.get("quantity") ?? 1,
          required_on_site_date:
            snapshot.get("requiredOnSiteDate") ?? "2026-08-28",
          project_specification_files:
            projectSpecificationFiles.length > 0
              ? projectSpecificationFiles
              : demoInputs.projectSpecificationFiles,
          project_drawing_files:
            projectDrawingFiles.length > 0
              ? projectDrawingFiles
              : demoInputs.projectDrawingFiles,
          equipment_schedule_files:
            equipmentScheduleFiles.length > 0
              ? equipmentScheduleFiles
              : demoInputs.equipmentScheduleFiles,
          current_project_ifc_url: firstOrFallback(
            projectIfcFiles,
            demoInputs.currentProjectIfcUrl,
          ),
          original_submittal_files:
            originalSubmittalFiles.length > 0
              ? originalSubmittalFiles
              : demoInputs.originalSubmittalFiles,
          candidate_manufacturer_files:
            candidateManufacturerFiles.length > 0
              ? candidateManufacturerFiles
              : demoInputs.candidateManufacturerFiles,
          supplier_quote_files:
            supplierQuoteFiles.length > 0
              ? supplierQuoteFiles
              : demoInputs.supplierQuoteFiles,
          firebase_progress_callback_url: firebaseCallbackUrl,
          firebase_final_callback_url: firebaseCallbackUrl,
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
