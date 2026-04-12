/**
 * Shared Prisma select shapes used across multiple DB modules
 */

export const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  username: true,
  displayUsername: true,
  image: true,
} as const
