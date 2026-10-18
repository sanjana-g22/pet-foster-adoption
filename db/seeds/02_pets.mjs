// Seeds ~100 pets (+3 hand-made demo pets), 12 foster homes, placements, vaccinations,
// medical records and a realistic back-dated status history.
// Re-runnable: it deletes its own earlier data first (pets whose microchip starts with 985112,
// and users whose email ends with @seed.local). Deterministic: same data every run.
// Usage: npm run db:seed:pets   (run db:seed:accounts first so history shows "Sam Staff")
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

const url = process.env.DATABASE_URL_DIRECT;
if (!url) {
  console.error("DATABASE_URL_DIRECT is missing in .env.local");
  process.exit(1);
}

// ---------- tiny deterministic random helpers ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261018);
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function weighted(obj) {
  const total = Object.values(obj).reduce((s, v) => s + v, 0);
  let r = rnd() * total;
  for (const [k, v] of Object.entries(obj)) { if ((r -= v) <= 0) return k; }
  return Object.keys(obj)[0];
}
const range = (a, b) => a + rnd() * (b - a);

const DAY = 86400000;
const NOW = Date.now();
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);
const YESTERDAY = ymd(NOW - DAY);
const clampPast = (d) => (ymd(d) > YESTERDAY ? YESTERDAY : ymd(d));

// ---------- data pools ----------
const MALE = ["Max","Charlie","Simba","Tiger","Leo","Cooper","Buddy","Zeus","Oscar","Milo","Jack","Toby","Duke","Bear","Finn","Gizmo","Murphy","Teddy","Bailey","Ollie","Rufus","Sam","Henry","Jasper","Archie","Loki","Thor","Bandit","Biscuit","Shadow","Moose","Ziggy","Apollo","Kiko","Bolt","Chester","Dexter","Frodo","Hobbes","Jax","Kobe","Mango","Nemo","Peanut","Pablo","Rambo","Scout","Tucker","Waffles","Yogi","Zorro","Bruce","Chewie","Dobby","Elvis","Fudge","Gus"];
const FEMALE = ["Luna","Bella","Daisy","Lucy","Coco","Nala","Sasha","Lily","Molly","Chloe","Pepper","Maya","Ruby","Zoe","Mia","Cleo","Honey","Penny","Rosie","Stella","Willow","Poppy","Ginger","Hazel","Misty","Sophie","Tilly","Maggie","Lola","Gigi","Pumpkin","Cinnamon","Biscotti","Dolly","Freya","Gracie","Juno","Kali","Lexi","Muffin","Nova","Olive","Piper","Roxy","Sunny","Tara","Uma","Vera","Winnie","Xena","Yuki","Zara","Annie","Bonnie","Cookie","Dixie","Emmy"];

const BREEDS = {
  dog: [
    ["Labrador Retriever","large",25,36],["Golden Retriever","large",25,34],["German Shepherd","large",22,40],
    ["Indian Pariah (Indie)","medium",12,25],["Indian Pariah (Indie)","medium",12,25],["Beagle","medium",9,14],
    ["Pug","small",6,9],["Shih Tzu","small",4,8],["Rottweiler","large",35,50],["Boxer","large",25,32],
    ["Indian Spitz","small",6,12],["Dachshund","small",7,14],["Siberian Husky","large",16,27],
    ["Cocker Spaniel","medium",12,14],["Border Collie","medium",14,20],["Mixed breed","medium",10,25],["Labrador mix","large",20,30],
  ],
  cat: [
    ["Domestic Shorthair (Indie)","small",3,5],["Domestic Shorthair (Indie)","small",3,5],["Domestic Shorthair (Indie)","small",3,5],
    ["Persian","small",3,6],["Siamese","small",3,5.5],["Bengal","medium",4,7],["Maine Coon","large",6,10],["Ragdoll","medium",4.5,9],
  ],
  rabbit: [["Holland Lop","small",1.5,2],["Dutch","small",1.5,2.5],["Mini Rex","small",1.5,2],["Lionhead","small",1.4,1.8]],
  other: [["Guinea Pig","small",0.7,1.2],["Hamster","small",0.1,0.15],["Parakeet","small",0.03,0.04]],
};

