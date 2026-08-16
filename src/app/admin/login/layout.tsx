export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-zinc-50 p-6">
      {/* Faint dot grid rather than a photograph — an admin console reads as
          a tool, not a marketing page, so the backdrop stays quiet. */}
      <div
        className="absolute inset-0 z-0 opacity-[0.6]"
        style={{
          backgroundImage: "radial-gradient(circle, rgb(0 0 0 / 0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(255,255,255,0.9),transparent)]" />

      <main className="relative z-10 flex w-full items-center justify-center">
        {children}
      </main>
    </div>
  );
}
