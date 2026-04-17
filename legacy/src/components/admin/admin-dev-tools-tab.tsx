import { readFileSync } from "fs"
import { join } from "path"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDbTableCounts } from "@/lib/db/admin"

function readPackageVersion(packageName: string): string {
  try {
    const pkgPath = join(
      process.cwd(),
      "node_modules",
      packageName,
      "package.json",
    )
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
    return pkg.version
  } catch {
    return "unknown"
  }
}

export async function AdminDevToolsTab() {
  const tableCounts = await getDbTableCounts()

  const wfcdVersion = readPackageVersion("@wfcd/items")
  const nextVersion = readPackageVersion("next")
  const prismaVersion = readPackageVersion("@prisma/client")

  return (
    <div className="flex flex-col gap-8 pt-4">
      {/* Database Info */}
      <section>
        <h3 className="mb-2 text-sm font-medium">Database Table Counts</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead>Rows</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(tableCounts).map(([table, count]) => (
              <TableRow key={table}>
                <TableCell className="font-mono text-sm">{table}</TableCell>
                <TableCell>{count.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Environment Info */}
      <section>
        <h3 className="mb-2 text-sm font-medium">Environment</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-sm">NODE_ENV</TableCell>
              <TableCell>{process.env.NODE_ENV}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">Next.js</TableCell>
              <TableCell>{nextVersion}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">Prisma</TableCell>
              <TableCell>{prismaVersion}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">@wfcd/items</TableCell>
              <TableCell>{wfcdVersion}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
