"use client";

import React from "react";
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  QrCode, 
  Download,
  MoreVertical,
  Mail,
  Phone
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
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Mock registrations data
const mockRegistrations = [
  {
    id: "reg1",
    ticketId: "KSA-XJ92LK",
    name: "Aby Joseph",
    email: "aby@example.com",
    phone: "+49 151 1234567",
    attendees: 4,
    event: "Vishu Celebration 2026",
    eventId: "1",
    isCheckedIn: true,
    checkInTime: "2026-04-12T10:15:00",
  },
  {
    id: "reg2",
    ticketId: "KSA-88LPQR",
    name: "John Doe",
    email: "john@example.com",
    phone: "+49 152 7654321",
    attendees: 2,
    event: "Vishu Celebration 2026",
    eventId: "1",
    isCheckedIn: false,
    checkInTime: null,
  },
  {
    id: "reg3",
    ticketId: "KSA-MN77ZK",
    name: "Sarah Smith",
    email: "sarah@example.com",
    phone: null,
    attendees: 1,
    event: "Sports Meet 2026",
    eventId: "2",
    isCheckedIn: false,
    checkInTime: null,
  },
];

function AdminRegistrationsContent() {
  const searchParams = useSearchParams();
  const eventFilter = searchParams.get("event");

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registrations</h1>
          <p className="text-muted-foreground">Monitor and manage attendee registrations for all events.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" className="h-11 px-6">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Link href={`/admin/check-in/${eventFilter || 'all'}`}>
            <Button className="h-11 px-6 font-bold shadow-lg">
              <QrCode className="mr-2 h-4 w-4" />
              Open Scanner
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-background p-4 rounded-xl border border-border/40 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or ticket ID..." className="pl-10 h-11 border-none bg-muted/50" />
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Button variant="outline" size="sm" className="flex-1 md:flex-none h-11">
            <Filter className="mr-2 h-4 w-4" />
            {eventFilter ? "Filtered by Event" : "All Events"}
          </Button>
        </div>
      </div>

      <div className="bg-background rounded-xl border border-border/40 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="py-4">Attendee</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Ticket ID</TableHead>
              <TableHead>Attendees</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockRegistrations.map((reg) => (
              <TableRow key={reg.id} className="group transition-colors">
                <TableCell className="py-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mr-3 font-bold text-xs">
                      {reg.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{reg.name}</p>
                      <div className="flex items-center space-x-3 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Mail className="mr-1 h-3 w-3" />
                          {reg.email}
                        </span>
                        {reg.phone && (
                          <span className="text-xs text-muted-foreground flex items-center">
                            <Phone className="mr-1 h-3 w-3" />
                            {reg.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{reg.event}</p>
                </TableCell>
                <TableCell>
                  <code className="bg-muted px-2 py-1 rounded text-xs font-mono">{reg.ticketId}</code>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <span className="font-medium">{reg.attendees}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {reg.isCheckedIn ? (
                    <div className="flex flex-col">
                      <Badge variant="success" className="w-fit">
                        Checked In
                      </Badge>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {new Date(reg.checkInTime!).toLocaleTimeString()}
                      </span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="w-fit">
                      Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {!reg.isCheckedIn && (
                      <Button variant="ghost" size="sm" className="h-8 text-primary hover:text-primary hover:bg-primary/10 px-3">
                        Manual Check-in
                      </Button>
                    )}
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

export default function AdminRegistrationsPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading registrations...</div>}>
      <AdminRegistrationsContent />
    </React.Suspense>
  );
}
