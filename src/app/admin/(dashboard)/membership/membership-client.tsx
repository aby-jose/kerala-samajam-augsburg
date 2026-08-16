"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SearchInput } from "@/components/admin/ui/search-input";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { chipTone, type ChipTone } from "@/components/admin/ui/surface";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";

import MembershipPlanModal from "@/components/admin/membership-plan-modal";
import {
  getMembershipPlans,
  deleteMembershipPlan,
  togglePlanStatus
} from "@/lib/membership-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function planTone(duration?: string): ChipTone {
  const d = (duration || "").toUpperCase();
  if (d === "LIFETIME") return "violet";
  if (d === "MONTHLY") return "blue";
  return "primary";
}

const ITEMS_PER_PAGE = 10;

export default function MembershipClient() {
  const confirm = useConfirm();
  const { success, error } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const data = await getMembershipPlans();
      setPlans(data);
    } catch (err) {
      console.error("Failed to fetch plans:", err);
      error("Failed to load membership plans.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreateNew = () => {
    setSelectedPlan(null);
    setIsModalOpen(true);
  };

  const handleEdit = (plan: any) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Plan",
      message: "Are you sure you want to delete this membership plan? This will not affect existing subscriptions but will prevent new ones.",
      confirmText: "Delete",
      variant: "danger"
    });

    if (isConfirmed) {
      try {
        const res = await deleteMembershipPlan(id);
        if (res.success) {
          success(res.message || "Plan deleted successfully.");
          fetchPlans();
        }
      } catch (err) {
        error("Failed to delete plan.");
      }
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await togglePlanStatus(id, !currentStatus);
      success(`Plan ${!currentStatus ? 'activated' : 'deactivated'} successfully.`);
      fetchPlans();
    } catch (err) {
      error("Failed to update plan status.");
    }
  };

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredPlans.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPlans = filteredPlans.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const columns: DataTableColumn<any>[] = [
    {
      key: "plan",
      header: "Plan",
      width: "w-[40%]",
      render: (plan) => (
        <div className="flex items-center gap-3">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", chipTone(planTone(plan.duration)))}>
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-sm font-semibold text-foreground">{plan.name}</p>
            <p className="text-xs text-muted-foreground">{plan.duration}</p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      width: "w-[20%]",
      render: (plan) => (
        <span className="text-sm font-medium text-foreground tabular-nums">€{plan.price.toFixed(2)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[15%]",
      render: (plan) => (
        <button
          type="button"
          onClick={() => handleToggleStatus(plan.id, plan.isActive)}
          title={plan.isActive ? "Deactivate plan" : "Activate plan"}
          className="cursor-pointer"
        >
          <StatusBadge tone={plan.isActive ? "success" : "neutral"}>
            {plan.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        </button>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-[25%]",
      align: "right",
      render: (plan) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(plan)}
            className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Edit plan"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(plan.id)}
            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            aria-label="Delete plan"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membership plans"
        description="Configure membership tiers and pricing."
      >
        <Button onClick={handleCreateNew} className="h-9 rounded-lg">
          <Plus className="mr-2 h-4 w-4" />
          Create plan
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={paginatedPlans}
        keyExtractor={(plan) => plan.id}
        isLoading={isLoading}
        skeletonRows={5}
        empty={{
          icon: CreditCard,
          title: "No plans found",
          description: searchQuery ? "Try a different search term." : "Create a membership plan to get started.",
          tone: "emerald",
        }}
        pagination={{
          page: currentPage,
          totalPages,
          totalItems: filteredPlans.length,
          itemLabel: "plan",
          onPageChange: setCurrentPage,
        }}
        toolbar={
          <SearchInput
            placeholder="Search plans…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-sm"
          />
        }
      />

      {/* Keyed and mounted per opening so no form state carries over from the
          plan that was open before. */}
      {isModalOpen && (
        <MembershipPlanModal
          key={selectedPlan?.id ?? "new"}
          isOpen
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPlan(null);
            fetchPlans();
          }}
          initialData={selectedPlan}
        />
      )}
    </div>
  );
}
