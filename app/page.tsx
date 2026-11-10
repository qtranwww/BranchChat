import { InitialComposer } from "@/components/initial-composer";

export default function Home() {
  return (
    <main className="conversation-canvas">
      <section className="initial-state" aria-labelledby="initial-prompt-title">
        <h1 id="initial-prompt-title">BranchChat</h1>

        <InitialComposer />
      </section>
    </main>
  );
}
