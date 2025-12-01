export function HeroBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 aspect-square w-full max-w-2xl bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-1/2 left-1/2 -translate-x-1/2 aspect-square w-full max-w-xl bg-primary/5 rounded-full blur-3xl" />
    </div>
  );
}
