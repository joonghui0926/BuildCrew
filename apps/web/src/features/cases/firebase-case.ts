import type { User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes, uploadString } from "firebase/storage";
import { firebaseFunctions, firebaseStorage, firestore } from "@/lib/firebase/client";

type CreateCaseInput = {
  delayEmail: string;
  files: File[];
  user: User;
};

type StartCaseResult = {
  caseId: string;
  crewAiConnected: boolean;
  kickoffId: string;
  status: string;
};

function makeCaseId() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `BC-${year}-${suffix}`;
}

function safeFileName(name: string) {
  return name.normalize("NFKC").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-");
}

export async function createAndStartCase({
  delayEmail,
  files,
  user,
}: CreateCaseInput): Promise<StartCaseResult> {
  const caseId = makeCaseId();
  const uploadedFiles = await Promise.all(
    files.map(async (file) => {
      const storagePath = `cases/${user.uid}/${caseId}/inputs/${safeFileName(file.name)}`;
      const fileReference = ref(firebaseStorage, storagePath);
      await uploadBytes(fileReference, file, {
        contentType: file.type || "application/octet-stream",
        customMetadata: { caseId, originalName: file.name },
      });
      return {
        contentType: file.type || "application/octet-stream",
        name: file.name,
        size: file.size,
        storagePath,
      };
    }),
  );

  const manifest = {
    case_id: caseId,
    created_by: user.uid,
    supplier_delay_email: delayEmail,
    files: uploadedFiles,
    payload_version: "2026-07-26",
  };
  const manifestPath = `cases/${user.uid}/${caseId}/inputs/input-manifest.json`;
  const manifestReference = ref(firebaseStorage, manifestPath);
  await uploadString(manifestReference, JSON.stringify(manifest, null, 2), "raw", {
    contentType: "application/json",
  });
  const manifestUrl = await getDownloadURL(manifestReference);

  await setDoc(doc(firestore, "cases", caseId), {
    caseId,
    createdAt: serverTimestamp(),
    currentStage: "draft",
    inputManifestPath: manifestPath,
    inputManifestUrl: manifestUrl,
    ownerId: user.uid,
    progressPercent: 0,
    source: "buildcrew-web",
    status: "draft",
    supplierDelayEmail: delayEmail,
    updatedAt: serverTimestamp(),
  });

  const startCase = httpsCallable<{ caseId: string }, StartCaseResult>(
    firebaseFunctions,
    "startBuildCrewCase",
  );
  const response = await startCase({ caseId });
  return response.data;
}
