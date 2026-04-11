import Link from "next/link"

import { AdminCommunityActions } from "@/components/admin/admin-community-actions"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAdminOrganizations } from "@/lib/db/admin"

interface AdminCommunitiesTabProps {
  search?: string
}

export async function AdminCommunitiesTab({ search }: AdminCommunitiesTabProps) {
  const orgs = await getAdminOrganizations(search)

  return (
    <div className="flex flex-col gap-4 pt-4">
      <form action="/admin" className="flex gap-2">
        <input type="hidden" name="tab" value="communities" />
        <Input
          name="q"
          placeholder="Search communities..."
          defaultValue={search}
          className="max-w-sm"
        />
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Builds</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((org) => (
            <TableRow key={org.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/org/${org.slug}`}
                  className="hover:underline"
                >
                  {org.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {org.slug}
              </TableCell>
              <TableCell>{org._count.members}</TableCell>
              <TableCell>{org._count.builds}</TableCell>
              <TableCell className="text-muted-foreground">
                {org.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell>
                <AdminCommunityActions orgId={org.id} orgName={org.name} />
              </TableCell>
            </TableRow>
          ))}
          {orgs.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground h-24 text-center"
              >
                No communities found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
