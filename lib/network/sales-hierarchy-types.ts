export type HierarchyNode = {
  id: string;
  type: "PARTNER" | "MANAGER" | "GROUP_LEADER" | "CONSULTANT";
  name: string;
  email: string;
  avatarUrl: string | null;
  commissionLabel: string;
  revenueCents: number;
  commissionCents: number;
  personalCommissionCents?: number;
  groupCommissionCents?: number;
  salesCount: number;
  showCommissionMetric?: boolean;
  showCommissionSetup?: boolean;
  subtitle?: string;
  notes?: string[];
};

export type HierarchyLeaderGroup = {
  leader: HierarchyNode;
  consultants: HierarchyNode[];
};

export type HierarchyManagerGroup = {
  manager: HierarchyNode;
  leaderGroups: HierarchyLeaderGroup[];
  directConsultants: HierarchyNode[];
};

export type SalesHierarchyTree = {
  partner: HierarchyNode;
  managerGroups: HierarchyManagerGroup[];
  directLeaderGroups: HierarchyLeaderGroup[];
  directConsultants: HierarchyNode[];
};
