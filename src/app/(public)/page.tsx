import Link from "next/link";

const features = [
  {
    number: "01",
    icon: "🏡",
    title: "Find a companion",
    description:
      "Explore pets with different personalities, needs and backgrounds to find the right match for your home.",
  },
  {
    number: "02",
    icon: "💚",
    title: "Support their journey",
    description:
      "Foster care gives animals a safe, caring place to stay while they wait for their forever families.",
  },
  {
    number: "03",
    icon: "🩺",
    title: "Care that continues",
    description:
      "Keep track of pet health, vaccinations and important steps throughout the adoption journey.",
  },
];

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <section className="relative">
        <div className="page-shell grid min-h-[580px] items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dce6d9] bg-white px-4 py-2 text-sm font-semibold text-[#245c45] shadow-sm">
              <span aria-hidden="true">✦</span>
              A little love changes everything
            </div>

            <h1 className="max-w-xl text-5xl font-black leading-[1.08] tracking-tight text-[#24372d] sm:text-6xl lg:text-7xl">
              Their next chapter starts with{" "}
              <span className="text-[#3d805b]">you.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-8 text-[#69756c] sm:text-lg">
              Meet your future best friend, give a pet a temporary home, or
              help an animal take the next step toward a family of their own.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/pets" className="primary-button">
                Meet the pets <span aria-hidden="true">→</span>
              </Link>

              <Link href="/register" className="secondary-button">
                Join our community
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-[#e4e4d9] pt-6">
              <div>
                <p className="font-bold text-[#245c45]">Adopt</p>
                <p className="mt-1 text-sm text-[#69756c]">
                  Find your companion
                </p>
              </div>

              <div>
                <p className="font-bold text-[#245c45]">Foster</p>
                <p className="mt-1 text-sm text-[#69756c]">
                  Offer a safe place
                </p>
              </div>

              <div>
                <p className="font-bold text-[#245c45]">Care</p>
                <p className="mt-1 text-sm text-[#69756c]">
                  Support every step
                </p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-[#e6c9b5]/50 blur-2xl" />
            <div className="absolute -bottom-8 -left-5 h-36 w-36 rounded-full bg-[#c9dfce]/70 blur-2xl" />

            <div className="relative overflow-hidden rounded-[32px] border-[8px] border-white bg-[#e8efe7] shadow-[0_25px_80px_rgba(36,55,45,0.14)]">
              {/* Remote image is deliberately loaded with a regular img tag. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1100&q=85"
                alt="A happy golden dog enjoying a sunny day"
                className="h-[350px] w-full object-cover sm:h-[460px]"
              />

              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-lg backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8efe7] text-2xl">
                    ❤️
                  </span>

                  <div>
                    <p className="font-bold text-[#24372d]">
                      A new beginning
                    </p>
                    <p className="mt-1 text-sm text-[#69756c]">
                      One connection can change two lives.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -left-3 top-8 rounded-2xl bg-white px-4 py-3 shadow-lg sm:-left-8">
              <p className="text-sm font-bold text-[#245c45]">
                🐾 Love lives here
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e9e7dc] bg-white py-16 sm:py-20">
        <div className="page-shell">
          <div className="max-w-2xl">
            <p className="section-eyebrow">How Pawfect Match works</p>

            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#24372d] sm:text-4xl">
              More than finding a pet.
              <br />
              Finding a connection.
            </h2>

            <p className="mt-4 leading-7 text-[#69756c]">
              Every animal has a story. We help make the journey from care to
              a forever home easier to follow.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="group rounded-[24px] border border-[#e4e4d9] bg-[#faf8f2] p-6 transition duration-200 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e4eee3] text-2xl">
                    {feature.icon}
                  </span>

                  <span className="text-sm font-bold text-[#b1b9ac]">
                    {feature.number}
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold text-[#24372d]">
                  {feature.title}
                </h3>

                <p className="mt-3 leading-7 text-[#69756c]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-[28px] bg-[#245c45] p-7 text-white sm:flex sm:items-center sm:justify-between sm:p-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-[#c9dfce]">
                Your next best friend is waiting
              </p>

              <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
                Ready to meet them?
              </h2>
            </div>

            <Link
              href="/pets"
              className="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-bold text-[#245c45] hover:bg-[#edf3eb] sm:mt-0"
            >
              Explore available pets →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}