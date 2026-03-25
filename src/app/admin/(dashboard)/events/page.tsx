import React from "react";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Users, 
  Eye, 
  Trash2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

// Mock events for the admin list
const mockEvents = [
  {
    id: "1",
    title: "Vishu Celebration 2026",
    date: "2026-04-12T10:00:00",
    registrations: 85,
    status: "Published",
    category: "Festival",
  },
  {
    id: "2",
    title: "Sports Meet 2026",
    date: "2026-05-24T09:00:00",
    registrations: 42,
    status: "Published",
    category: "Sports",
  },
  {
    id: "3",
    title: "Onam 2026",
    date: "2026-08-30T11:00:00",
    registrations: 12,
    status: "Draft",
    category: "Festival",
  },
  {
    id: "4",
    title: "Malayalam Class - Fall",
    date: "2026-09-05T10:00:00",
    registrations: 25,
    status: "Published",
    category: "Education",
  },
];

export default function AdminEventsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events Management</h1>
          <p className="text-muted-foreground">Manage your community events, registrations, and status.</p>
        </div>
        <Link href="/admin/events/new">
          <Button className="h-11 px-6 font-bold shadow-lg">
            <Plus className="mr-2 h-4 w-4" />
            Create New Event
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-background p-4 rounded-xl border border-border/40 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search events..." className="pl-10 h-10 border-none bg-muted/50" />
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Button variant="outline" size="sm" className="flex-1 md:flex-none">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="flex-1 md:flex-none">
            Sort by Date
          </Button>
        </div>
      </div>

      <div className="bg-background rounded-xl border border-border/40 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="py-4">Event Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registrations</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockEvents.map((event) => (
              <TableRow key={event.id} className="group transition-colors">
                <TableCell className="py-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mr-3 font-bold text-xs ring-1 ring-primary/5 transition-all group-hover:ring-primary/20">
                      {event.title.substring(0, 1)}
                    </div>
                    <div>
                      <p className="font-semibold">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.category}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4 text-primary/60" />
                    {formatDate(event.date)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={event.status === "Published" ? "success" : "outline"} className="font-medium">
                    {event.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{event.registrations}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/admin/events/${event.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/admin/registrations?event=${event.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="group-hover:hidden">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
