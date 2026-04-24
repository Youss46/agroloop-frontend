import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Package, Receipt, Leaf, TrendingUp, Coins } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";

const COLORS = ["#16a34a", "#65a30d", "#ca8a04", "#dc2626", "#0ea5e9", "#7c3aed"];

function StatCard({ icon: Icon, label, value, sub }: any) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-md">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminOverview() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminApi.stats() });

  if (isLoading || !data) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
      </AdminLayout>
    );
  }

  const usersByRole = Object.entries(data.usersByRole).map(([role, count]) => ({ role, count }));
  const offresByStatus = Object.entries(data.offresByStatus).map(([status, count]) => ({ status, count }));
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Vue générale</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Users} label="Utilisateurs" value={fmt(data.totalUsers)} sub={`+${data.newUsersThisWeek} cette semaine`} />
        <StatCard icon={Package} label="Offres" value={fmt(data.totalOffres)} sub={`+${data.newOffresThisWeek} cette semaine`} />
        <StatCard icon={Receipt} label="Transactions" value={fmt(data.totalTransactions)} />
        <StatCard icon={Leaf} label="Kg valorisés" value={fmt(data.totalKgValorises)} sub={`${fmt(data.co2EviteKg)} kg CO₂ évités`} />
        <StatCard icon={TrendingUp} label="Volume total" value={`${fmt(data.totalVolumeFcfa)} FCFA`} />
        <StatCard icon={Coins} label="Commission (4%)" value={`${fmt(data.revenueEstime)} FCFA`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader><CardTitle>Utilisateurs par rôle</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={usersByRole} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={80} label>
                  {usersByRole.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Offres par statut</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={offresByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" /><YAxis /><Tooltip />
                <Bar dataKey="count" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader><CardTitle>Inscriptions (8 dernières semaines)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.weeklyRegistrations}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} />
                <YAxis /><Tooltip />
                <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top régions</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.topRegions} layout="vertical">
                <XAxis type="number" /><YAxis type="category" dataKey="region" width={100} />
                <Tooltip /><Bar dataKey="count" fill="#65a30d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top types de résidus (kg)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.topResidus}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" /><YAxis /><Tooltip />
              <Bar dataKey="volume" fill="#ca8a04" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
