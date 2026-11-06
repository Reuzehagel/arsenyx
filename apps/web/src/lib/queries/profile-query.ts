import type { BuildListResponse } from "@arsenyx/shared/api/build-dto"
import type {
  Profile,
  ProfileDirectoryResponse,
} from "@arsenyx/shared/api/users"
import { queryOptions } from "@tanstack/react-query"

import { apiCall } from "@/lib/util/api-client"
import { directoryQueryString } from "@/lib/util/directory-search"

import { buildKeys } from "./build-query"
import { type BuildListParams, listQueryString } from "./builds-list-query"

/** Usernames are case-insensitive, so keys lowercase them: `/u/Foo` and
 *  `/u/foo` share one cache entry. */
const profileKeys = {
  directory: (page: number, q?: string) =>
    ["profiles", "directory", page, q ?? ""] as const,
  detail: (username: string) => ["profile", username.toLowerCase()] as const,
}

const userPath = (username: string) => `/users/${encodeURIComponent(username)}`

export const profilesDirectoryQuery = (page: number, q?: string) =>
  queryOptions({
    queryKey: profileKeys.directory(page, q),
    queryFn: () =>
      apiCall<ProfileDirectoryResponse>(
        `/users${directoryQueryString(page, q)}`,
        { codes: { default: "failed to load profiles" } },
      ),
  })

export const profileQuery = (username: string) =>
  queryOptions({
    queryKey: profileKeys.detail(username),
    queryFn: () =>
      apiCall<Profile>(userPath(username), {
        notFoundOn404: true,
        codes: { default: "failed to load profile" },
      }),
  })

export const profileBuildsQuery = (username: string, params: BuildListParams) =>
  queryOptions({
    queryKey: buildKeys.profileList(username, params),
    queryFn: () =>
      apiCall<BuildListResponse>(
        `${userPath(username)}/builds${listQueryString(params, "user")}`,
        { codes: { default: "failed to load builds" } },
      ),
  })