const ARCH = {
  calm: { energy: [1, 2], kids: 0.8, pets: 0.7, apt: 0.9, trained: 0.7,
    temp: ["calm","gentle","easygoing","mellow","relaxed","quiet"],
    lines: ["{N} is happiest curled up beside you while you work or watch TV.","{P} has a laid-back nature and rarely fusses over anything.","A quiet companion, {N} enjoys peaceful routines and long naps.","{P} is unbothered by noise and settles into a new home quickly."] },
  playful: { energy: [4, 5], kids: 0.85, pets: 0.65, apt: 0.3, trained: 0.5,
    temp: ["playful","cheerful","goofy","bouncy","friendly","outgoing"],
    lines: ["{N} turns everything into a game and keeps the whole household laughing.","{P} is bursting with joy and loves a good play session.","{N} greets everyone like a long-lost friend.","{P} is always up for toys, games and new adventures."] },
  energetic: { energy: [5, 5], kids: 0.6, pets: 0.45, apt: 0.1, trained: 0.5,
    temp: ["energetic","athletic","driven","adventurous","spirited","active"],
    lines: ["{N} has endless stamina and needs a daily outlet for all that energy.","{P} thrives with an active family that loves running, hiking or long outings.","A bundle of power, {N} needs lots of exercise and mental stimulation.","{P} gets bored easily and does best with a job to do."] },
  shy: { energy: [1, 3], kids: 0.3, pets: 0.4, apt: 0.8, trained: 0.6,
    temp: ["shy","timid","sensitive","reserved","cautious","soft-hearted"],
    lines: ["{N} needs time to warm up but is fiercely loyal once trust is earned.","{P} prefers quiet homes and gentle, patient handling.","With a little patience, {N} blossoms into a sweet and devoted companion.","{P} startles at sudden noises and does best with a calm routine."] },
  affectionate: { energy: [2, 4], kids: 0.9, pets: 0.7, apt: 0.7, trained: 0.7,
    temp: ["affectionate","loving","cuddly","sweet","people-loving","devoted"],
    lines: ["{N} is a true cuddle-bug who loves nothing more than being close to people.","{P} follows you from room to room and melts into your lap.","{N} thrives on attention and returns every bit of love tenfold.","{P} is happiest when included in every family activity."] },
  independent: { energy: [2, 3], kids: 0.4, pets: 0.5, apt: 0.8, trained: 0.8,
    temp: ["independent","dignified","self-assured","aloof","thoughtful","observant"],
    lines: ["{N} enjoys company on {poss} own terms and values personal space.","{P} is content entertaining {refl} and appreciates a predictable routine.","A confident character, {N} chooses {poss} favourite people carefully.","{P} is low-maintenance and fits well with busy working households."] },
  protective: { energy: [3, 4], kids: 0.4, pets: 0.3, apt: 0.3, trained: 0.6,
    temp: ["loyal","protective","alert","confident","devoted","steady"],
    lines: ["{N} is deeply loyal and takes the role of family guardian seriously.","{P} is alert and confident, and needs an experienced, consistent handler.","Once bonded, {N} will stay by your side through anything.","{P} is wary of strangers at first but wonderfully loving at home."] },
  curious: { energy: [3, 4], kids: 0.7, pets: 0.6, apt: 0.6, trained: 0.6,
    temp: ["curious","clever","inquisitive","bright","alert","adaptable"],
    lines: ["{N} investigates every corner and loves puzzle toys and new experiences.","{P} is clever and learns routines and tricks quickly.","Nothing escapes {N}'s attention, and {P} loves exploring new places.","{P} is a quick learner who enjoys mental games as much as physical ones."] },
  senior_gentle: { energy: [1, 2], kids: 0.6, pets: 0.6, apt: 0.9, trained: 0.9,
    temp: ["gentle","wise","serene","grateful","mellow","affectionate"],
    lines: ["{N} has lived a full life and now only wants a soft bed and a loving lap.","{P} is calm, grateful and wonderfully well-mannered.","Slow walks and sunny spots are {N}'s idea of a perfect day.","{P} proves that senior companions make the most loyal friends."] },
  anxious: { energy: [2, 3], kids: 0.3, pets: 0.4, apt: 0.6, trained: 0.5,
    temp: ["sensitive","anxious","clingy","loving","needy","gentle"],
    lines: ["{N} gets nervous when left alone and does best with someone home most of the day.","{P} is building confidence and thrives with a patient, consistent family.","{N} bonds deeply and needs reassurance during big changes.","{P} is working on separation anxiety and responds well to routine."] },
};
const ARCH_WEIGHTS = {
  dog: { calm: 14, playful: 18, energetic: 14, shy: 8, affectionate: 16, protective: 9, curious: 7, anxious: 6 },
  cat: { calm: 14, playful: 10, shy: 12, affectionate: 20, independent: 24, curious: 14, anxious: 6 },
  rabbit: { calm: 25, playful: 15, shy: 20, affectionate: 15, curious: 25 },
  other: { calm: 25, shy: 25, curious: 30, playful: 20 },
};
const SPECIES_LINES = {
  dog: ["{N} knows how to sit and loves learning new tricks.","{N} is a champion at fetch.","{N} can't resist a good belly rub.","{N} gets wildly excited at the sound of the leash.","{N} loves car rides with the window down."],
  cat: ["{N} loves chasing a feather wand at sunset.","{N} purrs loudly the moment you sit down.","{N} has a favourite sunny windowsill.","{N} chirps hello every morning.","{N} adores scratching posts and cardboard boxes."],
  rabbit: ["{N} does happy little binkies when excited.","{N} loves fresh coriander and carrot tops.","{N} enjoys time out of the hutch to explore.","{N} is gentle when handled and loves being stroked."],
  other: ["{N} is gentle when handled.","{N} loves exploring tunnels and hideouts.","{N} perks up whenever fresh veggies appear."],
};
const SPECIAL = [
  "Needs daily medication for a thyroid condition",
  "Partially deaf and responds well to hand signals",
  "Recovering from a fractured leg, so only gentle exercise for now",
  "Needs a special diet for sensitive digestion",
  "Mild skin allergy managed with medicated baths",
  "Missing one eye but fully adapted and confident",
  "Needs regular joint supplements for arthritis",
  "Requires twice-daily eye drops",
];
const SOURCES = { "Stray rescue": 40, "Owner surrender": 25, "Abandoned": 15, "Transfer from partner shelter": 12, "Born in shelter": 8 };
const SRC_TEXT = {
  "Stray rescue": ["a stray found near {place}","a rescue from the streets of {place}"],
  "Owner surrender": ["an owner surrender after a family move","an owner surrender due to a change in circumstances"],
  "Abandoned": ["an abandoned pet found near {place}"],
  "Transfer from partner shelter": ["a transfer from a partner shelter"],
  "Born in shelter": ["part of a litter born in our care"],
};
const PLACES = ["Koramangala","Indiranagar","Jayanagar","Whitefield","HSR Layout","Malleshwaram","Electronic City","Yelahanka","Banashankari","Hebbal"];
const VETS = ["Dr. Meera Nair","Dr. Arjun Rao","Dr. Kavya Shetty","Dr. R. Iyer"];
const NOTES = {
  intake: "Pet record created at intake", medical_hold: "Held for medical treatment",
  available: "Cleared for adoption", in_foster: "Placed in foster care",
  adoption_pending: "Adoption application approved", adopted: "Adoption finalised",
  follow_up: "Post-adoption follow-up period started", closed: "Follow-up completed, case closed",
  returned: "Returned by adopter",
};
const FOSTER_NAMES = ["Priya Nair","Rahul Menon","Sneha Iyer","Vikram Rao","Divya Shetty","Karthik Gowda","Meera Pillai","Ananya Reddy","Rohan Kulkarni","Nisha Patel","Imran Sheikh","Lakshmi Narayan"];
const FOSTER_CITIES = ["Koramangala","Indiranagar","Jayanagar","Whitefield","HSR Layout","Malleshwaram","Basavanagudi","JP Nagar","Yelahanka","BTM Layout","Hebbal","Marathahalli"];

