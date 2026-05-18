export const products = [
  {
    title: "Medical Weight Loss Program",
    slug: "medical-weight-loss-program",
    category: "Weight Loss",
    price: 499,
    recurring: true,
    inventory: 96,
    margin: "68%",
    consultantCommission: "15%",
    description: "A clinician-guided program with wellness coaching, progress tracking, and recurring care options."
  },
  {
    title: "GLP-1 Support Program",
    slug: "glp-1-support-program",
    category: "GLP-1",
    price: 799,
    recurring: true,
    inventory: 44,
    margin: "61%",
    consultantCommission: "12%",
    description: "A structured wellness program prepared for eligibility review, subscriptions, and future prescription workflows."
  },
  {
    title: "Vitamin Injection Visit",
    slug: "vitamin-injection-visit",
    category: "Vitamin Injections",
    price: 89,
    recurring: false,
    inventory: 180,
    margin: "74%",
    consultantCommission: "$12",
    description: "In-clinic vitamin injection service with customer history, appointment metadata, and consultant attribution."
  },
  {
    title: "Premium Wellness Bundle",
    slug: "premium-wellness-bundle",
    category: "Wellness Products",
    price: 149,
    recurring: false,
    inventory: 72,
    margin: "53%",
    consultantCommission: "10%",
    description: "A curated supplement and wellness starter bundle for new customers."
  }
];

export const revenueSeries = [
  { month: "Jan", revenue: 42000, commissions: 6200 },
  { month: "Feb", revenue: 51800, commissions: 7800 },
  { month: "Mar", revenue: 61200, commissions: 9100 },
  { month: "Apr", revenue: 74200, commissions: 11200 },
  { month: "May", revenue: 89300, commissions: 13600 },
  { month: "Jun", revenue: 104500, commissions: 15800 }
];

export const consultants = [
  { name: "Maya Rivera", rank: 1, revenue: 24150, commissions: 3622, conversion: "16.7%", status: "Pro" },
  { name: "Noah Bennett", rank: 2, revenue: 19720, commissions: 2958, conversion: "14.8%", status: "Rising" },
  { name: "Sophia Clark", rank: 3, revenue: 16300, commissions: 2445, conversion: "13.6%", status: "Rising" }
];

export const activity = [
  "New consultant application submitted",
  "Commission approved for GLP-1 Support Program",
  "Inventory alert: Vitamin Injection Visit",
  "ACH provider webhook queued for verification",
  "Customer subscription renewed successfully"
];
