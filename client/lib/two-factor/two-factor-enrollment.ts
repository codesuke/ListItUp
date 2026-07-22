export function hasSavedRecoveryCodesAcknowledgement(
  formData: FormData
): boolean {
  return formData.get("recoveryCodesSaved") === "true";
}
