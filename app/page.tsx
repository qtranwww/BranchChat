import { ConversationNode } from "@/components/conversation-node";

const sampleQuestion = "Ask anything";
const sampleAnswer = "\\<answer zone\\>";

export default function Home() {
  return (
    <main className="conversation-canvas">
      <section className="node-demo" aria-labelledby="page-title">
        <h1 id="page-title">BranchChat</h1>

        <ConversationNode question={sampleQuestion} answer={sampleAnswer} isTip />
      </section>
    </main>
  );
}