const fill = (t, c) => t
  .replaceAll("{N}", c.name).replaceAll("{P}", c.P).replaceAll("{poss}", c.poss).replaceAll("{refl}", c.refl)
  .replaceAll("{place}", c.place).replaceAll("{age}", c.age).replaceAll("{breed}", c.breed);

function describe(p) {
  const place = pick(PLACES);
  const he = p.sex === "male";
  const ctx = { name: p.name, P: he ? "He" : "She", poss: he ? "his" : "her", refl: he ? "himself" : "herself", place, breed: p.breed, age: p.ageStr };
  const art = /^(8|11|18)/.test(p.ageStr) ? "an" : "a";
  const open = pick([
    `{N} is ${art} {age} {breed} who came to us as ${pick(SRC_TEXT[p.source])}.`,
    `Meet {N}, ${art} {age} {breed} who arrived as ${pick(SRC_TEXT[p.source])}.`,
    `{N}, ${art} {age} {breed}, joined the shelter as ${pick(SRC_TEXT[p.source])}.`,
  ]);
  const arch = ARCH[p.arch];
  const [l1, l2] = shuffle(arch.lines).slice(0, 2);
  const parts = [open, l1, l2];
  if (chance(0.55)) parts.push(pick(SPECIES_LINES[p.species]));
  parts.push(p.kids ? pick(["{P} is wonderful with children.","{P} adores kids and is patient with little hands."]) : "{P} is best suited to a home with older children, or none at all.");
  parts.push(p.apt ? "{P} adapts well to apartment living." : (p.species === "dog" ? "{P} needs room to move, ideally a home with a garden or terrace." : "{P} needs plenty of space to climb and explore."));
  if (chance(0.6)) parts.push(p.pets ? "{P} gets along nicely with other animals." : "{P} would prefer to be the only pet in the home.");
  if ((p.species === "dog" || p.species === "cat") && chance(0.5)) parts.push(p.trained ? "{P} is already house trained." : "{P} is still learning house manners.");
  if (p.special) parts.push(`Please note: ${p.special.toLowerCase()}.`);
  return parts.map((s) => fill(s, ctx)).join(" ");
}

