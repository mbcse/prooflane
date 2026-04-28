import {
  CloudTrailClient,
  DescribeTrailsCommand,
  GetTrailStatusCommand,
} from "@aws-sdk/client-cloudtrail";
import {
  GetAccountSummaryCommand,
  GetAccountPasswordPolicyCommand,
  IAMClient,
} from "@aws-sdk/client-iam";
import {
  GetBucketEncryptionCommand,
  GetBucketPolicyStatusCommand,
  GetPublicAccessBlockCommand,
  ListBucketsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

function s3Client(c: AwsCredentials) {
  return new S3Client({
    region: c.region,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
}

function iamClient(c: AwsCredentials) {
  return new IAMClient({
    region: c.region,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
}

function cloudTrailClient(c: AwsCredentials) {
  return new CloudTrailClient({
    region: c.region,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
}

export async function checkCloudTrailEnabled(c: AwsCredentials): Promise<{
  loggingTrailCount: number;
  multiRegionTrailCount: number;
  details: unknown;
}> {
  const ct = cloudTrailClient(c);
  const trailsOut = await ct.send(new DescribeTrailsCommand({}));
  const trails = trailsOut.trailList ?? [];
  let loggingTrailCount = 0;
  let multiRegionTrailCount = 0;
  for (const t of trails) {
    if (t.IsMultiRegionTrail) multiRegionTrailCount += 1;
    if (t.Name) {
      try {
        const st = await ct.send(
          new GetTrailStatusCommand({ Name: t.Name }),
        );
        if (st.IsLogging) loggingTrailCount += 1;
      } catch {
        /* ignore */
      }
    }
  }
  return {
    loggingTrailCount,
    multiRegionTrailCount,
    details: { trailCount: trails.length },
  };
}

export async function checkS3EncryptionAndPublicAccess(c: AwsCredentials): Promise<{
  bucketCount: number;
  bucketsWithoutEncryption: string[];
  bucketsPublicOrRisky: string[];
  details: unknown;
}> {
  const s3 = s3Client(c);
  const list = await s3.send(new ListBucketsCommand({}));
  const buckets = list.Buckets ?? [];
  const bucketsWithoutEncryption: string[] = [];
  const bucketsPublicOrRisky: string[] = [];

  for (const b of buckets) {
    const name = b.Name;
    if (!name) continue;
    try {
      const enc = await s3.send(new GetBucketEncryptionCommand({ Bucket: name }));
      const rules = enc.ServerSideEncryptionConfiguration?.Rules ?? [];
      if (rules.length === 0) bucketsWithoutEncryption.push(name);
    } catch (e: unknown) {
      const code = (e as { name?: string })?.name;
      if (code === "ServerSideEncryptionConfigurationNotFoundError") {
        bucketsWithoutEncryption.push(name);
      }
    }

    try {
      const pub = await s3.send(new GetBucketPolicyStatusCommand({ Bucket: name }));
      if (pub.PolicyStatus?.IsPublic) bucketsPublicOrRisky.push(name);
    } catch {
      /* no policy */
    }
    try {
      const pab = await s3.send(new GetPublicAccessBlockCommand({ Bucket: name }));
      const c = pab.PublicAccessBlockConfiguration;
      const blocked =
        c?.BlockPublicAcls &&
        c?.IgnorePublicAcls &&
        c?.BlockPublicPolicy &&
        c?.RestrictPublicBuckets;
      if (!blocked) bucketsPublicOrRisky.push(name);
    } catch {
      bucketsPublicOrRisky.push(name);
    }
  }

  return {
    bucketCount: buckets.length,
    bucketsWithoutEncryption,
    bucketsPublicOrRisky: [...new Set(bucketsPublicOrRisky)],
    details: {},
  };
}

export async function checkRootMFAAndKeys(c: AwsCredentials): Promise<{
  mfaActive: boolean;
  accessKeyCount: number;
  summary: Record<string, number> | null;
}> {
  const iam = iamClient(c);
  const sum = await iam.send(new GetAccountSummaryCommand({}));
  const summary = sum.SummaryMap ?? null;
  const accessKeyCount = summary?.AccountAccessKeysPresent ?? 0;
  const mfaActive = (summary?.AccountMFAEnabled ?? 0) >= 1;
  return { mfaActive, accessKeyCount, summary: summary as Record<string, number> | null };
}

export async function checkPasswordPolicy(c: AwsCredentials): Promise<{
  ok: boolean;
  minLength: number;
  requiresComplexity: boolean;
  raw?: unknown;
}> {
  const iam = iamClient(c);
  try {
    const pol = await iam.send(new GetAccountPasswordPolicyCommand({}));
    const p = pol.PasswordPolicy;
    if (!p) return { ok: false, minLength: 0, requiresComplexity: false };
    const minLength = p.MinimumPasswordLength ?? 0;
    const requiresComplexity = Boolean(
      p.RequireUppercaseCharacters &&
        p.RequireLowercaseCharacters &&
        p.RequireNumbers &&
        p.RequireSymbols,
    );
    const ok = minLength >= 12 && requiresComplexity;
    return { ok, minLength, requiresComplexity, raw: p };
  } catch {
    return { ok: false, minLength: 0, requiresComplexity: false };
  }
}
