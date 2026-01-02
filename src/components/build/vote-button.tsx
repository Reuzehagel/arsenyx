"use client";

import { useState, useTransition } from "react";
import { useSession } from "@/lib/auth-client";
import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleVoteAction } from "@/app/actions/social";
import { toast } from "sonner";

interface VoteButtonProps {
  buildId: string;
  initialVoteCount: number;
  initialHasVoted: boolean;
}

export function VoteButton({
  buildId,
  initialVoteCount,
  initialHasVoted,
}: VoteButtonProps) {
  const { data: session, isPending: isSessionLoading } = useSession();
  const [isPending, startTransition] = useTransition();
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [voteCount, setVoteCount] = useState(initialVoteCount);

  const handleVote = () => {
    if (isSessionLoading) return;

    if (!session?.user) {
      toast.error("Sign in to vote on builds");
      return;
    }

    // Optimistic update
    const newVoted = !hasVoted;
    const newCount = newVoted ? voteCount + 1 : voteCount - 1;
    setHasVoted(newVoted);
    setVoteCount(newCount);

    startTransition(async () => {
      const result = await toggleVoteAction(buildId);

      if (!result.success) {
        // Revert on error
        setHasVoted(hasVoted);
        setVoteCount(voteCount);
        toast.error(result.error ?? "Failed to vote");
      }
    });
  };

  const isDisabled = isPending || status === "loading";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1.5 h-8", hasVoted && "text-primary")}
      onClick={handleVote}
      disabled={isDisabled}
    >
      <ThumbsUp className={cn("h-4 w-4", hasVoted && "fill-current")} />
      <span className="tabular-nums">{voteCount}</span>
    </Button>
  );
}
