// E24b — minimal HTTP load generator (no dependency). Usage:
//   node scripts/load/http-load.mjs http://localhost:3000 [seconds=20] [concurrency=20] /path1 /path2 …
// Each virtual user requests the paths in turn for the given time; prints count, errors, req/s and latency
// percentiles per path. Run it against a production build (`next build && next start`), never against a live site.
const [base, secondsArg = "20", concArg = "20", ...paths] = process.argv.slice(2);
if (!base || paths.length === 0) { console.error("usage: http-load.mjs BASE [seconds] [concurrency] /path…"); process.exit(2); }
const seconds = Number(secondsArg), concurrency = Number(concArg);
const stats = new Map(paths.map((p) => [p, { lat: [], errors: 0, bytes: 0 }]));
const end = Date.now() + seconds * 1000;
async function user(id) {
  let i = id;
  while (Date.now() < end) {
    const path = paths[i++ % paths.length];
    const s = stats.get(path);
    const t0 = performance.now();
    try {
      const r = await fetch(base + path, { redirect: "manual", headers: { "user-agent": "sawwa-load-test" } });
      const body = await r.arrayBuffer();
      s.bytes += body.byteLength;
      if (r.status >= 500) s.errors++;
      s.lat.push(performance.now() - t0);
    } catch { s.errors++; }
  }
}
await Promise.all(Array.from({ length: concurrency }, (_, k) => user(k)));
const pct = (a, q) => a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))].toFixed(0) : "-";
let total = 0;
console.log(`${concurrency} utilisateurs simultanés pendant ${seconds} s sur ${base}`);
console.log("chemin".padEnd(32), "requêtes", "erreurs", "  p50 ms", "  p95 ms", "  p99 ms", " Ko moy.");
for (const [path, s] of stats) {
  const a = s.lat.sort((x, y) => x - y);
  total += a.length;
  console.log(path.padEnd(32), String(a.length).padStart(8), String(s.errors).padStart(7), pct(a, 0.5).padStart(8), pct(a, 0.95).padStart(8), pct(a, 0.99).padStart(8), String(a.length ? Math.round(s.bytes / a.length / 1024) : 0).padStart(8));
}
console.log(`débit total : ${(total / seconds).toFixed(1)} requêtes/s`);
