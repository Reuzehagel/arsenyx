import Link from "next/link";
import { Button } from "@/components/ui/button";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The verification link has expired or has already been used.",
  Default: "An error occurred during authentication.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = errorMessages[error ?? "Default"] ?? errorMessages.Default;

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="mx-auto w-full max-w-sm flex flex-col gap-6 px-4 text-center">
        <div className="flex flex-col gap-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="size-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Authentication Error</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button render={<Link href="/auth/signin" />} nativeButton={false}>Try Again</Button>
          <Button variant="outline" render={<Link href="/" />} nativeButton={false}>Go Home</Button>
        </div>
      </div>
    </div>
  );
}
