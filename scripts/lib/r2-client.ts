/**
 * Thin wrapper around the S3-compatible API Cloudflare R2 exposes. All
 * backup/restore R2 access goes through here so there's one place that
 * knows the endpoint shape and credential env vars.
 */
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface R2Object {
  key: string;
  lastModified: Date;
  size: number;
}

export function loadR2ConfigFromEnv(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET must all be set"
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function uploadObject(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer
): Promise<void> {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
}

export async function downloadObject(
  client: S3Client,
  bucket: string,
  key: string
): Promise<Buffer> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  // @ts-expect-error - Body is a Node Readable at runtime for this SDK's Node build
  for await (const chunk of res.Body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function listObjects(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<R2Object[]> {
  const results: R2Object[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) {
        results.push({
          key: obj.Key,
          lastModified: obj.LastModified ?? new Date(0),
          size: obj.Size ?? 0,
        });
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return results;
}

export async function deleteObjects(
  client: S3Client,
  bucket: string,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  for (let i = 0; i < keys.length; i += 1000) {
    // R2/S3 DeleteObjects caps at 1000 keys per request.
    const batch = keys.slice(i, i + 1000);
    const res = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((key) => ({ Key: key })) },
      })
    );
    // R2/S3 returns HTTP 200 even when individual keys fail to delete;
    // per-key failures show up here rather than as a thrown error. These
    // are logged but not thrown - a retention-sweep failure must not fail
    // the backup run.
    if (res.Errors && res.Errors.length > 0) {
      console.warn(
        `deleteObjects: failed to delete ${res.Errors.length} object(s) from ${bucket}:`,
        res.Errors.map((err) => `${err.Key} (${err.Code}: ${err.Message})`).join(", ")
      );
    }
  }
}
