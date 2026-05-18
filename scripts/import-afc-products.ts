import { Prisma, PrismaClient } from "@prisma/client";
import { calculateMarginBps, slugify } from "@/lib/products/catalog";

const prisma = new PrismaClient();

type CatalogRow = {
  category: string;
  name: string;
  pharmacy: string;
  providerCost: number;
  retailPrice: number;
  netProfit: number;
  marginPercent: number;
  afhProfit: number;
  repCommission: number;
};

const catalogRows: CatalogRow[] = [
  { category: "Clinical Services", name: "Urgent Care Visit", pharmacy: "Tele-Health", providerCost: 50, retailPrice: 75, netProfit: 25, marginPercent: 0.3333333333333333, afhProfit: 6.25, repCommission: 3.125 },
  { category: "Cognitive, Weightloss & Internal Health", name: "Low Dose Naltrexon (LDN) - 30 Day Supply", pharmacy: "Rush Pharma", providerCost: 118, retailPrice: 149, netProfit: 31, marginPercent: 0.2080536912751678, afhProfit: 7.75, repCommission: 3.875 },
  { category: "Cognitive & Mitochondria", name: "Methylene Blue Capsules (30 Day Supply)", pharmacy: "Strive", providerCost: 130, retailPrice: 229, netProfit: 99, marginPercent: 0.4323144104803494, afhProfit: 24.75, repCommission: 12.375 },
  { category: "Detox & Immune Support", name: "Glutathione Injection (30 Day Supply)", pharmacy: "Greenwich", providerCost: 135, retailPrice: 249, netProfit: 114, marginPercent: 0.4578313253012048, afhProfit: 28.5, repCommission: 14.25 },
  { category: "Detox & Immune Support", name: "Glutathione Injection (90 Day Supply)", pharmacy: "Greenwich", providerCost: 295, retailPrice: 595, netProfit: 300, marginPercent: 0.5042016806722689, afhProfit: 75, repCommission: 37.5 },
  { category: "Hair Restoration & Skin", name: "Epithalon / GHK-Cu", pharmacy: "Greenwich", providerCost: 150, retailPrice: 229, netProfit: 79, marginPercent: 0.3449781659388647, afhProfit: 19.75, repCommission: 9.875 },
  { category: "Hair Restoration & Skin", name: "Female - Hair Loss Capsules (Biotin 5mg, Minoxidil 1.25mg) 30 Day Supplies", pharmacy: "Hollandale", providerCost: 128, retailPrice: 249, netProfit: 121, marginPercent: 0.4859437751004016, afhProfit: 30.25, repCommission: 15.125 },
  { category: "Hair Restoration & Skin", name: "Female - Hair Loss Foam (Minoxidil, Ketocanazole, Latanoprost, Finasteride, GHK-Cu) 30 Day Supplies", pharmacy: "Hollandale", providerCost: 155, retailPrice: 249, netProfit: 94, marginPercent: 0.3775100401606425, afhProfit: 23.5, repCommission: 11.75 },
  { category: "Hair Restoration & Skin", name: "GHK-Cu 1.5% Cream", pharmacy: "Rush Pharma", providerCost: 154, retailPrice: 249, netProfit: 95, marginPercent: 0.3815261044176707, afhProfit: 23.75, repCommission: 11.875 },
  { category: "Hair Restoration & Skin", name: "Male - Hair Loss Capsules (Biotin, Minoxidil, Finasteride) 30 Day Supplies", pharmacy: "Strive", providerCost: 125, retailPrice: 249, netProfit: 124, marginPercent: 0.4979919678714859, afhProfit: 31, repCommission: 15.5 },
  { category: "Hair Restoration & Skin", name: "Male - Hair Loss Foam (Finasteride 5mg, Minoxidil 50mg) 30 Day Supplies", pharmacy: "Hollandale", providerCost: 113, retailPrice: 249, netProfit: 136, marginPercent: 0.5461847389558233, afhProfit: 34, repCommission: 17 },
  { category: "Peptides & Longevity", name: "BPC-157 (Healing Peptide) 30 Day Supply", pharmacy: "TBD", providerCost: 118, retailPrice: 229, netProfit: 111, marginPercent: 0.4847, afhProfit: 27.75, repCommission: 13.875 },
  { category: "Peptides & Longevity", name: "CJC-1295 / Ipamorelin (30 Day Supply)", pharmacy: "Greenwich", providerCost: 150, retailPrice: 297, netProfit: 147, marginPercent: 0.494949494949495, afhProfit: 36.75, repCommission: 18.375 },
  { category: "Peptides & Longevity", name: "Epithalon (30 Day Supply)", pharmacy: "Greenwich", providerCost: 135, retailPrice: 229, netProfit: 94, marginPercent: 0.4104803493449782, afhProfit: 23.5, repCommission: 11.75 },
  { category: "Peptides & Longevity", name: "MOT-c (30 Day Supply)", pharmacy: "Greenwich", providerCost: 150, retailPrice: 297, netProfit: 147, marginPercent: 0.494949494949495, afhProfit: 36.75, repCommission: 18.375 },
  { category: "Peptides & Longevity", name: "NAD (30 Day Supply)", pharmacy: "Greenwich", providerCost: 134.99, retailPrice: 229, netProfit: 94.01, marginPercent: 0.4105240174672489, afhProfit: 23.5025, repCommission: 11.75125 },
  { category: "Peptides & Longevity", name: "Sermorelin (30 Day Supply)", pharmacy: "Greenwich", providerCost: 134, retailPrice: 229, netProfit: 95, marginPercent: 0.4148471615720524, afhProfit: 23.75, repCommission: 11.875 },
  { category: "Peptides & Longevity", name: "Tesamorelin (30 Day Supply)", pharmacy: "Greenwich", providerCost: 190, retailPrice: 297, netProfit: 107, marginPercent: 0.3602693602693603, afhProfit: 26.75, repCommission: 13.375 },
  { category: "Peptides & Longevity", name: "Tesamorelin / Ipamorelin (30 Day Supply)", pharmacy: "Greenwich", providerCost: 150, retailPrice: 297, netProfit: 147, marginPercent: 0.494949494949495, afhProfit: 36.75, repCommission: 18.375 },
  { category: "Sexual Wellness", name: "PT-141 (30 Day Supply)", pharmacy: "Greenwich", providerCost: 135, retailPrice: 149, netProfit: 14, marginPercent: 0.09395973154362416, afhProfit: 3.5, repCommission: 1.75 },
  { category: "Vitamins", name: "B-12 Injection (Methylcobalamin) 30 Day Supply", pharmacy: "Nova Specialty", providerCost: 91, retailPrice: 200, netProfit: 109, marginPercent: 0.545, afhProfit: 27.25, repCommission: 13.625 },
  { category: "Sexual Wellness", name: "Sildenafil 50mg (10 Tablets)", pharmacy: "Hollandale", providerCost: 115, retailPrice: 255, netProfit: 140, marginPercent: 0.5490196078431373, afhProfit: 35, repCommission: 17.5 },
  { category: "Sexual Wellness", name: "Sildenafil 50mg (20 Tablets)", pharmacy: "Hollandale", providerCost: 145, retailPrice: 320, netProfit: 175, marginPercent: 0.546875, afhProfit: 43.75, repCommission: 21.875 },
  { category: "Sexual Wellness", name: "Tadalafil 20mg (10 Count)", pharmacy: "Hollandale", providerCost: 105, retailPrice: 230, netProfit: 125, marginPercent: 0.5434782608695652, afhProfit: 31.25, repCommission: 15.625 },
  { category: "Sexual Wellness", name: "Tadalafil 20mg (20 Count)", pharmacy: "Hollandale", providerCost: 125, retailPrice: 275, netProfit: 150, marginPercent: 0.5454545454545454, afhProfit: 37.5, repCommission: 18.75 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Semaglutide + B12 + Zofran (Dose 1: 0.25mg/Weekly) 30 Day Supply", pharmacy: "Hollandale", providerCost: 99, retailPrice: 297, netProfit: 198, marginPercent: 0.6666666666666666, afhProfit: 49.5, repCommission: 24.75 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Semaglutide + B12 + Zofran (Dose 2: 0.5mg/Weekly) 30 Day Supply", pharmacy: "Hollandale", providerCost: 99, retailPrice: 297, netProfit: 198, marginPercent: 0.6666666666666666, afhProfit: 49.5, repCommission: 24.75 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Semaglutide + B12 + Zofran (Dose 3: 1mg/Weekly) 30 Day Supply", pharmacy: "Hollandale", providerCost: 99, retailPrice: 297, netProfit: 198, marginPercent: 0.6666666666666666, afhProfit: 49.5, repCommission: 24.75 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Semaglutide + B12 + Zofran (Dose 4: 1.5mg/Weekly) 30 Day Supply", pharmacy: "Hollandale", providerCost: 99, retailPrice: 297, netProfit: 198, marginPercent: 0.6666666666666666, afhProfit: 49.5, repCommission: 24.75 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Semaglutide + B12 + Zofran (Dose 5: 2.5mg/Weekly) 30 Day Supply", pharmacy: "Hollandale", providerCost: 114, retailPrice: 297, netProfit: 183, marginPercent: 0.6161616161616161, afhProfit: 45.75, repCommission: 22.875 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Tirzepatide (Mounjaro) (Dose 1: 2.5mg/weekly) - 30 Day Supply", pharmacy: "Hollandale", providerCost: 99, retailPrice: 397, netProfit: 298, marginPercent: 0.7506297229219143, afhProfit: 74.5, repCommission: 37.25 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Tirzepatide (Mounjaro) (Dose 2: 5mg/weekly) - 30 Day Supply", pharmacy: "Hollandale", providerCost: 109, retailPrice: 397, netProfit: 288, marginPercent: 0.72544080604534, afhProfit: 72, repCommission: 36 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Tirzepatide (Mounjaro) (Dose 3: 7.5mg/weekly) - 30 Day Supply", pharmacy: "Hollandale", providerCost: 129, retailPrice: 397, netProfit: 268, marginPercent: 0.6750629722921915, afhProfit: 67, repCommission: 33.5 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Tirzepatide (Mounjaro) (Dose 4: 10mg/weekly) - 30 Day Supply", pharmacy: "Hollandale", providerCost: 168, retailPrice: 397, netProfit: 229, marginPercent: 0.6258351893095768, afhProfit: 57.25, repCommission: 28.625 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Tirzepatide (Mounjaro) (Dose 5: 12.5mg/weekly) - 30 Day Supply", pharmacy: "Hollandale", providerCost: 168, retailPrice: 397, netProfit: 229, marginPercent: 0.5768261964735516, afhProfit: 57.25, repCommission: 28.625 },
  { category: "Weight Loss (GLP-1 & Metabolic)", name: "Tirzepatide (Mounjaro) (Dose 6: 15mg/weekly) - 30 Day Supply", pharmacy: "Hollandale", providerCost: 168, retailPrice: 397, netProfit: 229, marginPercent: 0.5768261964735516, afhProfit: 57.25, repCommission: 28.625 }
];