// ---------- timeline helpers ----------
const ADOPTION_FAMILY = ["adoption_pending", "adopted", "follow_up", "closed", "returned"];
function buildPath(status) {
  const withFoster = chance(0.35);
  const pre = withFoster ? ["intake", "available", "in_foster"] : ["intake", "available"];
  switch (status) {
    case "intake": return ["intake"];
    case "medical_hold": return ["intake", "medical_hold"];
    case "available": return chance(0.3) ? ["intake", "medical_hold", "available"] : ["intake", "available"];
    case "in_foster": return ["intake", "available", "in_foster"];
    case "adoption_pending": return [...pre, "adoption_pending"];
    case "adopted": return [...pre, "adoption_pending", "adopted"];
    case "follow_up": return [...pre, "adoption_pending", "adopted", "follow_up"];
    case "closed": return [...pre, "adoption_pending", "adopted", "follow_up", "closed"];
    case "returned": return [...pre, "adoption_pending", "adopted", "returned"];
  }
}
const INTAKE_DAYS = {
  intake: [0, 6], medical_hold: [3, 20], available: [5, 130], in_foster: [15, 90],
  adoption_pending: [20, 100], adopted: [100, 300], follow_up: [95, 200], closed: [200, 360], returned: [60, 200],
};
function timeline(path, daysAgo, status) {
  const t0 = NOW - (daysAgo * 24 + int(2, 9)) * 3600000;
  const span = NOW - t0;
  const hi = ADOPTION_FAMILY.includes(status) ? 0.97 : 0.6;
  const fr = Array.from({ length: path.length - 1 }, () => range(0.05, hi)).sort((a, b) => a - b);
  return [t0, ...fr.map((f) => t0 + f * span)];
}

