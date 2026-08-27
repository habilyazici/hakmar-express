/**
 * Demo dataset — enough to make every page show something real, small
 * enough to seed in seconds.
 *
 * Separate from `seed.ts` on purpose: that one creates the first superadmin
 * and the map boundaries, both of which any install needs. This one invents
 * a fictional retail history and must never run against real data, so it
 * refuses unless the tables it owns are empty (or --force is passed).
 *
 *   pnpm --filter api seed:demo
 *   pnpm --filter api seed:demo -- --force   # wipe and regenerate
 */
// Must be first: this script is run straight through tsx (`pnpm --filter api
// seed:demo`), with no Prisma CLI in front of it to load the environment.
// Without this DATABASE_URL is undefined and node-postgres fails with an
// unrelated-looking SASL error instead of connecting.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const force = process.argv.includes('--force');

/** Region -> cities, with real licence-plate codes so the map joins. */
const GEOGRAPHY: { region: string; cities: [string, number][] }[] = [
  {
    region: 'Marmara',
    cities: [
      ['İstanbul', 34],
      ['Bursa', 16],
      ['Kocaeli', 41],
    ],
  },
  {
    region: 'İç Anadolu',
    cities: [
      ['Ankara', 6],
      ['Konya', 42],
      ['Kayseri', 38],
    ],
  },
  {
    region: 'Ege',
    cities: [
      ['İzmir', 35],
      ['Denizli', 20],
    ],
  },
  {
    region: 'Akdeniz',
    cities: [
      ['Antalya', 7],
      ['Adana', 1],
    ],
  },
  {
    region: 'Karadeniz',
    cities: [
      ['Samsun', 55],
      ['Trabzon', 61],
    ],
  },
  {
    region: 'Güneydoğu',
    cities: [
      ['Gaziantep', 27],
      ['Diyarbakır', 21],
    ],
  },
];

/** Rough centroids, so the geographic sales map plots branches sensibly. */
const COORDS: Record<number, [number, number]> = {
  34: [41.01, 28.98],
  16: [40.19, 29.06],
  41: [40.77, 29.95],
  6: [39.93, 32.86],
  42: [37.87, 32.48],
  38: [38.73, 35.49],
  35: [38.42, 27.14],
  20: [37.78, 29.09],
  7: [36.9, 30.7],
  1: [37.0, 35.32],
  55: [41.29, 36.33],
  61: [41.0, 39.72],
  27: [37.07, 37.38],
  21: [37.91, 40.24],
};

