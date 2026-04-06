import { AdminBuildActions } from "@/components/admin/admin-build-actions"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAdminBuilds } from "@/lib/db/admin"

interface AdminContentTabProps {
  search?: string
}

export async function AdminContentTab({ search }: AdminContentTabProps) {
  const builds = await getAdminBuilds(search)

  return (
    <div className="space-y-4 pt-4">
      <form action="/admin" className="flex gap-2">
        <input type="hidden" name="tab" value="content" />
        <Input
          name="q"
          placeholder="Search builds..."
          defaultValue={search}
          className="max-w-sm"
        />
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Build</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Votes</TableHead>
            <TableHead>Favs</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {builds.map((build) => (
            <TableRow key={build.id}>
              <TableCell className="font-medium">{build.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {build.user.username || build.user.name || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground capitalize">
                {build.itemCategory}
              </TableCell>
              <TableCell>{build.itemName}</TableCell>
              <TableCell>{build.voteCount}</TableCell>
              <TableCell>{build.favoriteCount}</TableCell>
              <TableCell className="text-muted-foreground">
                {build.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell>
                <AdminBuildActions buildId={build.id} buildName={build.name} />
              </TableCell>
            </TableRow>
          ))}
          {builds.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-muted-foreground h-24 text-center"
              >
                No builds found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
