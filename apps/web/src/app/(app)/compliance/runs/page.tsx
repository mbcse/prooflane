import Link from "next/link";
import { auth } from "@/auth";
import { ApiErrorCallout } from "@/components/api-error-callout";
import { getApiUrl } from "@/lib/api-url";
import { fetchApiJson } from "@/lib/api-response";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RunRow = {
  id: string;
  status: string;
  overallScore: number | null;
  startedAt: string;
};

export default async function ComplianceRunsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) return null;

  const parsed = await fetchApiJson<{ runs: RunRow[] }>(
    `${getApiUrl()}/v1/me/compliance-runs`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    },
  );
  if (!parsed.ok) {
    return (
      <ApiErrorCallout title="Could not load compliance runs" message={parsed.message} />
    );
  }

  const { runs } = parsed.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Compliance runs</h1>
        <p className="text-muted-foreground text-sm mt-1">History of snapshots and scores.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">
                {new Date(r.startedAt).toLocaleString()}
              </TableCell>
              <TableCell>
                {r.overallScore != null ? (
                  <span className="tabular-nums">{r.overallScore}</span>
                ) : (
                  "n/a"
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    r.status === "COMPLETED"
                      ? "default"
                      : r.status === "FAILED"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {r.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/compliance/runs/${r.id}`}
                  className="text-sm underline underline-offset-4"
                >
                  View details
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {runs.length === 0 && (
        <p className="text-sm text-muted-foreground">No runs yet. Start from the dashboard.</p>
      )}
    </div>
  );
}
