import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

import { env } from "../env.ts"

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
})

export function objectKey(
  slug: string,
  bg: string,
  format: string,
): string {
  return `${slug}/${bg}.${format}`
}

export async function getObject(key: string): Promise<Buffer | null> {
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
    )
    if (!res.Body) return null
    const chunks: Uint8Array[] = []
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  } catch (err) {
    if (err instanceof NoSuchKey) return null
    throw err
  }
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

export async function deleteObjectsByPrefix(prefix: string): Promise<void> {
  const list = await client.send(
    new ListObjectsV2Command({ Bucket: env.R2_BUCKET, Prefix: prefix }),
  )
  const keys = list.Contents?.map((o) => o.Key).filter(
    (k): k is string => typeof k === "string",
  )
  if (!keys || keys.length === 0) return
  await client.send(
    new DeleteObjectsCommand({
      Bucket: env.R2_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  )
}
