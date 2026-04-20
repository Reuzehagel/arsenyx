import { Hono } from "hono"

import { requireApiKey } from "../../lib/api-key-auth"
import { SCOPE_BUILD_WRITE } from "../../lib/api-keys"
import { handleOverframeImport } from "../imports"

export const v1Imports = new Hono()

v1Imports.post(
  "/overframe",
  requireApiKey(SCOPE_BUILD_WRITE),
  handleOverframeImport,
)
