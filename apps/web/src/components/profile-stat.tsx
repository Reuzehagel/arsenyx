/** Inline "<value> <label>" stat used in profile and org headers. */
export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="text-foreground font-semibold tabular-nums">
        {value.toLocaleString()}
      </span>{" "}
      {label}
    </span>
  )
}
