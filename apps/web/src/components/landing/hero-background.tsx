export function HeroBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="bg-primary/5 absolute -top-1/2 left-1/2 aspect-square w-full max-w-2xl -translate-x-1/2 rounded-full blur-3xl" />
      <div className="bg-primary/5 absolute -bottom-1/2 left-1/2 aspect-square w-full max-w-xl -translate-x-1/2 rounded-full blur-3xl" />
    </div>
  )
}