function dollarsToCents(value: number) {
  return Math.round(value * 100);
}

function skuFor(index: number) {
  return `AFC-CATALOG-${String(index + 1).padStart(3, "0")}`;
}

function salesGuideFor(row: CatalogRow) {
  return {
    benefits: [
      `Position this as part of the ${row.category.toLowerCase()} offering.`,
      `Retail price is $${row.retailPrice.toFixed(2)} with a clear care-program value proposition.`,
      row.pharmacy === "Tele-Health" ? "Useful for customers who need fast telehealth access." : `Fulfillment/vendor reference: ${row.pharmacy}.`
    ],
    talkingPoints: [
      "Ask what health or wellness goal the customer is trying to solve first.",
      "Confirm the customer understands this may require clinical review or provider approval where applicable.",
      "Explain the next step clearly: checkout, intake, consultation, fulfillment, and follow-up."
    ],
    commonObjections: [
      "If price is a concern, focus on guided care, convenience, and support rather than only the product.",
      "If the customer is unsure, recommend completing intake so the clinical team can review fit.",
      "Never promise outcomes; keep the conversation educational and compliant."
    ],
    callNotes: "Use this guide for sales education only. Avoid diagnosis, guarantees, or medical claims. Route clinical questions to the licensed provider workflow."
  };
}

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: "america-first-clinic" },
    update: {},
    create: {
      name: "America First Clinic",
      slug: "america-first-clinic",
      logoUrl: "/america-first-clinic-logo.jpeg",
      primaryColor: "#073763",
      accentColor: "#DC1F2A"
    }
  });

  await prisma.product.updateMany({
    where: {
      companyId: company.id,
      sku: "AFC-WL-001",
      title: "Medical Weight Loss Program"
    },
    data: { active: false }
  });

  for (const [index, row] of catalogRows.entries()) {
    const categorySlug = slugify(row.category);
    const category = await prisma.productCategory.upsert({
      where: {
        companyId_slug: {
          companyId: company.id,
          slug: categorySlug
        }
      },
      update: { name: row.category },
      create: {
        companyId: company.id,
        name: row.category,
        slug: categorySlug
      }
    });

    const priceCents = dollarsToCents(row.retailPrice);
    const internalCostCents = dollarsToCents(row.providerCost);
    const sku = skuFor(index);
    const metadata: Prisma.InputJsonValue = {
      importSource: "google_sheet_catalog_2026_05",
      healthcareCategory: row.category,
      pharmacy: row.pharmacy,
      providerCostCents: internalCostCents,
      retailPriceCents: priceCents,
      netProfitCents: dollarsToCents(row.netProfit),
      marginPercentFromSheet: row.marginPercent,
      afhProfitCents: dollarsToCents(row.afhProfit),
      repCommissionCents: dollarsToCents(row.repCommission),
      requiresConsult: true,
      salesGuide: salesGuideFor(row)
    };

    await prisma.product.upsert({
      where: {
        companyId_sku: {
          companyId: company.id,
          sku
        }
      },
      update: {
        categoryId: category.id,
        title: row.name,
        slug: slugify(row.name),
        description: `${row.name} offered through America First Clinic's ${row.category} catalog.`,
        priceCents,
        internalCostCents,
        marginBps: calculateMarginBps(priceCents, internalCostCents),
        active: true,
        supportsSubscription: row.name.includes("30 Day") || row.name.includes("90 Day"),
        supportsRecurring: row.name.includes("30 Day") || row.name.includes("90 Day"),
        metadata,
        inventory: {
          upsert: {
            create: {
              quantityOnHand: 100,
              reorderPoint: 10
            },
            update: {
              reorderPoint: 10
            }
          }
        }
      },
      create: {
        companyId: company.id,
        categoryId: category.id,
        title: row.name,
        slug: slugify(row.name),
        description: `${row.name} offered through America First Clinic's ${row.category} catalog.`,
        priceCents,
        internalCostCents,
        marginBps: calculateMarginBps(priceCents, internalCostCents),
        sku,
        active: true,
        supportsSubscription: row.name.includes("30 Day") || row.name.includes("90 Day"),
        supportsRecurring: row.name.includes("30 Day") || row.name.includes("90 Day"),
        metadata,
        inventory: {
          create: {
            quantityOnHand: 100,
            reorderPoint: 10
          }
        }
      }
    });
  }

  console.log(`Imported ${catalogRows.length} America First Clinic products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
