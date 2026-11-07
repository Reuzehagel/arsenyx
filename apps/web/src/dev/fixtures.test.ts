import {
  BUILD_NAME_MAX,
  DISPLAY_USERNAME_MAX,
  ORG_NAME_MAX,
  ORG_SLUG_MAX,
  USERNAME_MAX,
} from "@arsenyx/shared/api/limits"
import { describe, expect, it } from "vitest"

import { worstBuilds, worstOrgs, worstProfiles } from "./fixtures"

// The worst-case fixtures are only worth anything at the real limits.
describe("worst-case fixtures sit exactly at the field limits", () => {
  it.each([
    ["build name", worstBuilds()[0]!.name, BUILD_NAME_MAX],
    ["username", worstBuilds()[6]!.user.username, USERNAME_MAX],
    ["display name", worstProfiles()[0]!.displayUsername, DISPLAY_USERNAME_MAX],
    ["profile username", worstProfiles()[0]!.username, USERNAME_MAX],
    ["org name", worstOrgs()[0]!.name, ORG_NAME_MAX],
    ["org slug", worstOrgs()[0]!.slug, ORG_SLUG_MAX],
  ])("%s", (_, value, max) => {
    expect(value?.length).toBe(max)
  })
})