// ---------- pet generation ----------
function genPet(i, species, status, name, sex) {
  const [breed, size, wMin, wMax] = pick(BREEDS[species]);
  let ageMonths;
  if (species === "dog" || species === "cat") ageMonths = chance(0.15) ? int(3, 11) : chance(0.7) ? int(12, 95) : int(96, 170);
  else if (species === "rabbit") ageMonths = int(3, 96);
  else ageMonths = int(3, 48);
  const senior = ageMonths >= 96;
  const arch = senior && chance(0.7) ? "senior_gentle" : weighted(ARCH_WEIGHTS[species]);
  const a = ARCH[arch];
  let energy = int(a.energy[0], a.energy[1]);
  if (ageMonths < 12) energy = Math.min(5, energy + 1);
  if (senior) energy = Math.min(energy, 2);
  const kids = chance(a.kids);
  const pets = chance(a.pets);
  const apt = chance(a.apt) && !(size === "large" && energy >= 4);
  const trained = (species === "dog" || species === "cat") ? (ageMonths >= 6 && chance(a.trained)) : false;
  const special = chance(senior ? 0.3 : 0.12) ? pick(SPECIAL) : null;
  const source = weighted(SOURCES);
  let weight = wMin + rnd() * (wMax - wMin);
  if (ageMonths < 12) weight *= 0.25 + 0.75 * (ageMonths / 12);
  weight = Math.max(0.03, Math.round(weight * 100) / 100);
  const ageStr = ageMonths < 12 ? `${ageMonths}-month-old` : `${Math.floor(ageMonths / 12)}-year-old`;
  const path = buildPath(status);
  const daysAgo = int(...INTAKE_DAYS[status]) + (status === "available" && chance(0.2) ? int(20, 60) : 0);
  const p = {
    name, species, breed, sex, ageMonths, ageStr, size, weight, source, arch, kids, pets, apt, trained, special, energy,
    temperament: shuffle(a.temp).slice(0, 3).join(", "),
    microchip: "985112" + String(i + 1).padStart(9, "0"),
    status, path, ts: timeline(path, daysAgo, status), vaccines: "auto",
  };
  p.description = describe(p);
  return p;
}

function heroPets(startIndex) {
  const mk = (n, over, status) => {
    const path = status === "intake" ? ["intake"] : ["intake", "available"];
    const daysAgo = status === "intake" ? 0 : over.daysAgo;
    return { ...over, name: n, status, path, ts: timeline(path, daysAgo, status), source: "Owner surrender",
      microchip: "985112" + String(startIndex + 1).padStart(9, "0"), special: null };
  };
  const out = [];
  out.push(mk("Bruno", { species: "dog", breed: "Labrador mix", sex: "male", ageMonths: 18, size: "large", weight: 24.5, kids: true, pets: true, apt: false, trained: false, energy: 4, arch: "playful",
    temperament: "playful, friendly, energetic", vaccines: "none",
    description: "Bruno is an 18-month-old Labrador mix who came to us as an owner surrender after his family moved abroad. He is playful, friendly and full of energy, and he loves a good game of fetch. He is wonderful with children and gets along nicely with other dogs. He needs room to run, ideally a home with a garden or terrace, and he is still learning house manners." }, "intake"));
  startIndex++;
  out.push(mk("Mochi", { species: "cat", breed: "Domestic Shorthair (Indie)", sex: "female", ageMonths: 30, size: "small", weight: 4.1, kids: true, pets: true, apt: true, trained: true, energy: 2, arch: "calm", daysAgo: 24,
    temperament: "calm, affectionate, gentle", vaccines: "full",
    description: "Mochi is a calm, affectionate 2-year-old cat who loves lap time and quiet evenings. She came to us as an owner surrender after a family move. She is wonderful with children, gets along nicely with other pets, and adapts beautifully to apartment living. She is already house trained and is the ideal gentle companion for a small flat." }, "available"));
  startIndex++;
  out.push(mk("Rocky", { species: "dog", breed: "Boxer", sex: "male", ageMonths: 36, size: "large", weight: 29, kids: true, pets: false, apt: false, trained: true, energy: 5, arch: "energetic", daysAgo: 38,
    temperament: "energetic, athletic, spirited", vaccines: "full",
    description: "Rocky is an energetic 3-year-old Boxer who came to us as a stray found near Indiranagar. He has endless stamina and thrives with an active family that loves running, hiking or long outings. He adores children but would prefer to be the only pet in the home. He needs room to move, ideally a home with a garden or terrace, and he is already house trained." }, "available"));
  return out;
}

