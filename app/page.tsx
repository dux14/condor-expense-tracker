import CondorLogo from "@/components/common/CondorLogo";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
      <CondorLogo size={88} />
      <h1 className="font-heading text-2xl text-condor-primary">Cóndor</h1>
    </div>
  );
}
