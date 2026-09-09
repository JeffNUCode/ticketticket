import { getCatalog } from "@/lib/data";
import { cityLabel, parseCity } from "@/lib/cities";

export const revalidate = 300;

export default async function CinemasPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const city = parseCity(typeof searchParams.city === "string" ? searchParams.city : undefined);
  const { cinemas } = await getCatalog();
  const list = cinemas.filter((c) => c.city === city);
  const chains = [...new Set(list.map((c) => c.chain))];

  return (
    <div className="space-y-6">
      <h1 className="page-title">Cinemas · {cityLabel(city)}</h1>
      {chains.map((chain) => (
        <section key={chain}>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/45">
            {chain}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {list
              .filter((c) => c.chain === chain)
              .map((c) => (
                <li key={c.id} className="panel p-4">
                  <p className="font-display text-lg font-bold text-white">{c.mall}</p>
                  <p className="text-sm text-white/50">{c.address}</p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