// ---------- main ----------
const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.seed_mode', 'on', true)"); // bypass lifecycle rules while loading history
  try {
    // 1. clean previous seed data
    await client.query("DELETE FROM foster_placements WHERE pet_id IN (SELECT id FROM pets WHERE microchip_no LIKE '985112%')");
    await client.query("DELETE FROM pets WHERE microchip_no LIKE '985112%'");
    await client.query("DELETE FROM users WHERE email LIKE '%@seed.local'");

    const staffRow = await client.query("SELECT id FROM users WHERE email = 'staff@demo.com'");
    const staffId = staffRow.rows[0]?.id ?? null;

    // 2. foster homes
    const hash = await bcrypt.hash("Demo@12345", 10);
    for (let i = 0; i < FOSTER_NAMES.length; i++) {
      const email = `foster${String(i + 1).padStart(2, "0")}@seed.local`;
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role_id, is_active, is_approved)
         VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = 'foster'), true, true) RETURNING id`,
        [email, hash, FOSTER_NAMES[i]]
      );
      const prefs = shuffle(["dog", "cat", "rabbit", "other"]).slice(0, int(1, 3));
      await client.query(
        `INSERT INTO foster_profiles (user_id, max_capacity, species_preference, experience_level, has_yard, address_city)
         VALUES ($1, $2, $3::species_type[], $4::experience_level, $5, $6)`,
        [rows[0].id, int(1, 4), prefs, pick(["first_time", "some", "experienced"]), chance(0.5), FOSTER_CITIES[i]]
      );
    }
    const fosters = (await client.query("SELECT user_id AS id, max_capacity AS cap FROM foster_profiles")).rows;
    const used = new Map(fosters.map((f) => [f.id, 0]));

    // 3. required vaccines (read from DB so we stay in sync with migration 011)
    const req = {};
    for (const r of (await client.query("SELECT species, vaccine_name FROM required_vaccines")).rows) {
      (req[r.species] ||= []).push(r.vaccine_name);
    }

    // 4. build the pet list
    const COUNTS = { available: 35, in_foster: 10, intake: 8, medical_hold: 6, adoption_pending: 5, adopted: 15, follow_up: 8, closed: 8, returned: 5 };
    const statuses = shuffle(Object.entries(COUNTS).flatMap(([s, n]) => Array(n).fill(s)));
    const speciesList = shuffle([...Array(60).fill("dog"), ...Array(30).fill("cat"), ...Array(7).fill("rabbit"), ...Array(3).fill("other")]);
    const males = shuffle(MALE), females = shuffle(FEMALE);
    let mi = 0, fi = 0;
    const pets = statuses.map((status, i) => {
      const sex = chance(0.5) ? "male" : "female";
      const name = sex === "male" ? males[mi++] : females[fi++];
      return genPet(i, speciesList[i], status, name, sex);
    });
    pets.push(...heroPets(pets.length));

    // a few available / in-foster pets get an EXPIRED vaccine (shows up on the overdue-vaccinations view)
    const expiredCandidates = pets.filter((p) => ["available", "in_foster"].includes(p.status) && req[p.species]?.length && p.vaccines === "auto");
    new Set(shuffle(expiredCandidates).slice(0, 6)).forEach((p) => (p.expiredDemo = true));

    // 5. insert everything
    let placements = 0, records = 0, vaccs = 0;
    for (const p of pets) {
      const intakeDate = ymd(p.ts[0]);
      const { rows } = await client.query(
        `INSERT INTO pets (name, species, breed, sex, age_months, size, weight_kg, microchip_no, status, intake_date,
                           intake_source, temperament, description, good_with_kids, good_with_pets, apartment_friendly,
                           house_trained, energy_level, special_needs, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
        [p.name, p.species, p.breed, p.sex, p.ageMonths, p.size, p.weight, p.microchip, p.status, intakeDate,
         p.source, p.temperament, p.description, p.kids, p.pets, p.apt, p.trained, p.energy, p.special, new Date(p.ts[0])]
      );
      const id = rows[0].id;

      // realistic back-dated history (replaces the single auto-created row)
      await client.query("DELETE FROM pet_status_history WHERE pet_id = $1", [id]);
      await client.query(
        `INSERT INTO pet_status_history (pet_id, from_status, to_status, changed_by, changed_at, note)
         SELECT $1, f, t, $2, ts, n
           FROM unnest($3::pet_status[], $4::pet_status[], $5::timestamptz[], $6::text[]) AS x(f, t, ts, n)`,
        [id, staffId, p.path.map((_, k) => (k === 0 ? null : p.path[k - 1])), p.path,
         p.ts.map((t) => new Date(t)), p.path.map((s) => NOTES[s])]
      );

      // vaccinations
      const needed = req[p.species] ?? [];
      const availIdx = p.path.indexOf("available");
      let vacc = [];
      const mode = p.vaccines === "auto"
        ? (availIdx >= 0 ? "full" : p.status === "medical_hold" ? (chance(0.5) ? "partial" : "none") : (chance(0.3) ? "partial" : "none"))
        : p.vaccines;
      if (mode === "full" || mode === "partial") {
        const list = mode === "full" ? needed : needed.slice(0, 1);
        const anchor = availIdx >= 0 ? p.ts[availIdx] : p.ts[p.ts.length - 1];
        list.forEach((v, k) => {
          if (p.expiredDemo && k === 0) {
            vacc.push([v, ymd(NOW - 380 * DAY), ymd(NOW - 15 * DAY)]);
          } else {
            let on = ymd(addDays(anchor, -int(1, 4)));
            if (on < intakeDate) on = intakeDate;
            if (on > YESTERDAY) on = YESTERDAY;
            vacc.push([v, on, ymd(addDays(on, 365))]);
          }
        });
      }
      if (vacc.length) {
        await client.query(
          `INSERT INTO vaccinations (pet_id, vaccine_name, vaccinated_on, expires_on, administered_by)
           SELECT $1, n, d1::date, d2::date, $5 FROM unnest($2::text[], $3::text[], $4::text[]) AS x(n, d1, d2)`,
          [id, vacc.map((v) => v[0]), vacc.map((v) => v[1]), vacc.map((v) => v[2]), pick(VETS)]
        );
        vaccs += vacc.length;
      }

      // medical records
      const recs = [];
      const firstDay = ymd(addDays(p.ts[0], 1));
      if (firstDay <= YESTERDAY) {
        recs.push(["checkup", firstDay, "Routine intake examination", "Deworming and flea treatment", "Overall condition assessed at intake"]);
        const lastDay = availIdx >= 0 ? clampPast(p.ts[availIdx]) : YESTERDAY;
        const between = () => {
          const a = new Date(firstDay).getTime(), b = new Date(lastDay < firstDay ? firstDay : lastDay).getTime();
          return ymd(a + Math.floor(rnd() * ((b - a) / DAY + 1)) * DAY);
        };
        if (p.special) recs.push(["treatment", between(), p.special, "Ongoing management and monitoring", "Follow-up needed every few weeks"]);
        if (p.ageMonths >= 6 && p.species !== "other" && chance(0.55)) recs.push(["surgery", between(), "Sterilisation (spay/neuter)", "Routine surgery, recovered well", "No complications"]);
        if (chance(0.25)) recs.push(["treatment", between(), pick(["Ear infection", "Minor skin irritation", "Upper respiratory infection", "Mild gastrointestinal upset"]), pick(["Antibiotic course", "Medicated wash", "Ear drops", "Bland diet and probiotics"]), "Resolved after treatment"]);
        if (chance(0.08)) recs.push(["behaviour", between(), pick(["Fear-based reactivity", "Mild separation anxiety"]), "Behaviour training plan started", "Progressing well"]);
      }
      if (recs.length) {
        await client.query(
          `INSERT INTO medical_records (pet_id, record_type, record_date, vet_name, diagnosis, treatment, notes, created_by)
           SELECT $1, t::medical_record_type, d::date, $7, dg, tr, nt, $8
             FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) AS x(t, d, dg, tr, nt)`,
          [id, recs.map((r) => r[0]), recs.map((r) => r[1]), recs.map((r) => r[2]), recs.map((r) => r[3]), recs.map((r) => r[4]), pick(VETS), staffId]
        );
        records += recs.length;
      }

      // foster placements (history stints + the active one)
      for (let k = 0; k < p.path.length; k++) {
        if (p.path[k] !== "in_foster") continue;
        const start = ymd(p.ts[k]);
        const nextStatus = p.path[k + 1];
        if (nextStatus === undefined) {
          // active placement: pick a foster with a free slot
          const f = shuffle(fosters).find((x) => used.get(x.id) < x.cap);
          if (!f) continue;
          used.set(f.id, used.get(f.id) + 1);
          const pl = await client.query(
            `INSERT INTO foster_placements (pet_id, foster_user_id, start_date, expected_end_date, status, created_by)
             VALUES ($1, $2, $3, $4, 'active', $5) RETURNING id`,
            [id, f.id, start, ymd(addDays(start, int(14, 60))), staffId]
          );
          placements++;
          const n = int(2, 4);
          const days = Array.from({ length: n }, () => clampPast(addDays(start, int(1, 20)))).filter((d) => d >= start && d <= YESTERDAY).sort();
          if (days.length) {
            await client.query(
              `INSERT INTO foster_updates (placement_id, update_date, weight_kg, behaviour_note, health_note, created_by)
               SELECT $1, d::date, $3, bn, hn, $2 FROM unnest($4::text[], $5::text[], $6::text[]) AS x(d, bn, hn)`,
              [pl.rows[0].id, f.id, p.weight,
               days, days.map(() => pick(["Settling in well, eating normally.", "Very playful today and sleeping through the night.", "A bit shy at first but warming up to the family.", "Following the daily routine without any trouble."])),
               days.map(() => pick(["No health concerns.", "Appetite good, coat looks healthy.", "Medication given as scheduled.", "Weight stable."]))]
          );
          }
        } else {
          const f = pick(fosters);
          await client.query(
            `INSERT INTO foster_placements (pet_id, foster_user_id, start_date, end_date, status, end_reason, created_by)
             VALUES ($1, $2, $3, $4, 'completed', $5, $6)`,
            [id, f.id, start, ymd(p.ts[k + 1]), nextStatus === "adoption_pending" ? "adopted" : "foster_request", staffId]
          );
          placements++;
        }
      }
    }

    await client.query("COMMIT");

    const summary = await client.query(
      "SELECT status, count(*)::int AS n FROM pets WHERE microchip_no LIKE '985112%' GROUP BY status ORDER BY n DESC"
    );
    console.log(`Seeded ${pets.length} pets, ${fosters.length} foster homes, ${placements} placements, ${vaccs} vaccinations, ${records} medical records.`);
    console.table(summary.rows);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("FAILED:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
main();
