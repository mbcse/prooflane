/** Server or client: show API failure details (status + JSON `error` or body snippet). */
export function ApiErrorCallout({
  title = "Could not load data",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
      role="alert"
    >
      <p className="font-medium text-destructive">{title}</p>
      <p className="mt-1 font-mono text-xs whitespace-pre-wrap break-words text-destructive/90">
        {message}
      </p>
    </div>
  );
}
