import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Calendar, 
  CheckCircle2, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

export default function AdminDashboardPage() {
  const stats = [
    { 
      label: "Total Registrations", 
      value: "142", 
      icon: Users, 
      trend: "+12%", 
      trendUp: true 
    },
    { 
      label: "Upcoming Events", 
      value: "4", 
      icon: Calendar, 
      trend: "Steady", 
      trendUp: true 
    },
    { 
      label: "Check-ins Today", 
      value: "0", 
      icon: CheckCircle2, 
      trend: "N/A", 
      trendUp: true 
    },
    { 
      label: "Total Revenue", 
      value: "€2,540", 
      icon: TrendingUp, 
      trend: "+8%", 
      trendUp: true 
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground">Welcome back to the KSA administrative portal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center text-xs mt-1">
                {stat.trendUp ? (
                  <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={stat.trendUp ? "text-green-500" : "text-red-500 font-medium"}>
                  {stat.trend}
                </span>
                <span className="text-muted-foreground ml-1">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { name: "Aby Joseph", event: "Vishu Celebration", time: "2 hours ago" },
                { name: "John Doe", event: "Sports Meet", time: "5 hours ago" },
                { name: "Sarah Smith", event: "Vishu Celebration", time: "1 day ago" },
                { name: "Mathews P.", event: "Malayalam Class", time: "2 days ago" },
              ].map((reg, idx) => (
                <div key={idx} className="flex items-center justify-between group">
                  <div className="flex items-center space-x-4">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs ring-2 ring-background ring-offset-2 ring-offset-primary/5 transition-all group-hover:ring-primary/20">
                      {reg.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">{reg.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{reg.event}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{reg.time}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Event Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { title: "Vishu Celebration", status: "Active", progress: 85 },
                { title: "Sports Meet", status: "Planning", progress: 40 },
                { title: "Onam 2026", status: "Draft", progress: 10 },
              ].map((event, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{event.title}</span>
                    <span className="text-muted-foreground">{event.status}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${event.progress}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
