import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { listAllApiKeys } from "@/lib/db/api-keys"

import { ApiKeyCreateForm } from "./api-key-create-form"
import { ApiKeyActions } from "./api-key-actions"

export async function AdminApiKeysTab() {
  const apiKeys = await listAllApiKeys()

  return (
    <div className="flex flex-col gap-6 pt-4">
      <ApiKeyCreateForm />

      <section>
        <h3 className="mb-2 text-sm font-medium">
          API Keys ({apiKeys.length})
        </h3>
        {apiKeys.length === 0 ? (
          <p className="text-muted-foreground text-sm">No API keys created yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {key.keyPrefix}...
                  </TableCell>
                  <TableCell>
                    {key.user.username || key.user.name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{key.rateLimit}/hr</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    {key.isActive ? (
                      key.expiresAt && key.expiresAt < new Date() ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )
                    ) : (
                      <Badge variant="secondary">Revoked</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <ApiKeyActions
                      id={key.id}
                      isActive={key.isActive}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
