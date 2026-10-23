import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-page text-ink">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-line pb-5">
          <Link className="text-lg font-semibold" href="/" aria-label="BranchChat home">
            BranchChat
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-20">
          <p className="mb-4 text-sm text-subtle">A simple conversation workspace</p>
          <h1 className="max-w-xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Explore an idea without losing the main thought.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted">
            BranchChat will let you keep a main conversation and open separate paths whenever a new question comes up.
          </p>

          <div className="mt-10 max-w-xl rounded-card border border-line bg-surface p-5 shadow-card">
            <label className="block text-sm font-medium text-ink" htmlFor="first-question">
              Start with a question
            </label>
            <textarea
              className="mt-3 min-h-28 w-full resize-y rounded-md border border-input bg-surface p-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-line"
              id="first-question"
              placeholder="What would you like to explore?"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
