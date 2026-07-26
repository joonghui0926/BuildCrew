import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

export async function requireOwnedCase(caseId: string, uid: string) {
  const reference = getFirestore().collection("cases").doc(caseId);
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Case not found.");
  }
  if (snapshot.get("ownerId") !== uid) {
    throw new HttpsError("permission-denied", "This case belongs to another user.");
  }
  return { reference, snapshot };
}

export function requireAuthenticatedUser(uid: string | undefined): string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }
  return uid;
}

