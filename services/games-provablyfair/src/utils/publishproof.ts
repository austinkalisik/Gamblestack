/**
 * MVP proof publisher.
 *
 * The original skeleton imported aws-sdk without declaring it. For the
 * self-hosted Tidalwave deployment we keep S3 publishing optional so the
 * games service can build and run without cloud credentials.
 */
export async function publishProofToS3(key: string, body: unknown) {
  if (!process.env.AWS_S3_BUCKET) {
    return { stored: false, key, reason: "AWS_S3_BUCKET not configured" };
  }

  // Provider integration is intentionally disabled until real S3-compatible
  // credentials/signing are configured. The proof is still persisted in
  // PostgreSQL by the caller.
  console.warn(
    `S3 proof publishing is not configured for bucket ${process.env.AWS_S3_BUCKET}; database persistence only.`
  );

  return { stored: false, key, body };
}
