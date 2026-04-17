"use client"

import { ThumbsUp } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { toggleVoteAction } from "@/app/actions/social"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

interface VoteButtonProps {
  buildId: string
  initialVoteCount: number
  initialHasVoted: boolean
}

export function VoteButton({
  buildId,
  initialVoteCount,
  initialHasVoted,
}: VoteButtonProps) {
  const { data: session, isPending: isSessionLoading } = useSession()
  const [isPending, startTransition] = useTransition()
  const [hasVoted, setHasVoted] = useState(initialHasVoted)
  const [voteCount, setVoteCount] = useState(initialVoteCount)

  const handleVote = () => {
    if (isSessionLoading) return

    if (!session?.user) {
      toast.error("Sign in to vote on builds")
      return
    }

    // Optimistic update
    setHasVoted((prev) => !prev)
    setVoteCount((prev) => (hasVoted ? prev - 1 : prev + 1))

    startTransition(async () => {
      const result = await toggleVoteAction(buildId)

      if (!result.success) {
        // Revert on error
        setHasVoted((prev) => !prev)
        setVoteCount((prev) => (hasVoted ? prev + 1 : prev - 1))
        toast.error(result.error ?? "Failed to vote")
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-8 gap-1.5", hasVoted && "text-primary")}
      onClick={handleVote}
      disabled={isPending}
    >
      <ThumbsUp
        data-icon="inline-start"
        className={cn(hasVoted && "fill-current")}
      />
      <span className="tabular-nums">{voteCount}</span>
    </Button>
  )
}
