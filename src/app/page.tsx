import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-stone-200 pb-5">
          <Link className="text-lg font-semibold" href="/" aria-label="BranchChat home">
            BranchChat
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-20">
          <p className="mb-4 text-sm text-stone-500">A simple conversation workspace</p>
          <h1 className="max-w-xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Explore an idea without losing the main thought.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-stone-600">
            BranchChat will let you keep a main conversation and open separate paths whenever a new question comes up.
          </p>

          <div className="mt-10 max-w-xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-medium text-stone-800" htmlFor="first-question">
              Start with a question
            </label>
            <textarea
              className="mt-3 min-h-28 w-full resize-y rounded-md border border-stone-300 bg-white p-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
              id="first-question"
              placeholder="What would you like to explore?"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