const CATALOG: {
  category: string;
  subcategories: string[];
  brands: [string, string][];
  products: [string, string, number][]; // name, subcategory, unit price
}[] = [
  {
    category: 'Gıda',
    subcategories: ['Atıştırmalık', 'Kahvaltılık', 'Temel Gıda'],
    brands: [
      ['ULKR', 'Ülker'],
      ['ETI', 'Eti'],
      ['TORK', 'Torku'],
    ],
    products: [
      ['Bisküvi', 'Atıştırmalık', 18],
      ['Çikolata', 'Atıştırmalık', 32],
      ['Kraker', 'Atıştırmalık', 14],
      ['Kuruyemiş 200g', 'Atıştırmalık', 95],
      ['Reçel 380g', 'Kahvaltılık', 48],
      ['Bal 450g', 'Kahvaltılık', 165],
      ['Zeytin 500g', 'Kahvaltılık', 78],
      ['Makarna 500g', 'Temel Gıda', 22],
      ['Pirinç 1kg', 'Temel Gıda', 62],
      ['Un 1kg', 'Temel Gıda', 28],
      ['Ayçiçek Yağı 1L', 'Temel Gıda', 88],
    ],
  },
  {
    category: 'İçecek',
    subcategories: ['Sıcak İçecek', 'Soğuk İçecek'],
    brands: [
      ['CAYK', 'Çaykur'],
      ['PNAR', 'Pınar'],
    ],
    products: [
      ['Çay 1kg', 'Sıcak İçecek', 145],
      ['Türk Kahvesi 250g', 'Sıcak İçecek', 92],
      ['Maden Suyu 6x200ml', 'Soğuk İçecek', 34],
      ['Meyve Suyu 1L', 'Soğuk İçecek', 42],
      ['Ayran 1L', 'Soğuk İçecek', 30],
      ['Süt 1L', 'Soğuk İçecek', 36],
    ],
  },
  {
    category: 'Temizlik',
    subcategories: ['Çamaşır', 'Ev Temizliği'],
    brands: [
      ['HAYT', 'Hayat'],
      ['SLAN', 'Selan'],
    ],
    products: [
      ['Çamaşır Deterjanı 3kg', 'Çamaşır', 215],
      ['Yumuşatıcı 1.4L', 'Çamaşır', 118],
      ['Bulaşık Deterjanı 1L', 'Ev Temizliği', 58],
      ['Yüzey Temizleyici 1L', 'Ev Temizliği', 46],
      ['Kağıt Havlu 6lı', 'Ev Temizliği', 96],
    ],
  },
  {
    category: 'Kişisel Bakım',
    subcategories: ['Bakım'],
    brands: [['DALN', 'Dalin']],
    products: [
      ['Şampuan 500ml', 'Bakım', 89],
      ['Diş Macunu 100ml', 'Bakım', 54],
      ['Sabun 4lü', 'Bakım', 38],
    ],
  },
];

const FIRST_NAMES = [
  'Ayşe',
  'Mehmet',
  'Zeynep',
  'Mustafa',
  'Elif',
  'Ahmet',
  'Fatma',
  'Ali',
  'Emine',
  'Hüseyin',
  'Hatice',
  'Burak',
  'Merve',
  'Can',
  'Selin',
  'Emre',
  'Deniz',
  'Ceren',
  'Okan',
  'Gizem',
];
const LAST_NAMES = [
  'Yılmaz',
  'Kaya',
  'Demir',
  'Şahin',
  'Çelik',
  'Yıldız',
  'Öztürk',
  'Aydın',
  'Arslan',
  'Doğan',
  'Kılıç',
  'Aslan',
];

/**
 * Deterministic pseudo-random, so re-seeding produces the same dataset and
 * anything you notice on screen is still there after a regenerate.
 */
