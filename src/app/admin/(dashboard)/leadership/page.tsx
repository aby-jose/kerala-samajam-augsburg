"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  MoveUp,
  MoveDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SearchInput } from "@/components/admin/ui/search-input";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";

import { getLeadershipMembers, deleteLeadershipMember, updateLeadershipOrder } from "@/lib/leadership-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import LeadershipMemberModal from "@/components/admin/leadership-member-modal";

const ITEMS_PER_PAGE = 10;

export default function AdminLeadershipPage() {
  const confirm = useConfirm();
  const { success, error } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const data = await getLeadershipMembers();
      setMembers(data);
    } catch (err) {
      console.error("Failed to fetch leadership members:", err);
      error("Failed to load team members.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleCreateNew = () => {
    setSelectedMember(null);
    setIsModalOpen(true);
  };

  const handleEdit = (member: any) => {
    setSelectedMember(member);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Remove Member",
      message: "Are you sure you want to remove this member from the leadership team?",
      confirmText: "Remove",
      variant: "danger"
    });

    if (isConfirmed) {
      try {
        await deleteLeadershipMember(id);
        success("Member removed successfully.");
        fetchMembers();
      } catch (err) {
        error("Failed to remove member.");
      }
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newMembers = [...members];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newMembers.length) return;

    // Swap
    [newMembers[index], newMembers[targetIndex]] = [newMembers[targetIndex], newMembers[index]];

    // Update local state immediately for responsiveness
    setMembers(newMembers);

    // Update order in DB
    const updates = newMembers.map((m, i) => ({ id: m.id, order: i }));
    try {
      await updateLeadershipOrder(updates);
    } catch (err) {
      error("Failed to update order.");
      fetchMembers(); // Revert on failure
    }
  };

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part: string) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const columns: DataTableColumn<any>[] = [
    {
      key: "order",
      header: "Order",
      width: "w-[10%]",
      render: (member) => {
        const index = filteredMembers.indexOf(member);
        return (
          <div className="flex items-center gap-1">
            <div className="flex flex-col">
              <button
                onClick={() => handleMove(index, 'up')}
                disabled={index === 0}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Move up"
              >
                <MoveUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleMove(index, 'down')}
                disabled={index === filteredMembers.length - 1}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Move down"
              >
                <MoveDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
          </div>
        );
      },
    },
    {
      key: "member",
      header: "Member",
      width: "w-[35%]",
      render: (member) => (
        <div className="flex items-center gap-3">
          {member.image ? (
            <img
              src={member.image}
              alt={member.name}
              className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-xs font-semibold text-primary">
              {getInitials(member.name)}
            </div>
          )}
          <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: "w-[30%]",
      render: (member) => (
        <span className="block truncate text-sm text-muted-foreground">{member.role}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-[25%]",
      align: "right",
      render: (member) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(member)}
            className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Edit"
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(member.id)}
            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            aria-label="Remove"
            title="Remove"
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
        title="Leadership"
        description="Manage the executive committee and team members."
      >
        <Button onClick={handleCreateNew} className="h-9 rounded-lg">
          <Plus className="mr-2 h-4 w-4" />
          Add member
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={paginatedMembers}
        keyExtractor={(member) => member.id}
        isLoading={isLoading}
        skeletonRows={5}
        empty={{
          icon: Users,
          title: searchQuery ? "No results found" : "No members yet",
          description: searchQuery
            ? "Try a different search term."
            : "Add your first leadership team member.",
          action: !searchQuery ? (
            <Button onClick={handleCreateNew} className="h-9 rounded-lg">
              <Plus className="mr-2 h-4 w-4" />
              Add member
            </Button>
          ) : undefined,
        }}
        pagination={{
          page: currentPage,
          totalPages,
          totalItems: filteredMembers.length,
          itemLabel: "member",
          onPageChange: setCurrentPage,
        }}
        toolbar={
          <SearchInput
            placeholder="Search members…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-sm"
          />
        }
      />

      <LeadershipMemberModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchMembers();
        }}
        initialData={selectedMember}
      />
    </div>
  );
}
