import { PrismaClient } from "@prisma/client";
import { DEFAULT_PROGRAMS } from "../src/lib/schedule/defaults";

const db = new PrismaClient();

const PRODUCTS = [
  { slug: "ai-music-review", name: "AI-music submission & editorial review", type: "ARTIST_SHOWCASE", min: 1000, max: 2000,
    description: "Editorial listening and rights review. Review does not guarantee acceptance or airplay." },
  { slug: "artist-spotlight", name: "Approved artist spotlight package", type: "ARTIST_SHOWCASE", min: 3500, max: 7500,
    description: "For tracks already approved by NCVR: featured placement in an Independent Frequency spotlight." },
  { slug: "artist-interview-30", name: "30-minute artist interview", type: "INTERVIEW", min: 7500, max: 15000,
    description: "A hosted on-air conversation, subject to host approval and scheduling." },
  { slug: "hosted-show-60", name: "One-hour hosted radio show", type: "HOSTED_SHOW", min: 10000, max: 25000,
    description: "A one-hour program slot hosted by you or NCVR, subject to content review." },
  { slug: "commercial-30", name: "30-second commercial production", type: "COMMERCIAL_PRODUCTION", min: 5000, max: 10000,
    description: "Scripted and produced 30-second spot. Airtime booked separately." },
  { slug: "show-sponsorship", name: "Sponsored show placement", type: "SHOW_SPONSORSHIP", min: null, max: null,
    description: "Custom quote. Sponsorships are disclosed on-air and on the website." },
] as const;

async function main() {
  const station = await db.station.upsert({
    where: { slug: "ncvr" },
    update: {},
    create: { slug: "ncvr", name: "Nite Cap Vibe Radio", tagline: "After Dark. Beyond Sound. Into the Vibe.", timezone: "America/New_York" },
  });

  const caprio = await db.host.upsert({
    where: { slug: "caprio-jackson" },
    update: {},
    create: { slug: "caprio-jackson", name: "Caprio Jackson", featured: true, imagePath: "/brand/caprio-marble.jpg",
      bio: "Founder and voice of Nite Cap Vibe Radio. Producer, artist and architect of the NCVR sound." },
  });
  await db.artist.upsert({
    where: { slug: "caprio-jackson" },
    update: {},
    create: { slug: "caprio-jackson", name: "Caprio Jackson", isCaprio: true, featured: true, imagePath: "/brand/caprio-banner.jpg",
      bio: "Caprio Jackson's catalog — VIBE, ATL Soul, Alt Dimension, Gospel Cinematic and Vibe 19 — is the foundation of NCVR." },
  });

  for (const p of DEFAULT_PROGRAMS) {
    const existing = await db.program.findUnique({ where: { stationId_slug: { stationId: station.id, slug: p.slug } } });
    if (existing) continue; // never clobber edits made in the studio
    await db.program.create({
      data: {
        stationId: station.id, slug: p.slug, title: p.title, description: p.description, format: p.format, bucket: p.bucket,
        isFallback: Boolean(p.isFallback), hostId: p.format === "LIVE" || p.bucket === "CAPRIO" ? caprio.id : null,
        slots: { create: p.slots.flatMap(([days, s, e]) => days.map((d) => ({ dayOfWeek: d, startMinute: s * 60, endMinute: e * 60 }))) },
      },
    });
  }

  for (const pr of PRODUCTS) {
    await db.product.upsert({
      where: { stationId_slug: { stationId: station.id, slug: pr.slug } },
      update: {},
      create: { stationId: station.id, slug: pr.slug, name: pr.name, description: pr.description, type: pr.type, priceMinCents: pr.min, priceMaxCents: pr.max },
    });
  }
  console.log(`Seeded station ${station.name}: ${DEFAULT_PROGRAMS.length} programs, ${PRODUCTS.length} products.`);
  console.log("Create the owner account with: npm run user:create -- --email you@example.com --name \"Caprio Jackson\" --role OWNER");
}

main().finally(() => db.$disconnect());