let seed = 20260824;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick<T>(list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}
function between(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

const MONTHS = 24;

/**
 * Every calendar year the receipt window touches, derived rather than listed.
 *
 * The window is anchored on today, so a hardcoded pair drifted out from under
 * it: with MONTHS at 24 the oldest receipts are two years back, and the five
 * months before January of the earlier year had no price or cost row for
 * their year at all.
 */
const YEARS: number[] = (() => {
  const oldest = new Date();
  oldest.setUTCHours(0, 0, 0, 0);
  oldest.setUTCDate(1);
  oldest.setUTCMonth(oldest.getUTCMonth() - MONTHS);
  const years: number[] = [];
  for (let y = oldest.getUTCFullYear(); y <= new Date().getUTCFullYear(); y++) {
    years.push(y);
  }
  return years;
})();

const money = (value: number) => Number(value.toFixed(2));

async function isEmpty(): Promise<boolean> {
  const counts = await Promise.all([
    prisma.receipt.count(),
    prisma.product.count(),
    prisma.region.count(),
  ]);
  return counts.every((c) => c === 0);
}

async function wipe() {
  // Child-first, so foreign keys never block the delete.
  await prisma.receiptItem.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.spatialForecastRun.deleteMany();
  await prisma.cashier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.productCost.deleteMany();
  await prisma.productPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.city.deleteMany();
  await prisma.region.deleteMany();
}

async function main() {
  if (!(await isEmpty())) {
    if (!force) {
      console.error(
        'Refusing to run: this database already holds catalog or sales data.\n' +
          'Pass --force to wipe it and regenerate the demo dataset.',
      );
      process.exitCode = 1;
      return;
    }
    console.log('--force given; clearing existing catalog and sales data…');
    await wipe();
  }

  // ---- geography ----
  const branches: { id: number; regionIndex: number; weight: number }[] = [];
  const cashiers: { id: number; branchId: number }[] = [];
  const regionIds: number[] = [];

  for (const [regionIndex, entry] of GEOGRAPHY.entries()) {
    const region = await prisma.region.create({ data: { name: entry.region } });
    regionIds.push(region.id);

    for (const [cityName, plate] of entry.cities) {
      const city = await prisma.city.create({
        data: { name: cityName, plateCode: plate, regionId: region.id },
      });
      const [lat, lon] = COORDS[plate];
      // İstanbul and Ankara carry more of the business, as they would.
      const weight =
        plate === 34 ? 3 : plate === 6 ? 2 : plate === 35 ? 1.6 : 1;
      const branchCount = plate === 34 ? 3 : plate === 6 ? 2 : 1;

      for (let b = 0; b < branchCount; b++) {
        const branch = await prisma.branch.create({
          data: {
            name:
              branchCount > 1
                ? `${cityName} ${b + 1}. Şube`
                : `${cityName} Şube`,
            cityId: city.id,
            latitude: lat + (rand() - 0.5) * 0.1,
            longitude: lon + (rand() - 0.5) * 0.1,
          },
        });
        branches.push({ id: branch.id, regionIndex, weight });

        for (let c = 0; c < 2; c++) {
          const cashier = await prisma.cashier.create({
            data: {
              firstName: pick(FIRST_NAMES),
              lastName: pick(LAST_NAMES),
              branchId: branch.id,
            },
          });
          cashiers.push({ id: cashier.id, branchId: branch.id });
        }
      }
    }
  }

  // ---- catalog ----
  const products: { id: number; unit: number }[] = [];

  /**
   * The price and cost rows, kept so every line item can point at the exact
   * one it was sold under.
   *
   * Without this the line items invented their own price and cost and left
   * priceId and costId null — all 7,383 of them. /tables/region-cost joins
   * sales to costs through receipt_items.cost_id, so its Satış and Kâr
   * columns were ₺0 for every row, on a dataset whose whole purpose is to
   * make every page show something real. The catalog comment below even said
   * the costs existed so that table would have something to show.
   */
  const priceRows = new Map<string, { id: number; unitPrice: number }>();
  const costRows = new Map<string, { id: number; unitCost: number }>();

  for (const group of CATALOG) {
    const category = await prisma.category.create({
      data: { name: group.category },
    });
    const subIds = new Map<string, number>();
    for (const name of group.subcategories) {
      const sub = await prisma.subcategory.create({
        data: { name, categoryId: category.id },
      });
      subIds.set(name, sub.id);
    }
    const brandCodes: string[] = [];
    for (const [code, name] of group.brands) {
      await prisma.brand.create({
        data: { code, name, categoryId: category.id },
      });
      brandCodes.push(code);
    }
    for (const [name, subName, unit] of group.products) {
      const product = await prisma.product.create({
        data: {
          name,
          brandCode: pick(brandCodes),
          subcategoryId: subIds.get(subName)!,
        },
      });
      products.push({ id: product.id, unit });

      // Prices and regional costs per year, so the price-history and
      // region-cost tables have something to show.
      for (const [i, year] of YEARS.entries()) {
        const unitPrice = money(unit * (1 + i * 0.22));
        const price = await prisma.productPrice.create({
          data: { productId: product.id, year, unitPrice },
        });
        priceRows.set(`${product.id}:${year}`, { id: price.id, unitPrice });

        for (const regionId of regionIds) {
          // Cost varies a little by region, which is the point of that table.
          const unitCost = money(unitPrice * (0.58 + rand() * 0.09));
          const cost = await prisma.productCost.create({
            data: { productId: product.id, regionId, year, unitCost },
          });
          costRows.set(`${product.id}:${regionId}:${year}`, {
            id: cost.id,
            unitCost,
          });
        }
      }
    }
  }

  // ---- customers ----
  const customers: number[] = [];
  for (let i = 0; i < 40; i++) {
    const customer = await prisma.customer.create({
      data: {
        firstName: pick(FIRST_NAMES),
        lastName: pick(LAST_NAMES),
        gender: rand() > 0.5 ? 'F' : 'M',
      },
    });
    customers.push(customer.id);
  }

  // ---- sales history ----
  const cashiersByBranch = new Map<number, number[]>();
  for (const c of cashiers) {
    const list = cashiersByBranch.get(c.branchId) ?? [];
    list.push(c.id);
    cashiersByBranch.set(c.branchId, list);
  }

  let receiptCount = 0;
  let itemCount = 0;

  for (let monthsAgo = MONTHS; monthsAgo >= 0; monthsAgo--) {
    const anchor = new Date();
    anchor.setUTCHours(0, 0, 0, 0);
    anchor.setUTCDate(1);
    anchor.setUTCMonth(anchor.getUTCMonth() - monthsAgo);

    // A summer peak and a slow trend upward, so the seasonal model in the
    // forecast has a real signal to find.
    const seasonal =
      1 + 0.28 * Math.sin((2 * Math.PI * anchor.getUTCMonth()) / 12);
    const trend = 1 + (MONTHS - monthsAgo) * 0.011;

    for (const branch of branches) {
      const perMonth = Math.round(4 * branch.weight * seasonal);
      for (let n = 0; n < perMonth; n++) {
        const day = between(1, 28);
        const date = new Date(anchor);
        date.setUTCDate(day);
        if (date >= new Date()) continue;

        const branchCashiers = cashiersByBranch.get(branch.id)!;
        const receipt = await prisma.receipt.create({
          data: {
            branchId: branch.id,
            cashierId: pick(branchCashiers),
            customerId: pick(customers),
            receiptDate: date,
            receiptTime: new Date(
              `1970-01-01T${String(between(8, 20)).padStart(2, '0')}:${String(
                between(0, 59),
              ).padStart(2, '0')}:00Z`,
            ),
          },
        });
        receiptCount++;

        const lines = between(1, 5);
        const chosen = new Set<number>();
        for (let l = 0; l < lines; l++) {
          const product = pick(products);
          if (chosen.has(product.id)) continue;
          chosen.add(product.id);

          // Season, trend and branch size move demand, not unit economics: a
          // busy month sells more units at the shelf price, it does not
          // invent a different one. That keeps the line consistent with the
          // price and cost rows it points at, which is what makes
          // /tables/region-cost add up.
          const year = date.getUTCFullYear();
          const regionId = regionIds[branch.regionIndex];
          const priceRow = priceRows.get(`${product.id}:${year}`)!;
          const costRow = costRows.get(`${product.id}:${regionId}:${year}`)!;

          const qty = Math.max(
            1,
            Math.round(between(1, 4) * seasonal * trend * branch.weight),
          );
          const totalPrice = money(priceRow.unitPrice * qty);
          const totalCost = money(costRow.unitCost * qty);
          await prisma.receiptItem.create({
            data: {
              receiptId: receipt.id,
              productId: product.id,
              quantity: qty,
              priceId: priceRow.id,
              costId: costRow.id,
              totalPrice,
              totalCost,
              totalMargin: money(totalPrice - totalCost),
            },
          });
          itemCount++;
        }
      }
    }
  }

  console.log(
    `Demo data ready: ${branches.length} branches, ${products.length} products, ` +
      `${customers.length} customers, ${receiptCount} receipts, ${itemCount} line items ` +
      `over ${MONTHS + 1} months.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
