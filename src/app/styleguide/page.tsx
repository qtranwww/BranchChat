import Link from "next/link";

const colorTokens = [
  { name: "Page", value: "#fafaf9", className: "bg-page" },
  { name: "Surface", value: "#ffffff", className: "bg-surface" },
  { name: "Muted surface", value: "#f5f5f4", className: "bg-surface-muted" },
  { name: "Ink", value: "#1c1917", className: "bg-ink" },
  { name: "Muted text", value: "#57534e", className: "bg-muted" },
  { name: "Accent", value: "#292524", className: "bg-accent" },
];

const spacingTokens = [
  { name: "space-1", variable: "--branch-space-1" },
  { name: "space-2", variable: "--branch-space-2" },
  { name: "space-3", variable: "--branch-space-3" },
  { name: "space-4", variable: "--branch-space-4" },
  { name: "space-5", variable: "--branch-space-5" },
  { name: "space-6", variable: "--branch-space-6" },
  { name: "space-8", variable: "--branch-space-8" },
];

export default function StyleGuidePage() {
  return (
    <main className="min-h-screen bg-page text-ink">
      <div className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
        <header className="flex items-center justify-between border-b border-line pb-5">
          <div>
            <p className="text-lg font-semibold">BranchChat</p>
            <p className="mt-1 text-sm text-subtle">Styles and interface basics</p>
          </div>
          <Link className="text-sm text-muted underline underline-offset-4" href="/">
            Back home
          </Link>
        </header>

        <div className="space-y-12 py-12">
          <section>
            <h1 className="text-4xl font-semibold tracking-tight">Style guide</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
              A small set of reusable visual decisions for the BranchChat interface.
            </p>
          </section>

          <section aria-labelledby="colors-heading">
            <SectionHeading id="colors-heading" title="Colors" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {colorTokens.map((token) => (
                <div className="rounded-card border border-line bg-surface p-3 shadow-card" key={token.name}>
                  <div className={`h-16 rounded-md ${token.className}`} />
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{token.name}</span>
                    <span className="font-mono text-xs text-subtle">{token.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="type-heading">
            <SectionHeading id="type-heading" title="Typography" />
            <div className="space-y-5 rounded-card border border-line bg-surface p-6 shadow-card">
              <div>
                <p className="text-xs font-medium text-subtle">Heading</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">Keep the main thought.</p>
              </div>
              <div>
                <p className="text-xs font-medium text-subtle">Body</p>
                <p className="mt-2 max-w-xl text-base leading-7 text-muted">
                  Clear text, comfortable spacing, and enough contrast to keep the conversation easy to follow.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-subtle">Small text</p>
                <p className="mt-2 text-sm text-muted">Supporting information and quiet interface labels.</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="spacing-heading">
            <SectionHeading id="spacing-heading" title="Spacing" />
            <div className="space-y-3 rounded-card border border-line bg-surface p-6 shadow-card">
              {spacingTokens.map((token) => (
                <div className="flex items-center gap-4" key={token.name}>
                  <span className="w-16 font-mono text-xs text-subtle">{token.name}</span>
                  <span
                    className="block h-3 rounded-full bg-accent"
                    style={{ width: `var(${token.variable})`, minWidth: "0.25rem" }}
                  />
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="controls-heading">
            <SectionHeading id="controls-heading" title="Controls" />
            <div className="grid gap-6 rounded-card border border-line bg-surface p-6 shadow-card sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-subtle">Button</p>
                <button className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover" type="button">
                  Continue
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-subtle" htmlFor="styleguide-input">
                  Input
                </label>
                <input
                  className="mt-3 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-line"
                  id="styleguide-input"
                  placeholder="Write something"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SectionHeading({ id, title }: { id: string; title: string }) {
  return (
    <h2 className="mb-4 text-xl font-semibold" id={id}>
      {title}
    </h2>
  );
}
